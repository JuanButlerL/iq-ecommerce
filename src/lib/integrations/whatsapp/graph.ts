import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";

type GraphRequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  token?: string;
  query?: Record<string, string>;
  body?: unknown;
};

type GraphErrorPayload = {
  error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
};

export async function graphRequest<T>(path: string, { method = "GET", token, query, body }: GraphRequestOptions = {}) {
  const version = /^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_API_VERSION) ? env.WHATSAPP_GRAPH_API_VERSION : "v25.0";
  const url = new URL(`https://graph.facebook.com/${version}/${path.replace(/^\//, "")}`);

  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as T & GraphErrorPayload;

  if (!response.ok || payload.error) {
    const error = payload.error;
    const detail = [error?.code ? `code ${error.code}` : null, error?.error_subcode ? `subcode ${error.error_subcode}` : null, error?.fbtrace_id ? `trace ${error.fbtrace_id}` : null]
      .filter(Boolean)
      .join(", ");

    throw new AppError(`Meta: ${error?.message ?? `HTTP ${response.status}`}${detail ? ` (${detail})` : ""}`, 502);
  }

  return payload as T;
}

export function exchangeCodeForBusinessToken(code: string) {
  if (!env.WHATSAPP_APP_ID || !env.WHATSAPP_APP_SECRET) {
    throw new AppError("Faltan WHATSAPP_APP_ID o WHATSAPP_APP_SECRET.", 503);
  }

  return graphRequest<{ access_token: string }>("oauth/access_token", {
    query: { client_id: env.WHATSAPP_APP_ID, client_secret: env.WHATSAPP_APP_SECRET, code },
  });
}
