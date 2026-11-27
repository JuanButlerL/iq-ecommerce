import { Prisma } from "@prisma/client";

import { sendEmail } from "@/features/email/provider";
import { buildWholesaleOrderCustomerEmail, type WholesaleOrderEmailData } from "@/features/wholesale/order-email";
import { getWholesaleSettings } from "@/features/wholesale/settings";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

// Mail "Recibimos tu pedido mayorista" al cliente: una sola vez, cuando el pago está confirmado o el
// comprobante subido. Nunca hace fallar el pago ni la subida del comprobante.
export async function sendWholesaleCustomerConfirmation(orderId: string) {
  try {
    if (!env.canSendEmail) return false;
    // Se reserva antes de mandar: si dos avisos llegan juntos, sale un solo mail.
    const claimed = await prisma.order.updateMany({
      where: { id: orderId, channel: "WHOLESALE", customerConfirmationSentAt: null, wholesaleEmailPayload: { not: Prisma.DbNull } },
      data: { customerConfirmationSentAt: new Date() },
    });
    if (claimed.count === 0) return false;
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { publicOrderNumber: true, wholesaleEmailPayload: true } });
    const raw = order?.wholesaleEmailPayload as (Omit<WholesaleOrderEmailData, "createdAt"> & { createdAt: string }) | null;
    if (!order || !raw) return false;
    const data: WholesaleOrderEmailData = { ...raw, createdAt: new Date(raw.createdAt) };
    const settings = await getWholesaleSettings();
    const email = buildWholesaleOrderCustomerEmail(data, { orderUrl: `${env.NEXT_PUBLIC_SITE_URL}/mayoristas/pedido/${order.publicOrderNumber}` });
    await sendEmail({
      fromEmail: env.EMAIL_FROM_DEFAULT,
      senderName: "IQ Kids Mayoristas",
      replyToEmail: settings.orderNotificationEmails[0] ?? undefined,
      to: data.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    return true;
  } catch (error) {
    console.error("wholesale customer confirmation email failed", { orderId, error });
    return false;
  }
}
