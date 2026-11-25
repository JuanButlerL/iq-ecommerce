import { getCorreoConfig } from "@/lib/integrations/logistics/config";
import { carrierFetch, TokenCache } from "@/lib/integrations/logistics/http";
import {
  CarrierError,
  type CarrierAdapter,
  type CarrierBranch,
  type CarrierQuote,
  type CreatedShipment,
  type CreateShipmentRequest,
} from "@/lib/integrations/logistics/types";
import { ARGENTINA_PROVINCES, normalizeProvinceName } from "@/lib/constants/provinces";

// API MiCorreo de Correo Argentino. Token: POST /token con Basic. Cotización: POST /rates.
// Sucursales: GET /agencies. Alta: POST /shipping/import (el envío queda en MiCorreo; el número de
// seguimiento se consulta después con /shipping/tracking). Validar campos contra la cuenta real antes del pase.

const NAME = "Correo Argentino";
const QUOTE_TIMEOUT_MS = 4_000;
const CREATE_TIMEOUT_MS = 20_000;
const tokenCache = new TokenCache();
let customerIdCache: string | null = null;

function config() {
  return getCorreoConfig();
}

async function token() {
  const cfg = config();
  if (!cfg.user || !cfg.password) throw new CarrierError("Faltan las credenciales de Correo Argentino.", "NOT_CONFIGURED");
  return tokenCache.get(async () => {
    const response = await carrierFetch(NAME, `${cfg.baseUrl}/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${cfg.user}:${cfg.password}`).toString("base64")}` },
      timeoutMs: 8_000,
      retryOnce: true,
    });
    // La API devuelve "expire" (el manual dice "expires"): se aceptan los dos. Hora de Argentina.
    const body = (response.json ?? {}) as { token?: unknown; expires?: unknown; expire?: unknown };
    if (typeof body.token !== "string" || !body.token) throw new CarrierError("Correo Argentino no devolvió el token.", "RETRYABLE");
    const rawExpiry = typeof body.expire === "string" ? body.expire : typeof body.expires === "string" ? body.expires : "";
    const expires = rawExpiry ? Date.parse(rawExpiry.replace(" ", "T") + "-03:00") : NaN;
    return { token: body.token, ttlMs: Number.isFinite(expires) ? Math.max(60_000, expires - Date.now()) : 60 * 60 * 1000 };
  });
}

async function authed<T>(run: (authToken: string) => Promise<T>): Promise<T> {
  try {
    return await run(await token());
  } catch (error) {
    if (error instanceof CarrierError && (error.status === 401 || error.status === 403)) {
      tokenCache.clear();
      return run(await token());
    }
    throw error;
  }
}

async function customerId() {
  const cfg = config();
  if (cfg.customerId) return cfg.customerId;
  if (customerIdCache) return customerIdCache;
  if (!cfg.accountEmail || !cfg.accountPassword) {
    throw new CarrierError("Falta el customerId de MiCorreo (o el email y contraseña de la cuenta).", "NOT_CONFIGURED");
  }
  const response = await authed((authToken) =>
    carrierFetch(NAME, `${cfg.baseUrl}/users/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
      body: { email: cfg.accountEmail, password: cfg.accountPassword },
      timeoutMs: 8_000,
      retryOnce: true,
    }),
  );
  const id = (response.json as { customerId?: unknown } | null)?.customerId;
  if (typeof id !== "string" || !id) throw new CarrierError("MiCorreo no devolvió el customerId.", "NOT_CONFIGURED");
  customerIdCache = id;
  return id;
}

export function provinceCode(province: string) {
  const normalized = normalizeProvinceName(province);
  if (normalized === "GBA") return "B";
  return ARGENTINA_PROVINCES.find((p) => normalizeProvinceName(p.name) === normalized)?.code ?? "";
}

