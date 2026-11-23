import { createHash } from "node:crypto";

import { prisma } from "@/lib/db/prisma";

type RateLimitRule = {
  // Short name of what is limited, e.g. "referral-login-ip".
  scope: string;
  // Who is limited: an IP, a DNI... It is hashed before it is stored.
  identifier: string;
  limit: number;
  windowSeconds: number;
};

function bucketKey(rule: RateLimitRule, windowIndex: number) {
  const hashedIdentifier = createHash("sha256").update(`${rule.scope}:${rule.identifier}`).digest("hex").slice(0, 32);
  return `${rule.scope}:${hashedIdentifier}:${windowIndex}`;
}

/**
 * Fixed-window counter stored in Postgres, so it survives restarts and deploys. Returns true while
 * the caller is inside the limit; every call counts as one hit.
 */
export async function consumeRateLimit(rule: RateLimitRule) {
  const windowMs = rule.windowSeconds * 1000;
  const windowIndex = Math.floor(Date.now() / windowMs);
  const key = bucketKey(rule, windowIndex);
  const expiresAt = new Date((windowIndex + 1) * windowMs);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO rate_limit_buckets (key, count, expires_at)
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT (key) DO UPDATE SET count = rate_limit_buckets.count + 1
    RETURNING count
  `;

  // Old buckets are cleaned up now and then; there is no cron for it.
  if (Math.random() < 0.02) {
    await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => undefined);
  }

  return (rows[0]?.count ?? 1) <= rule.limit;
}

/** Checks every rule (all of them count the hit) and tells whether all are inside their limit. */
export async function consumeRateLimits(rules: RateLimitRule[]) {
  const results = await Promise.all(rules.map((rule) => consumeRateLimit(rule)));
  return results.every(Boolean);
}

export function getRequestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/**
 * State-changing public endpoints only accept requests from our own pages. Browsers always send
 * Origin on POST; a missing header (curl, server-to-server) is allowed because the session cookie
 * is SameSite=Lax and those clients do not carry it.
 */
export function isSameOriginRequest(request: Request, siteUrl: string) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    const allowed = new Set([new URL(siteUrl).origin, new URL(request.url).origin]);
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}
