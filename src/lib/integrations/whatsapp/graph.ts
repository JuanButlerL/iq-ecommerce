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

export class MetaGraphError extends AppError {
  readonly code?: number;
  readonly subcode?: number;

  constructor(message: string, code?: number, subcode?: number) {
    super(message, 502);
    this.name = "MetaGraphError";
    this.code = code;
    this.subcode = subcode;
  }
}

// Meta: "Error validating verification code ... redirect_uri" (code 100, subcode 36008).
export const REDIRECT_URI_MISMATCH_SUBCODE = 36008;

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

    throw new MetaGraphError(
      `Meta: ${error?.message ?? `HTTP ${response.status}`}${detail ? ` (${detail})` : ""}`,
      error?.code,
      error?.error_subcode,
    );
  }

  return payload as T;
}

function assertAppCredentials() {
  if (!env.WHATSAPP_APP_ID || !env.WHATSAPP_APP_SECRET) {
    throw new AppError("Faltan WHATSAPP_APP_ID o WHATSAPP_APP_SECRET.", 503);
  }

  return { appId: env.WHATSAPP_APP_ID, appSecret: env.WHATSAPP_APP_SECRET };
}

// redirectUri undefined omits the parameter; "" sends it empty. The code is bound to the
// redirect_uri the JS SDK used in the OAuth dialog, which the server can't see.
export function exchangeCodeForBusinessToken(code: string, redirectUri?: string) {
  const { appId, appSecret } = assertAppCredentials();

  return graphRequest<{ access_token: string }>("oauth/access_token", {
    query: {
      client_id: appId,
      client_secret: appSecret,
      code,
      ...(redirectUri === undefined ? {} : { redirect_uri: redirectUri }),
    },
  });
}

// WABAs the business token was granted on, for when the signup session message never arrives.
export async function getTokenWabaIds(token: string) {
  const { appId, appSecret } = assertAppCredentials();
  const result = await graphRequest<{ data?: { granular_scopes?: Array<{ scope: string; target_ids?: string[] }> } }>("debug_token", {
    query: { input_token: token, access_token: `${appId}|${appSecret}` },
  });
  const scope = result.data?.granular_scopes?.find((entry) => entry.scope === "whatsapp_business_management");

  return scope?.target_ids ?? [];
}
