import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export const ADMIN_SESSION_COOKIE = "iqkids_admin_session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function sign(value: string) {
  return createHmac("sha256", env.ADMIN_SESSION_SECRET ?? "").update(value).digest("hex");
}

function secureCompare(left?: string, right?: string) {
  if (!left || !right) {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createLocalAdminSessionValue(email: string) {
  const payload = `${email}:${sign(email)}`;
  return Buffer.from(payload).toString("base64url");
}

export function verifyLocalAdminSessionValue(sessionValue?: string | null) {
  if (!sessionValue) {
    return null;
  }

  try {
    const decoded = Buffer.from(sessionValue, "base64url").toString("utf8");
    const separatorIndex = decoded.lastIndexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    const email = decoded.slice(0, separatorIndex);
    const providedSignature = decoded.slice(separatorIndex + 1);
    const expectedSignature = sign(email);
    const providedBuffer = Buffer.from(providedSignature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer) ||
      email !== env.ADMIN_LOCAL_EMAIL
    ) {
      return null;
    }

    return { email };
  } catch {
    return null;
  }
}

export async function getLocalAdminSession() {
  const cookieStore = await cookies();
  return verifyLocalAdminSessionValue(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export function verifyLocalAdminCredentials(email?: string, password?: string) {
  if (!env.ADMIN_LOCAL_EMAIL || !env.ADMIN_LOCAL_PASSWORD) {
    return false;
  }

  return secureCompare(email, env.ADMIN_LOCAL_EMAIL) && secureCompare(password, env.ADMIN_LOCAL_PASSWORD);
}

export function setLocalAdminSessionCookie(response: NextResponse, email: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, createLocalAdminSessionValue(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
}

export function clearLocalAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
