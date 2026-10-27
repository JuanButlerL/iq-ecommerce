import { NextResponse } from "next/server";

import { unsubscribeFromEmail } from "@/features/email/newsletter-service";
import { prisma } from "@/lib/db/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const log = await prisma.emailSendLog.findUnique({
    where: { unsubscribeToken: token },
    select: { recipientEmail: true },
  });

  if (!log) {
    return page("No pudimos validar este enlace", "El enlace no es válido o ya no está disponible.", 404);
  }

  await unsubscribeFromEmail(prisma, log.recipientEmail);

  return page("Listo, ya te dimos de baja", "No vas a recibir más emails de marketing ni automatizaciones de IQ Kids en esta dirección.");
}

function page(title: string, detail: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#fff7ee;font-family:Arial,Helvetica,sans-serif;color:#2d2142"><main style="max-width:560px;margin:12vh auto;padding:24px"><section style="background:#fff;border:1px solid rgba(45,33,66,.1);border-radius:28px;padding:36px"><p style="margin:0 0 10px;color:#f47f8d;font-weight:800;letter-spacing:.12em;font-size:12px">IQ KIDS</p><h1 style="margin:0 0 14px;font-size:30px">${title}</h1><p style="margin:0;line-height:1.6;color:rgba(45,33,66,.72)">${detail}</p></section></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
