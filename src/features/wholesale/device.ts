import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

// "Dispositivo recordado": cookie firmada con los clientes mayoristas que ya se identificaron en este navegador
// (con email + CUIT, o al registrarse). Con ella el checkout precarga los datos sin volver a pedir el CUIT.

const WHOLESALE_DEVICE_COOKIE = "iq_wholesale_device";
const WHOLESALE_DEVICE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
const MAX_TRUSTED_CUSTOMERS = 10;

function sign(payload: string) {
  return createHmac("sha256", `${env.ADMIN_SESSION_SECRET ?? ""}:wholesale-device`).update(payload).digest("base64url");
}

function parse(value: string | undefined): string[] {
  if (!value) return [];

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return [];

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return [];

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { ids?: unknown; exp?: unknown };
    if (typeof data.exp !== "number" || data.exp < Date.now() || !Array.isArray(data.ids)) return [];
    return data.ids.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export async function getTrustedWholesaleCustomerIds() {
  const cookieStore = await cookies();
  return parse(cookieStore.get(WHOLESALE_DEVICE_COOKIE)?.value);
}

// Solo se puede llamar desde route handlers o server actions (escribe la cookie).
export async function trustWholesaleCustomer(customerId: string) {
  const cookieStore = await cookies();
  const current = parse(cookieStore.get(WHOLESALE_DEVICE_COOKIE)?.value).filter((id) => id !== customerId);
  const ids = [customerId, ...current].slice(0, MAX_TRUSTED_CUSTOMERS);
  const payload = Buffer.from(JSON.stringify({ ids, exp: Date.now() + WHOLESALE_DEVICE_MAX_AGE_SECONDS * 1000 })).toString("base64url");

  cookieStore.set(WHOLESALE_DEVICE_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NEXT_PUBLIC_SITE_URL.startsWith("https://"),
    path: "/",
    maxAge: WHOLESALE_DEVICE_MAX_AGE_SECONDS,
  });
}
