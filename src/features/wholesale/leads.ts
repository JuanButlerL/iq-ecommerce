import { revalidatePath } from "next/cache";
import type { WholesaleLead, WholesaleLeadStatus } from "@prisma/client";

import { sendEmail } from "@/features/email/provider";
import { buildWholesaleLeadEmail, toArgentineWhatsappNumber } from "@/features/wholesale/lead-email";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";
import { wholesaleLeadSchema, wholesaleLeadUpdateSchema } from "@/lib/validations/wholesale-lead";

const MAX_LEADS_PER_IP_PER_HOUR = 5;

type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

export async function createWholesaleLead(payload: unknown, meta: RequestMeta) {
  const parsed = wholesaleLeadSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Revisá los datos del formulario.", 400, true);
  }

  const input = parsed.data;

  // Bot: se responde OK para no darle pistas, pero no se guarda nada.
  if (input.website) {
    return { id: null };
  }

  if (meta.ipAddress) {
    const recent = await prisma.wholesaleLead.count({
      where: { ipAddress: meta.ipAddress, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });

    if (recent >= MAX_LEADS_PER_IP_PER_HOUR) {
      throw new AppError("Recibimos varias consultas seguidas desde tu conexión. Probá de nuevo en un rato o escribinos por WhatsApp.", 429, true);
    }
  }

  const lead = await prisma.wholesaleLead.create({
    data: {
      name: input.nombre,
      phone: input.telefono,
      email: input.email,
      businessName: input.negocio,
      businessType: input.tipo,
      cuit: input.cuit,
      street: input.calle,
      floor: input.piso,
      city: input.ciudad,
      province: input.provincia,
      postalCode: input.cp,
      reference: input.zona,
      monthlyVolume: input.cantidad,
      message: input.mensaje,
      ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
  });

  await notifyWholesaleLead(lead);
  revalidatePath("/admin/mayoristas/consultas");

  return { id: lead.id };
}

// El aviso nunca hace fallar la consulta: si el email no sale, queda registrado en la consulta.
async function notifyWholesaleLead(lead: WholesaleLead) {
  const content = await getWholesaleContent();
  const recipients = content.contact.leadNotificationEmails;

  if (recipients.length === 0) {
    return;
  }

  const { subject, html, text } = buildWholesaleLeadEmail(lead, {
    adminUrl: `${env.NEXT_PUBLIC_SITE_URL}/admin/mayoristas/consultas`,
    whatsappUrl: buildWhatsappUrl(toArgentineWhatsappNumber(lead.phone), `Hola ${lead.name}! Te escribimos de iQ Kids por tu consulta de venta mayorista.`),
  });
  const errors: string[] = [];

  for (const to of recipients) {
    try {
      await sendEmail({
        fromEmail: env.EMAIL_FROM_DEFAULT,
        senderName: "IQ Kids Mayoristas",
        replyToEmail: lead.email,
        to,
        subject,
        html,
        text,
      });
    } catch (error) {
      console.error("wholesale lead notification failed", { to, error });
      errors.push(`${to}: ${error instanceof Error ? error.message : "error desconocido"}`);
    }
  }

  await prisma.wholesaleLead.update({
    where: { id: lead.id },
    data: {
      notifiedAt: errors.length < recipients.length ? new Date() : null,
      notificationError: errors.length > 0 ? errors.join(" | ").slice(0, 500) : null,
    },
  });
}

export async function getWholesaleLeads(status?: WholesaleLeadStatus) {
  return prisma.wholesaleLead.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function getWholesaleLeadCounts() {
  const groups = await prisma.wholesaleLead.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(groups.map((group) => [group.status, group._count._all])) as Partial<Record<WholesaleLeadStatus, number>>;
}

export async function updateWholesaleLead(id: string, payload: unknown) {
  const parsed = wholesaleLeadUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Datos inválidos.", 400, true);
  }

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new AppError("La consulta no existe.", 404, true);
  }

  const { count } = await prisma.wholesaleLead.updateMany({
    where: { id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.adminNotes !== undefined ? { adminNotes: parsed.data.adminNotes || null } : {}),
    },
  });

  if (count === 0) {
    throw new AppError("La consulta no existe o fue eliminada.", 404, true);
  }

  revalidatePath("/admin/mayoristas/consultas");
}
