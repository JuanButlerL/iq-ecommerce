import { CarrierError } from "@/lib/integrations/logistics/types";

export type CarrierHttpOptions = {
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
  // true solo para lecturas: si falla por red o 5xx se repite una vez.
  retryOnce?: boolean;
  // Para errores de un POST que crea algo: un timeout es ambiguo (puede haberse creado).
  creates?: boolean;
  responseType?: "json" | "binary";
};

export type CarrierHttpResponse = {
  status: number;
  headers: Headers;
  json: unknown;
  binary: Buffer | null;
};

const SECRET_KEYS = /pass|token|authorization|secret|apikey|api_key/i;

// Copia sin credenciales, para guardar en la base.
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEYS.test(k) ? "[oculto]" : redact(v, depth + 1)]),
  );
}

export async function carrierFetch(carrierName: string, url: string, options: CarrierHttpOptions): Promise<CarrierHttpResponse> {
  const attempts = options.retryOnce ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await doFetch(carrierName, url, options);
    } catch (error) {
      lastError = error;
      if (!(error instanceof CarrierError) || error.kind !== "RETRYABLE" || attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  throw lastError;
}

async function doFetch(carrierName: string, url: string, options: CarrierHttpOptions): Promise<CarrierHttpResponse> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: options.responseType === "binary" ? "application/pdf, application/octet-stream, */*" : "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const message = `${carrierName} no respondió${isTimeout ? ` en ${Math.round(options.timeoutMs / 1000)} s` : ""}: ${error instanceof Error ? error.message : String(error)}`;
    // Un timeout después de mandar un POST que crea es ambiguo; un error de conexión antes de mandar, no,
    // pero fetch no distingue bien los dos casos: se trata todo error de red en un POST que crea como ambiguo.
    throw new CarrierError(message, options.creates ? "AMBIGUOUS" : "RETRYABLE");
  }

  const contentType = response.headers.get("content-type") ?? "";
  let json: unknown = null;
  let binary: Buffer | null = null;

  if (options.responseType === "binary" && response.ok && !contentType.includes("json")) {
    binary = Buffer.from(await response.arrayBuffer());
  } else {
    const text = await response.text().catch(() => "");
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text.slice(0, 2000);
    }
  }

  if (!response.ok) {
    const detail = extractMessage(json);
    const message = `${carrierName} respondió ${response.status}${detail ? `: ${detail}` : ""}`;
    if (response.status === 401 || response.status === 403) throw new CarrierError(message, "RETRYABLE", response.status, redact(json));
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      // Un 5xx en un POST que crea también puede haber creado el envío.
      throw new CarrierError(message, options.creates && response.status !== 429 ? "AMBIGUOUS" : "RETRYABLE", response.status, redact(json));
    }
    throw new CarrierError(message, "INVALID_DATA", response.status, redact(json));
  }

  return { status: response.status, headers: response.headers, json, binary };
}

function extractMessage(json: unknown): string {
  if (!json) return "";
  if (typeof json === "string") return json.slice(0, 300);
  if (typeof json !== "object") return String(json);
  const body = json as Record<string, unknown>;
  for (const key of ["detail", "message", "mensaje", "error", "title", "descripcion"]) {
    if (typeof body[key] === "string" && body[key]) return String(body[key]).slice(0, 300);
  }
  if (Array.isArray(body.errors) || Array.isArray(body.errores)) {
    return JSON.stringify(body.errors ?? body.errores).slice(0, 300);
  }
  return JSON.stringify(redact(json)).slice(0, 300);
}

// Token en memoria por proceso, renovado antes de vencer.
export class TokenCache {
  private token: string | null = null;
  private expiresAt = 0;
  private pending: Promise<string> | null = null;

  async get(fetcher: () => Promise<{ token: string; ttlMs: number }>): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) return this.token;
    if (this.pending) return this.pending;
    this.pending = fetcher()
      .then(({ token, ttlMs }) => {
        this.token = token;
        // Se renueva un minuto antes.
        this.expiresAt = Date.now() + Math.max(30_000, ttlMs - 60_000);
        return token;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }

  clear() {
    this.token = null;
    this.expiresAt = 0;
  }
}