export function parseCorreoRates(json: unknown, deliveryType: "D" | "S"): CarrierQuote {
  const rates = Array.isArray((json as { rates?: unknown })?.rates) ? ((json as { rates: unknown[] }).rates as Record<string, unknown>[]) : [];
  const matching = rates.filter((r) => String(r.deliveredType ?? "").toUpperCase() === deliveryType && Number(r.price) > 0);
  // Se toma el servicio clásico (el más barato) si hay varios.
  const best = matching.sort((a, b) => Number(a.price) - Number(b.price))[0];
  if (!best) throw new CarrierError("Correo Argentino no devolvió una tarifa para ese destino.", "INVALID_DATA", undefined, json);
  const min = Number(best.deliveryTimeMin);
  const max = Number(best.deliveryTimeMax);
  return {
    priceArs: Math.ceil(Number(best.price)),
    deliveryDaysMin: Number.isFinite(min) ? min : null,
    deliveryDaysMax: Number.isFinite(max) ? max : null,
  };
}

export function parseCorreoAgencies(json: unknown, postalCode: string): CarrierBranch[] {
  const list = Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
  const branches = list.flatMap((item) => {
    const location = (item.location ?? {}) as Record<string, unknown>;
    const address = (location.address ?? {}) as Record<string, unknown>;
    const services = (item.services ?? {}) as Record<string, unknown>;
    if (String(item.status ?? "ACTIVE").toUpperCase() !== "ACTIVE") return [];
    if (services.pickupAvailability === false) return [];
    const id = String(item.code ?? "").trim();
    if (!id) return [];
    return [
      {
        id,
        name: String(item.name ?? id),
        address: [address.streetName, address.streetNumber].filter(Boolean).join(" "),
        locality: String(address.locality ?? address.city ?? ""),
        province: String(address.province ?? ""),
        postalCode: String(address.postalCode ?? ""),
        hours: formatAgencyHours(item.hours),
      },
    ];
  });
  // /agencies trae toda la provincia (ej. 340 en Santa Fe) con CP en formato CPA ("S2000ABC"): se ordenan por
  // cercanía del CP de 4 números al del cliente, así las de su ciudad quedan primero.
  const target = Number(String(postalCode).replace(/\D/g, "").slice(0, 4));
  const cp4 = (value: string) => Number((String(value).match(/\d{4}/) ?? ["99999"])[0]);
  return branches
    .map((branch) => ({ branch, distance: Number.isFinite(target) ? Math.abs(cp4(branch.postalCode) - target) : 0 }))
    .sort((a, b) => a.distance - b.distance)
    .map(({ branch }) => branch);
}

// { monday: { start: "0930", end: "1800" }, ... } -> "Lun a vie 9:30 a 18:00"
export function formatAgencyHours(hours: unknown) {
  if (!hours || typeof hours !== "object") return undefined;
  const h = hours as Record<string, { start?: string; end?: string } | null>;
  const fmt = (v?: string) => (v && v.length === 4 ? Number(v.slice(0, 2)) + ":" + v.slice(2) : "");
  const weekday = h.monday ?? h.tuesday ?? h.friday;
  if (!weekday?.start || !weekday.end) return undefined;
  const sat = h.saturday?.start && h.saturday.end ? " · sáb " + fmt(h.saturday.start) + " a " + fmt(h.saturday.end) : "";
  return "Lun a vie " + fmt(weekday.start) + " a " + fmt(weekday.end) + sat;
}

function onlyDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

