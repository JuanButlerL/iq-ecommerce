import { Prisma, WhatsappConnectionStatus, type WhatsappConnection } from "@prisma/client";
import { z } from "zod";

import { getAdminSession } from "@/lib/auth/admin";
import { isPrincipalAdminEmail } from "@/lib/auth/admin-permissions";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { exchangeCodeForBusinessToken, graphRequest } from "@/lib/integrations/whatsapp/graph";

// Alta de coexistencia (WhatsApp Business app + Cloud API) via Embedded Signup.
// El code y los datos de la sesion llegan en requests separados: se juntan por sessionKey.
// Nunca se llama a /register: en coexistencia eso sacaria el numero de la app.

const sessionKeySchema = z.string().uuid();

export const signupCodeSchema = z.object({
  sessionKey: sessionKeySchema,
  code: z.string().min(10).max(4000),
});

export const signupSessionSchema = z.object({
  sessionKey: sessionKeySchema,
  payload: z
    .object({
      type: z.literal("WA_EMBEDDED_SIGNUP"),
      event: z.string().max(80),
      data: z.record(z.unknown()).optional(),
    })
    .passthrough(),
});

type StepEntry = { step: string; ok: boolean; at: string; detail?: string };

export type WhatsappConnectionView = ReturnType<typeof toView>;

export async function assertWhatsappAdmin() {
  const session = await getAdminSession();

  if (!session) {
    throw new AppError("No autorizado.", 401);
  }

  if (!isPrincipalAdminEmail(session.adminUser.email, env.ADMIN_LOCAL_EMAIL)) {
    throw new AppError("Solo el administrador principal puede conectar WhatsApp.", 403);
  }

  return session;
}

export async function listWhatsappConnections() {
  const connections = await prisma.whatsappConnection.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return connections.map(toView);
}

export async function recordSignupCode(input: z.infer<typeof signupCodeSchema>, adminEmail: string) {
  let connection = await upsertConnection(input.sessionKey, adminEmail);

  // El code vence en minutos: se canjea apenas llega, sin esperar los datos de la sesion.
  if (!connection.encryptedToken) {
    try {
      const { access_token: accessToken } = await exchangeCodeForBusinessToken(input.code);
      connection = await prisma.whatsappConnection.update({
        where: { id: connection.id },
        data: {
          encryptedToken: encryptSecret(accessToken),
          tokenObtainedAt: new Date(),
          ...stepData(connection, { step: "token", ok: true }),
        },
      });
    } catch (error) {
      await markFailed(connection.id, "token", error);
      throw error;
    }
  }

  return finalizeIfReady(connection.id);
}

export async function recordSignupSession(input: z.infer<typeof signupSessionSchema>, adminEmail: string) {
  const connection = await upsertConnection(input.sessionKey, adminEmail);
  const { event, data = {} } = input.payload;

  if (event === "CANCEL" || event === "ERROR") {
    const detail = asString(data.error_message) ?? asString(data.current_step) ?? event;

    await prisma.whatsappConnection.updateMany({
      where: { id: connection.id, status: WhatsappConnectionStatus.PENDING },
      data: {
        status: event === "CANCEL" ? WhatsappConnectionStatus.CANCELLED : WhatsappConnectionStatus.FAILED,
        signupEvent: event,
        errorMessage: detail,
        ...stepData(connection, { step: "signup", ok: false, detail }),
      },
    });

    return getView(connection.id);
  }

  await prisma.whatsappConnection.update({
    where: { id: connection.id },
    data: {
      signupEvent: event,
      wabaId: asString(data.waba_id) ?? connection.wabaId,
      phoneNumberId: asString(data.phone_number_id) ?? connection.phoneNumberId,
      businessId: asString(data.business_id) ?? connection.businessId,
      ...stepData(connection, { step: "signup", ok: true, detail: event }),
    },
  });

  return finalizeIfReady(connection.id);
}

export async function retryWhatsappConnection(id: string) {
  const claimed = await prisma.whatsappConnection.updateMany({
    where: {
      id,
      status: WhatsappConnectionStatus.FAILED,
      encryptedToken: { not: null },
      wabaId: { not: null },
    },
    data: { status: WhatsappConnectionStatus.CONNECTING, errorMessage: null },
  });

  if (claimed.count === 0) {
    throw new AppError("Esta conexion no se puede reintentar: falta el token o la WABA, o no esta en estado fallido.", 409);
  }

  return runConnectionSteps(id);
}

async function finalizeIfReady(id: string) {
  // El claim atomico evita que el request del code y el de la sesion corran los pasos dos veces.
  const claimed = await prisma.whatsappConnection.updateMany({
    where: {
      id,
      status: WhatsappConnectionStatus.PENDING,
      encryptedToken: { not: null },
      wabaId: { not: null },
    },
    data: { status: WhatsappConnectionStatus.CONNECTING, errorMessage: null },
  });

  if (claimed.count === 0) {
    return getView(id);
  }

  return runConnectionSteps(id);
}

