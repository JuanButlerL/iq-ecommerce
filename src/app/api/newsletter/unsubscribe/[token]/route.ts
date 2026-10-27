import { NextResponse } from "next/server";

import { unsubscribeFromEmail } from "@/features/email/newsletter-service";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

type RouteContext = { params: Promise<{ token: string }> };

// Same global opt-out as the automation emails: it also stops automations.
//
// GET only shows a confirmation button. Some mail security scanners (e.g. Outlook
// Safe Links) open every link in an email; if GET unsubscribed, people would be
// removed without ever clicking. The actual opt-out happens on POST:
// - the button on that page (form post), which answers with a friendly page;
// - RFC 8058 one-click from Gmail/Yahoo via the List-Unsubscribe header.

async function findDelivery(token: string) {
  if (!token || token.length > 120) {
    return null;
  }

  return prisma.newsletterDelivery.findUnique({ where: { unsubscribeToken: token }, select: { recipientEmail: true } });
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const delivery = await findDelivery(token);

  if (!delivery) {
    return page({ title: "No pudimos validar este enlace", detail: "El enlace no es válido o ya no está disponible.", status: 404 });
  }

  return page({
    title: "¿Querés dejar de recibir la newsletter?",
    detail: "Vas a dejar de recibir la newsletter y los emails automáticos de IQ Kids en esta dirección.",
    form: { action: `/api/newsletter/unsubscribe/${encodeURIComponent(token)}`, label: "Sí, darme de baja" },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const delivery = await findDelivery(token);
  const isFormConfirmation = (request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded") && (await request.clone().text()).includes("confirm=1");

  if (!delivery) {
    return isFormConfirmation
      ? page({ title: "No pudimos validar este enlace", detail: "El enlace no es válido o ya no está disponible.", status: 404 })
      : new NextResponse(null, { status: 404 });
  }

  await unsubscribeFromEmail(prisma, delivery.recipientEmail);

  return isFormConfirmation
    ? page({ title: "Listo, ya te dimos de baja", detail: "No vas a recibir más la newsletter ni los emails automáticos de IQ Kids en esta dirección." })
    : new NextResponse(null, { status: 200 });
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function page({ title, detail, status = 200, form }: { title: string; detail: string; status?: number; form?: { action: string; label: string } }) {
  const home = escapeHtml(env.NEXT_PUBLIC_SITE_URL);
  const button = form
    ? `<form method="post" action="${escapeHtml(form.action)}"><input type="hidden" name="confirm" value="1" /><button type="submit" style="border:0;cursor:pointer;display:inline-block;background:#F48991;color:#fff;border-radius:999px;padding:14px 26px;font-weight:800;font-size:15px;font-family:inherit">${escapeHtml(form.label)}</button></form><p style="margin:18px 0 0"><a href="${home}" style="color:#6f6680;font-size:14px">No, volver a la tienda</a></p>`
    : `<a href="${home}" style="display:inline-block;background:#F48991;color:#fff;text-decoration:none;border-radius:999px;padding:14px 26px;font-weight:800">Ir a la tienda</a>`;

  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#FFF4F5;font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#2c2241"><main style="max-width:560px;margin:12vh auto;padding:36px 28px;background:#fff;border-radius:32px;box-shadow:0 12px 30px rgba(44,34,65,.08);text-align:center"><p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#F48991">IQ Kids</p><h1 style="margin:0 0 12px;font-size:28px;line-height:1.2">${escapeHtml(title)}</h1><p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#6f6680">${escapeHtml(detail)}</p>${button}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
