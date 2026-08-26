import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import nodemailer from "nodemailer";

type SendEmailInput = {
  fromEmail: string;
  senderName: string;
  replyToEmail?: string | null;
  to: string;
  subject: string;
  html: string;
  text: string;
  bccEmail?: string | null;
};

export async function sendEmail(input: SendEmailInput) {
  if (!env.canSendEmail) {
    throw new AppError("El proveedor de emails no esta configurado.", 400, true);
  }

  if (env.EMAIL_PROVIDER === "smtp") {
    return sendSmtpEmail(input);
  }

  return sendResendEmail(input);
}

async function sendResendEmail(input: SendEmailInput) {
  const from = `${input.senderName} <${input.fromEmail}>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyToEmail || env.EMAIL_REPLY_TO_DEFAULT || undefined,
      bcc: input.bccEmail ? [input.bccEmail] : undefined,
    }),
  });
  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string; error?: string } | null;

  if (!response.ok) {
    throw new AppError(payload?.message || payload?.error || "No se pudo enviar el email.", 502, true);
  }

  return {
    providerMessageId: payload?.id ?? null,
  };
}

async function sendSmtpEmail(input: SendEmailInput) {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST || undefined,
    port: env.SMTP_PORT,
    secure: env.isSmtpSecure,
    auth: {
      user: env.SMTP_USER || undefined,
      pass: env.SMTP_PASSWORD || undefined,
    },
  });

  const info = await transporter.sendMail({
    from: `${input.senderName} <${input.fromEmail}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyToEmail || env.EMAIL_REPLY_TO_DEFAULT || undefined,
    bcc: input.bccEmail || undefined,
  });

  return {
    providerMessageId: typeof info.messageId === "string" ? info.messageId : null,
  };
}