async function runConnectionSteps(id: string) {
  let connection = await prisma.whatsappConnection.findUniqueOrThrow({ where: { id } });
  const token = decryptSecret(connection.encryptedToken as string);
  let step = "subscribed_apps";

  try {
    // Sin esta suscripcion no llegan webhooks de la WABA.
    await graphRequest(`${connection.wabaId}/subscribed_apps`, { method: "POST", token });
    connection = await saveStep(connection, { step, ok: true });

    step = "phone_number";
    if (!connection.phoneNumberId) {
      const phoneNumberId = await findCoexistencePhoneNumberId(connection.wabaId as string, token);
      connection = await saveStep(connection, { step, ok: true, detail: phoneNumberId }, { phoneNumberId });
    }

    step = "verify";
    const phone = await graphRequest<{
      is_on_biz_app?: boolean;
      platform_type?: string;
      display_phone_number?: string;
      verified_name?: string;
    }>(connection.phoneNumberId as string, {
      token,
      query: { fields: "is_on_biz_app,platform_type,display_phone_number,verified_name" },
    });

    connection = await saveStep(
      connection,
      { step, ok: phone.is_on_biz_app === true, detail: `is_on_biz_app=${phone.is_on_biz_app} platform_type=${phone.platform_type}` },
      {
        isOnBizApp: phone.is_on_biz_app ?? null,
        platformType: phone.platform_type ?? null,
        displayPhoneNumber: phone.display_phone_number ?? null,
        verifiedName: phone.verified_name ?? null,
      },
    );

    if (phone.is_on_biz_app !== true) {
      throw new AppError("El numero no quedo en coexistencia (is_on_biz_app no es true).", 409);
    }

    // Las sincronizaciones solo se pueden pedir dentro de las 24 h posteriores al alta, y una sola vez cada una.
    step = "sync_contacts";
    if (!connection.contactsSyncRequestId) {
      const requestId = await requestAppDataSync(connection.phoneNumberId as string, token, "smb_app_state_sync");
      connection = await saveStep(connection, { step, ok: true, detail: requestId }, { contactsSyncRequestId: requestId });
    }

    step = "sync_history";
    if (!connection.historySyncRequestId) {
      const requestId = await requestAppDataSync(connection.phoneNumberId as string, token, "history");
      connection = await saveStep(connection, { step, ok: true, detail: requestId }, { historySyncRequestId: requestId });
    }

    await prisma.whatsappConnection.update({
      where: { id },
      data: {
        status: WhatsappConnectionStatus.CONNECTED,
        connectedAt: new Date(),
        lastStep: "done",
        errorMessage: null,
      },
    });
  } catch (error) {
    await markFailed(id, step, error);
    throw error;
  }

  return getView(id);
}

async function findCoexistencePhoneNumberId(wabaId: string, token: string) {
  const result = await graphRequest<{ data?: Array<{ id: string; is_on_biz_app?: boolean }> }>(`${wabaId}/phone_numbers`, {
    token,
    query: { fields: "id,display_phone_number,is_on_biz_app,platform_type" },
  });
  const numbers = result.data ?? [];
  const match = numbers.find((number) => number.is_on_biz_app === true) ?? (numbers.length === 1 ? numbers[0] : undefined);

  if (!match) {
    throw new AppError(`No se pudo identificar el numero de la WABA (${numbers.length} numeros encontrados).`, 409);
  }

  return match.id;
}

async function requestAppDataSync(phoneNumberId: string, token: string, syncType: "smb_app_state_sync" | "history") {
  const result = await graphRequest<{ request_id?: string }>(`${phoneNumberId}/smb_app_data`, {
    method: "POST",
    token,
    body: { messaging_product: "whatsapp", sync_type: syncType },
  });

  return result.request_id ?? "sin-request-id";
}

async function upsertConnection(sessionKey: string, adminEmail: string) {
  try {
    return await prisma.whatsappConnection.upsert({
      where: { sessionKey },
      create: { sessionKey, createdBy: adminEmail },
      update: {},
    });
  } catch (error) {
    // Los dos requests del signup pueden llegar a la vez y competir por crear la fila.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.whatsappConnection.findUniqueOrThrow({ where: { sessionKey } });
    }

    throw error;
  }
}

async function saveStep(
  connection: WhatsappConnection,
  entry: Omit<StepEntry, "at">,
  data: Prisma.WhatsappConnectionUpdateInput = {},
) {
  return prisma.whatsappConnection.update({
    where: { id: connection.id },
    data: { ...data, ...stepData(connection, entry) },
  });
}

async function markFailed(id: string, step: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Error desconocido";
  const connection = await prisma.whatsappConnection.findUnique({ where: { id } });

  if (!connection) {
    return;
  }

  await prisma.whatsappConnection.update({
    where: { id },
    data: {
      status: WhatsappConnectionStatus.FAILED,
      errorMessage: message,
      ...stepData(connection, { step, ok: false, detail: message }),
    },
  });
}

function stepData(connection: Pick<WhatsappConnection, "steps">, entry: Omit<StepEntry, "at">) {
  const steps = Array.isArray(connection.steps) ? (connection.steps as StepEntry[]) : [];

  return {
    lastStep: entry.step,
    steps: [...steps, { ...entry, at: new Date().toISOString() }] as Prisma.InputJsonValue,
  };
}

async function getView(id: string) {
  return toView(await prisma.whatsappConnection.findUniqueOrThrow({ where: { id } }));
}

function toView(connection: WhatsappConnection) {
  return {
    id: connection.id,
    status: connection.status,
    signupEvent: connection.signupEvent,
    hasToken: Boolean(connection.encryptedToken),
    wabaId: connection.wabaId,
    phoneNumberId: connection.phoneNumberId,
    displayPhoneNumber: connection.displayPhoneNumber,
    verifiedName: connection.verifiedName,
    isOnBizApp: connection.isOnBizApp,
    platformType: connection.platformType,
    contactsSyncRequestId: connection.contactsSyncRequestId,
    historySyncRequestId: connection.historySyncRequestId,
    lastStep: connection.lastStep,
    errorMessage: connection.errorMessage,
    steps: (Array.isArray(connection.steps) ? connection.steps : []) as StepEntry[],
    createdAt: connection.createdAt.toISOString(),
    connectedAt: connection.connectedAt?.toISOString() ?? null,
  };
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
