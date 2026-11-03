import { after } from "next/server";
import type { WholesaleCustomer } from "@prisma/client";

import { sendEmail } from "@/features/email/provider";
import { getStoreSettings } from "@/features/settings/queries";
import { buildWholesaleNewDeviceEmail, describeUserAgent } from "@/features/wholesale/new-device-email";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { getWholesaleSettings } from "@/features/wholesale/settings";
import { env } from "@/lib/env";
import { formatCuit } from "@/lib/utils/cuit";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";

const FALLBACK_WHATSAPP = "5491173933235";

// Se manda cuando un navegador nuevo se identifica con email + CUIT, después de responder (no demora ni hace fallar
// la identificación). Solo se puede llamar dentro de un request.
export function sendWholesaleNewDeviceNotice(
  customer: Pick<WholesaleCustomer, "email" | "contactName" | "businessName" | "legalName" | "cuit">,
  request: { userAgent: string | null },
) {
  after(() => sendNotice(customer, request));
}

async function sendNotice(
  customer: Pick<WholesaleCustomer, "email" | "contactName" | "businessName" | "legalName" | "cuit">,
  request: { userAgent: string | null },
) {
  if (!env.canSendEmail) {
    return;
  }

  try {
    const [content, settings, storeSettings] = await Promise.all([getWholesaleContent(), getWholesaleSettings(), getStoreSettings()]);
    const whatsapp = content.whatsappNumber || storeSettings?.whatsappNumber || FALLBACK_WHATSAPP;
    const email = buildWholesaleNewDeviceEmail(
      {
        contactName: customer.contactName,
        businessName: customer.businessName || customer.legalName,
        cuit: formatCuit(customer.cuit),
        device: describeUserAgent(request.userAgent),
        createdAt: new Date(),
      },
      { whatsappUrl: buildWhatsappUrl(whatsapp, "Hola! Me llegó un aviso de ingreso a mi cuenta mayorista que no reconozco.") },
    );

    await sendEmail({
      fromEmail: env.EMAIL_FROM_DEFAULT,
      senderName: "IQ Kids Mayoristas",
      replyToEmail: settings.orderNotificationEmails[0] ?? content.contact.leadNotificationEmails[0] ?? undefined,
      to: customer.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  } catch (error) {
    console.error("wholesale new device notice failed", { to: customer.email, error });
  }
}