export function buildCorreoImport(request: CreateShipmentRequest, customer: string) {
  const addr = (a: CreateShipmentRequest["origin"]) => ({
    streetName: a.street,
    streetNumber: a.number || "S/N",
    floor: a.floor ?? "",
    apartment: "",
    city: a.locality,
    provinceCode: provinceCode(a.province),
    postalCode: a.postalCode,
  });
  const isBranch = request.deliveryType === "BRANCH" && request.branchId;
  return {
    customerId: customer,
    extOrderId: request.reference,
    orderNumber: request.reference,
    sender: {
      name: request.sender.fullName,
      phone: onlyDigits(request.sender.phone),
      cellPhone: onlyDigits(request.sender.phone),
      email: request.sender.email,
      originAddress: addr(request.origin),
    },
    recipient: {
      name: request.recipient.fullName,
      phone: onlyDigits(request.recipient.phone),
      cellPhone: onlyDigits(request.recipient.phone),
      email: request.recipient.email,
    },
    shipping: {
      deliveryType: isBranch ? "S" : "D",
      productType: "CP",
      ...(isBranch ? { agency: request.branchId } : { address: addr(request.destination) }),
      weight: Math.max(1, Math.round(request.pkg.weightGrams)),
      declaredValue: Math.round(request.pkg.declaredValueArs),
      height: request.pkg.heightCm,
      length: request.pkg.lengthCm,
      width: request.pkg.widthCm,
    },
  };
}

export const correoArgentinoAdapter: CarrierAdapter = {
  code: "CORREO_AR",
  // MiCorreo rechaza importar dos veces el mismo extOrderId: reintentar un alta ambigua no duplica.
  idempotentCreate: true,

  isConfigured() {
    const cfg = config();
    return Boolean(cfg.user && cfg.password && (cfg.customerId || (cfg.accountEmail && cfg.accountPassword)));
  },

  async quote(request) {
    const cfg = config();
    const type = request.deliveryType === "BRANCH" ? "S" : "D";
    const response = await authed(async (authToken) =>
      carrierFetch(NAME, `${cfg.baseUrl}/rates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          customerId: await customerId(),
          postalCodeOrigin: request.originPostalCode,
          postalCodeDestination: request.destinationPostalCode,
          deliveredType: type,
          dimensions: {
            weight: Math.max(1, Math.round(request.pkg.weightGrams)),
            height: request.pkg.heightCm,
            width: request.pkg.widthCm,
            length: request.pkg.lengthCm,
          },
        },
        timeoutMs: QUOTE_TIMEOUT_MS,
        // Cotizar no crea nada: se puede repetir.
        retryOnce: true,
      }),
    );
    return parseCorreoRates(response.json, type);
  },

  async branches(postalCode, province) {
    const cfg = config();
    const code = provinceCode(province);
    if (!code) return [];
    const response = await authed(async (authToken) =>
      carrierFetch(NAME, `${cfg.baseUrl}/agencies?customerId=${encodeURIComponent(await customerId())}&provinceCode=${code}`, {
        headers: { Authorization: `Bearer ${authToken}` },
        timeoutMs: 6_000,
        retryOnce: true,
      }),
    );
    return parseCorreoAgencies(response.json, postalCode);
  },

  async createShipment(request) {
    const cfg = config();
    const body = buildCorreoImport(request, await customerId());
    let response;
    try {
      response = await authed((authToken) =>
        carrierFetch(NAME, `${cfg.baseUrl}/shipping/import`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
          body,
          timeoutMs: CREATE_TIMEOUT_MS,
          creates: true,
        }),
      );
    } catch (error) {
      // Un intento anterior ya lo importó (la respuesta se había perdido): cuenta como creado.
      if (error instanceof CarrierError && /ya fue importada/i.test(error.message)) {
        return { trackingNumber: request.reference, carrierShipmentId: request.reference, label: null, raw: { alreadyImported: true } };
      }
      throw error;
    }
    const json = (response.json ?? {}) as Record<string, unknown>;
    // MiCorreo no devuelve el número al importar: se usa la referencia hasta tenerlo.
    const tracking = String(json.trackingNumber ?? json.shippingId ?? "").trim();
    return { trackingNumber: tracking || request.reference, carrierShipmentId: request.reference, label: null, raw: json };
  },

  // No hace falta buscar: reimportar el mismo pedido devuelve "ya fue importada" y se toma como creado.
  async findByReference(): Promise<CreatedShipment | null> {
    return null;
  },

  // MiCorreo no entrega la etiqueta por API: se imprime desde el panel de MiCorreo.
  async fetchLabel() {
    return null;
  },
};
