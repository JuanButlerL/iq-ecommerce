import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

// "Dispositivo recordado": cookie firmada con los clientes mayoristas que ya se identificaron en este navegador
// (con email + CUIT, o al registrarse). Con ella el checkout precarga los datos sin volver a pedir el CUIT.

const WHOLESALE_DEVICE_COOKIE = "iq_wholesale_device";
const WHOLESALE_DEVICE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
const WHOLESALE_PURCHASE_ONLY_SECONDS = 12 * 60 * 60;
const MAX_TRUSTED_CUSTOMERS = 10;

function sign(payload: string) {
  return createHmac("sha256", `${env.ADMIN_SESSION_SECRET ?? ""}:wholesale-device`).update(payload).digest("base64url");
}

// En producción, sin secreto propio no se recuerda ningún navegador (la identificación avisa que no puede validar la cuenta).
export function canRememberWholesaleDevices() {
  return env.canSignWholesaleDevices;
}

function parse(value: string | undefined): string[] {
  if (!value || !canRememberWholesaleDevices()) return [];

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
// Con remember: false el cliente no aceptó guardar sus datos: la cookie solo sirve para confirmar esta compra,
// vence sola y deja de recordar a cualquier otro cliente de este navegador.
export async function trustWholesaleCustomer(customerId: string, { remember = true }: { remember?: boolean } = {}) {
  if (!canRememberWholesaleDevices()) {
    console.error("wholesale device not remembered: ADMIN_SESSION_SECRET is missing or uses the example value");
    return;
  }

  const cookieStore = await cookies();
  const current = remember ? parse(cookieStore.get(WHOLESALE_DEVICE_COOKIE)?.value).filter((id) => id !== customerId) : [];
  const ids = [customerId, ...current].slice(0, MAX_TRUSTED_CUSTOMERS);
  const lifetimeSeconds = remember ? WHOLESALE_DEVICE_MAX_AGE_SECONDS : WHOLESALE_PURCHASE_ONLY_SECONDS;
  const payload = Buffer.from(JSON.stringify({ ids, exp: Date.now() + lifetimeSeconds * 1000 })).toString("base64url");

  cookieStore.set(WHOLESALE_DEVICE_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NEXT_PUBLIC_SITE_URL.startsWith("https://"),
    path: "/",
    // Sin maxAge es una cookie de sesión: se borra al cerrar el navegador.
    ...(remember ? { maxAge: WHOLESALE_DEVICE_MAX_AGE_SECONDS } : {}),
  });
}
