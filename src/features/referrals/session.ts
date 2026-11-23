import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

export const REFERRAL_SESSION_COOKIE = "iqkids_ref_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSessionKey() {
  if (env.REFERRAL_SESSION_SECRET) {
    return env.REFERRAL_SESSION_SECRET;
  }

  if (!env.ADMIN_SESSION_SECRET) {
    return null;
  }

  // Separate key from the admin cookie even when both come from the same secret.
  return createHmac("sha256", env.ADMIN_SESSION_SECRET).update("iqkids-referral-session-v1").digest("hex");
}

export function isReferralSessionConfigured() {
  return Boolean(getSessionKey());
}

function sign(payload: string) {
  const key = getSessionKey();

  if (!key) {
    throw new Error("Referral session secret is not configured.");
  }

  return createHmac("sha256", key).update(payload).digest("base64url");
}

function buildSessionValue(accountId: string, sessionVersion: number) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${accountId}.${sessionVersion}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function parseSessionValue(value?: string | null) {
  if (!value || !getSessionKey()) {
    return null;
  }

  const parts = value.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const [accountId, version, expiresAt, signature] = parts;
  const expected = Buffer.from(sign(`${accountId}.${version}.${expiresAt}`));
  const provided = Buffer.from(signature);

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  if (!/^[0-9a-f-]{36}$/.test(accountId) || Number(expiresAt) * 1000 < Date.now()) {
    return null;
  }

  return { accountId, sessionVersion: Number(version) };
}

/** The signed-in referral account, or null. Blocked accounts and old session versions are rejected. */
export async function getReferralSessionAccount() {
  const cookieStore = await cookies();
  const session = parseSessionValue(cookieStore.get(REFERRAL_SESSION_COOKIE)?.value);

  if (!session) {
    return null;
  }

  const account = await prisma.referralAccount.findUnique({ where: { id: session.accountId } });

  if (!account || account.status === "BLOCKED" || account.sessionVersion !== session.sessionVersion) {
    return null;
  }

  return account;
}

export function setReferralSessionCookie(response: NextResponse, account: { id: string; sessionVersion: number }) {
  response.cookies.set(REFERRAL_SESSION_COOKIE, buildSessionValue(account.id, account.sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearReferralSessionCookie(response: NextResponse) {
  response.cookies.set(REFERRAL_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function generateLoginToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashLoginToken(token) };
}

export function hashLoginToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
