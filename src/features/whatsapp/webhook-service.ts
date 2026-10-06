import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";

type WhatsappWebhookChange = {
  field?: string;
  value?: Record<string, unknown> & {
    metadata?: { phone_number_id?: string };
    event?: string;
  };
};

type WhatsappWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: WhatsappWebhookChange[];
  }>;
};

export function verifyWhatsappWebhookSubscription(url: URL) {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge");
  const expectedToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!expectedToken) {
    throw new AppError("WhatsApp webhook no configurado.", 503);
  }

  if (mode !== "subscribe" || !challenge || !safeEqual(token, expectedToken)) {
    throw new AppError("Verificacion de webhook no valida.", 403);
  }

  return challenge;
}

export async function handleWhatsappWebhook(request: Request) {
  const rawBody = await request.text();

  validateWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"));

  const payload = parseWebhookPayload(rawBody);
  const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const object = payload.object ?? "unknown";

  const rows: Prisma.WhatsappWebhookEventCreateManyInput[] = [];

  (payload.entry ?? []).forEach((entry, entryIndex) => {
    (entry.changes ?? []).forEach((change, changeIndex) => {
      const field = change.field ?? "unknown";

      if (field === "account_update" && change.value?.event === "PARTNER_REMOVED") {
        // La coexistencia se desconecto desde la app: hay que volver a hacer el onboarding.
        console.error("[whatsapp] PARTNER_REMOVED recibido para WABA", entry.id);
      }

      rows.push({
        dedupeKey: `${bodyHash}:${entryIndex}:${changeIndex}`,
        object,
        field,
        wabaId: entry.id ?? null,
        phoneNumberId: change.value?.metadata?.phone_number_id ?? null,
        payload: (change.value ?? {}) as Prisma.InputJsonValue,
      });
    });
  });

  if (rows.length === 0) {
    return { ok: true, stored: 0 };
  }

  // Meta reintenta el mismo cuerpo si no recibe 200: los duplicados se descartan por dedupe_key.
  const result = await prisma.whatsappWebhookEvent.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return { ok: true, stored: result.count };
}

function validateWebhookSignature(rawBody: string, header: string | null) {
  const appSecret = env.WHATSAPP_APP_SECRET;

  if (!appSecret) {
    throw new AppError("WhatsApp webhook no configurado.", 503);
  }

  if (!header?.startsWith("sha256=")) {
    throw new AppError("Firma de webhook no valida.", 401);
  }

  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  if (!safeEqual(header.slice("sha256=".length).toLowerCase(), expected)) {
    throw new AppError("Firma de webhook no valida.", 401);
  }
}

function parseWebhookPayload(rawBody: string): WhatsappWebhookPayload {
  try {
    return JSON.parse(rawBody) as WhatsappWebhookPayload;
  } catch {
    throw new AppError("Payload de webhook no valido.", 400);
  }
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
