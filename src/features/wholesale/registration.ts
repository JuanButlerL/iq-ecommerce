import { revalidatePath } from "next/cache";
import { Prisma, type WholesaleCustomer, type WholesaleLead } from "@prisma/client";

import { sendEmail } from "@/features/email/provider";
import { getStoreSettings } from "@/features/settings/queries";
import { trustWholesaleCustomer } from "@/features/wholesale/device";
import { toArgentineWhatsappNumber } from "@/features/wholesale/lead-email";
import { isPaymentMethodEnabled } from "@/features/wholesale/orders";
import { WHOLESALE_PAYMENT_METHOD_LABELS } from "@/features/wholesale/pricing";
import { getWholesaleContent } from "@/features/wholesale/queries";
import {
  buildWholesaleRegistrationAdminEmail,
  buildWholesaleRegistrationCustomerEmail,
  type WholesaleRegistrationEmailData,
} from "@/features/wholesale/registration-email";
import { getWholesaleSettings } from "@/features/wholesale/settings";
import { TAX_CONDITION_LABELS } from "@/features/wholesale/tax-condition";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { formatCuit } from "@/lib/utils/cuit";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";
import { wholesaleRegistrationSchema } from "@/lib/validations/wholesale-registration";

const MAX_REGISTRATIONS_PER_IP_PER_HOUR = 5;
const FALLBACK_WHATSAPP = "5491173933235";

type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

// "created": cliente nuevo en el maestro. "existing": ese email + CUIT ya estaba registrado; solo se recuerda el navegador.
export type WholesaleRegistrationResult = { status: "created" | "existing" | "ignored" };

