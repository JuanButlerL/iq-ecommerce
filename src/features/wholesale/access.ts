import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import type { WholesaleContent } from "@/features/wholesale/content";
import { env } from "@/lib/env";

// Acceso con contraseña a /mayoristas. La contraseña se guarda como "scrypt$<salt>$<hash>" en el contenido
// de la página; la cookie guarda un HMAC de ese hash, así que cambiar la contraseña invalida los accesos.

export const WHOLESALE_ACCESS_COOKIE = "iq_wholesale_access";
export const WHOLESALE_ACCESS_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function hashWholesalePassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyWholesalePassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function buildWholesaleAccessToken(passwordHash: string) {
  return createHmac("sha256", `${env.ADMIN_SESSION_SECRET ?? ""}:wholesale-access`).update(passwordHash).digest("hex");
}

function sameToken(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export async function hasWholesaleAccess(content: Pick<WholesaleContent, "accessPasswordHash">) {
  if (!content.accessPasswordHash) {
    return true;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(WHOLESALE_ACCESS_COOKIE)?.value;
  return Boolean(token && sameToken(token, buildWholesaleAccessToken(content.accessPasswordHash)));
}

// Freno simple a la fuerza bruta: intentos fallidos por IP en memoria del proceso.
const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILED_ATTEMPTS = 8;
const FAILED_WINDOW_MS = 10 * 60 * 1000;

export function isWholesaleAccessBlocked(ip: string) {
  const entry = failedAttempts.get(ip);
  if (!entry || entry.resetAt < Date.now()) {
    failedAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
}

export function registerWholesaleAccessFailure(ip: string) {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    failedAttempts.set(ip, { count: 1, resetAt: now + FAILED_WINDOW_MS });
    return;
  }
  entry.count += 1;
}
