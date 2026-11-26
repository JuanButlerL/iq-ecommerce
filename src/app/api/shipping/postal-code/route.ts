import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { routeError, routeOk } from "@/lib/http/route";
import { consumeRateLimit, getRequestIp } from "@/lib/security/rate-limit";
import { ARGENTINA_PROVINCES, normalizeProvinceName } from "@/lib/constants/provinces";

// Provincia y localidades de un código postal (tabla de CP de la logística). Sirve para que el cliente cargue
// solo el CP en el carrito y el checkout complete la provincia, sin adivinar.
function provinceFor(cp: number, raw: string) {
  // El conurbano (1600-1899) tiene su propio precio en la tabla de envíos ("GBA").
  if (cp >= 1000 && cp <= 1499) return "CABA";
  const first = raw.split(",")[0]?.trim() ?? "";
  const normalized = normalizeProvinceName(first);
  if (normalized === "Buenos Aires" && cp >= 1600 && cp <= 1899) return "GBA";
  return ARGENTINA_PROVINCES.find((p) => normalizeProvinceName(p.name) === normalized)?.name ?? null;
}

export async function GET(request: Request) {
  try {
    const allowed = await consumeRateLimit({ scope: "postal-code-ip", identifier: getRequestIp(request), limit: 120, windowSeconds: 10 * 60 });
    if (!allowed) return NextResponse.json({ error: "Demasiadas consultas." }, { status: 429 });
    const cp = (new URL(request.url).searchParams.get("cp") ?? "").replace(/\D/g, "").slice(0, 4);
    if (cp.length !== 4) return NextResponse.json({ error: "Ingresá los 4 números del código postal." }, { status: 400 });
    const rows = await prisma.postalCode.findMany({ where: { postalCode: cp }, select: { province: true, locality: true }, take: 50 });
    if (rows.length === 0) return routeOk({ found: false, province: null, localities: [] });
    const province = provinceFor(Number(cp), rows[0].province);
    const localities = [...new Set(rows.flatMap((r) => r.locality.split(",").map((l) => l.trim())).filter(Boolean))].slice(0, 20);
    return routeOk({ found: true, province, localities });
  } catch (error) {
    return routeError(error);
  }
}