export async function registerWholesaleCustomer(payload: unknown, meta: RequestMeta): Promise<WholesaleRegistrationResult> {
  const parsed = wholesaleRegistrationSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Revisá los datos del formulario.", 400, true);
  }

  const input = parsed.data;

  // Bot: se responde OK para no darle pistas, pero no se guarda nada.
  if (input.website) {
    return { status: "ignored" };
  }

  const existing = await prisma.wholesaleCustomer.findUnique({ where: { cuit: input.cuit } });

  if (existing) {
    if (existing.email !== input.email) {
      throw new AppError("Ese CUIT ya está registrado con otro email. Escribinos por WhatsApp y lo resolvemos.", 409, true);
    }
    if (!existing.active) {
      throw new AppError("Tu cuenta mayorista está pausada. Escribinos por WhatsApp y lo resolvemos.", 403, true);
    }

    await trustWholesaleCustomer(existing.id);
    return { status: "existing" };
  }

  // El registro deja también una consulta (ya como cliente) para conservar el origen, la cantidad estimada y el freno por IP.
  if (meta.ipAddress) {
    const recent = await prisma.wholesaleLead.count({
      where: { ipAddress: meta.ipAddress, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });

    if (recent >= MAX_REGISTRATIONS_PER_IP_PER_HOUR) {
      throw new AppError("Recibimos varios registros seguidos desde tu conexión. Probá de nuevo en un rato o escribinos por WhatsApp.", 429, true);
    }
  }

  let created: { customer: WholesaleCustomer; lead: WholesaleLead };

  try {
    created = await prisma.$transaction(async (tx) => {
      const lead = await tx.wholesaleLead.create({
        data: {
          status: "CLIENT",
          name: input.contactName,
          phone: input.phone,
          email: input.email,
          businessName: input.businessName,
          businessType: input.businessType,
          cuit: input.cuit,
          street: input.street,
          floor: input.floor,
          city: input.city,
          province: input.province,
          postalCode: input.postalCode,
          reference: input.reference,
          monthlyVolume: input.monthlyVolume,
          message: input.message,
          ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
          userAgent: meta.userAgent?.slice(0, 300) ?? null,
        },
      });
      const customer = await tx.wholesaleCustomer.create({
        data: {
          email: input.email,
          phone: input.phone,
          contactName: input.contactName,
          businessName: input.businessName,
          legalName: input.legalName,
          businessType: input.businessType,
          cuit: input.cuit,
          taxCondition: input.taxCondition,
          street: input.street,
          floor: input.floor,
          city: input.city,
          province: input.province,
          postalCode: input.postalCode,
          reference: input.reference,
          leadId: lead.id,
        },
      });

      return { customer, lead };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("Ese CUIT ya está registrado. Escribinos por WhatsApp y lo resolvemos.", 409, true);
    }
    throw error;
  }

  await trustWholesaleCustomer(created.customer.id);
  await notifyWholesaleRegistration(created.customer, created.lead);
  revalidatePath("/admin/mayoristas/clientes", "layout");
  revalidatePath("/admin/mayoristas/consultas");

  return { status: "created" };
}

// Los avisos nunca hacen fallar el registro: si un email no sale, queda en el log y en la consulta.
async function notifyWholesaleRegistration(customer: WholesaleCustomer, lead: WholesaleLead) {
  if (!env.canSendEmail) {
    return;
  }

  const [content, settings, storeSettings] = await Promise.all([getWholesaleContent(), getWholesaleSettings(), getStoreSettings()]);
  const data: WholesaleRegistrationEmailData = {
    contactName: customer.contactName,
    email: customer.email,
    phone: customer.phone,
    businessName: customer.businessName,
    legalName: customer.legalName,
    businessType: customer.businessType,
    cuit: formatCuit(customer.cuit),
    taxConditionLabel: customer.taxCondition ? TAX_CONDITION_LABELS[customer.taxCondition] : "",
    address: [customer.street, customer.floor, customer.city, customer.province, `CP ${customer.postalCode}`].filter(Boolean).join(", "),
    reference: customer.reference,
    monthlyVolume: lead.monthlyVolume,
    message: lead.message,
    createdAt: customer.createdAt,
  };
  const storeWhatsapp = content.whatsappNumber || storeSettings?.whatsappNumber || FALLBACK_WHATSAPP;
  const recipients = content.contact.leadNotificationEmails;
  const customerEmail = buildWholesaleRegistrationCustomerEmail(data, {
    shopUrl: `${env.NEXT_PUBLIC_SITE_URL}/mayoristas#productos`,
    minDisplays: settings.minDisplays,
    paymentMethods: (["MERCADO_PAGO", "BANK_TRANSFER", "ECHEQ"] as const)
      .filter((method) => isPaymentMethodEnabled(method, settings))
      .map((method) => (method === "BANK_TRANSFER" ? "transferencia" : WHOLESALE_PAYMENT_METHOD_LABELS[method])),
    whatsappUrl: buildWhatsappUrl(storeWhatsapp, "Hola! Me acabo de registrar como cliente mayorista de iQ Kids."),
  });
  const adminEmail = buildWholesaleRegistrationAdminEmail(data, {
    adminUrl: `${env.NEXT_PUBLIC_SITE_URL}/admin/mayoristas/clientes/${customer.id}`,
    whatsappUrl: buildWhatsappUrl(toArgentineWhatsappNumber(customer.phone), `Hola ${customer.contactName}! Te escribimos de iQ Kids por tu registro mayorista.`),
  });
  const sends = [
    { to: customer.email, replyTo: recipients[0] ?? null, internal: false, ...customerEmail },
    ...recipients.map((to) => ({ to, replyTo: customer.email, internal: true, ...adminEmail })),
  ];
  const adminErrors: string[] = [];

  for (const message of sends) {
    try {
      await sendEmail({
        fromEmail: env.EMAIL_FROM_DEFAULT,
        senderName: "IQ Kids Mayoristas",
        replyToEmail: message.replyTo ?? undefined,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    } catch (error) {
      console.error("wholesale registration email failed", { to: message.to, error });
      if (message.internal) {
        adminErrors.push(`${message.to}: ${error instanceof Error ? error.message : "error desconocido"}`);
      }
    }
  }

  if (recipients.length > 0) {
    await prisma.wholesaleLead.update({
      where: { id: lead.id },
      data: {
        notifiedAt: adminErrors.length < recipients.length ? new Date() : null,
        notificationError: adminErrors.length > 0 ? adminErrors.join(" | ").slice(0, 500) : null,
      },
    });
  }
}
