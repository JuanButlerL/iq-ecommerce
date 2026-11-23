import { getAndreaniConfig } from "@/lib/integrations/logistics/config";
import { carrierFetch, TokenCache } from "@/lib/integrations/logistics/http";
import {
  CarrierError,
  type CarrierAdapter,
  type CarrierBranch,
  type CarrierQuote,
  type CreatedShipment,
  type CreateShipmentRequest,
  type QuoteRequest,
} from "@/lib/integrations/logistics/types";

// API de Andreani (apis.andreani.com). Login con usuario y contraseña -> token x-authorization-token (24 h).
// Cotización: GET /v1/tarifas. Sucursales: GET /v2/sucursales. Alta: POST /v2/ordenes-de-envio.
// Etiqueta: GET /v2/ordenes-de-envio/{numeroDeEnvio}/etiquetas (PDF).
// Los nombres de campos siguen la documentación pública de Andreani; validar contra la cuenta real antes del pase.

const NAME = "Andreani";
const QUOTE_TIMEOUT_MS = 4_000;
const CREATE_TIMEOUT_MS = 20_000;
const LABEL_TIMEOUT_MS = 15_000;
const tokenCache = new TokenCache();

function config() {
  return getAndreaniConfig();
}

async function token() {
  const cfg = config();
  if (!cfg.user || !cfg.password) throw new CarrierError("Faltan las credenciales de Andreani.", "NOT_CONFIGURED");

  return tokenCache.get(async () => {
    const response = await carrierFetch(NAME, `${cfg.baseUrl}/login`, {
      headers: { Authorization: `Basic ${Buffer.from(`${cfg.user}:${cfg.password}`).toString("base64")}` },
      timeoutMs: 8_000,
      retryOnce: true,
    });
    const headerToken = response.headers.get("x-authorization-token");
    const bodyToken = (response.json as { token?: unknown } | null)?.token;
    const value = headerToken || (typeof bodyToken === "string" ? bodyToken : "");
    if (!value) throw new CarrierError("Andreani no devolvió el token de acceso.", "RETRYABLE");
    return { token: value, ttlMs: 23 * 60 * 60 * 1000 };
  });
}

async function authed<T>(run: (authToken: string) => Promise<T>): Promise<T> {
  try {
    return await run(await token());
  } catch (error) {
    // Token vencido o revocado: se pide uno nuevo una vez.
    if (error instanceof CarrierError && (error.status === 401 || error.status === 403)) {
      tokenCache.clear();
      return run(await token());
    }
    throw error;
  }
}

function contractFor(deliveryType: QuoteRequest["deliveryType"]) {
  const cfg = config();
  const contract = deliveryType === "BRANCH" ? cfg.contractBranch || cfg.contractHome : cfg.contractHome;
  if (!contract) throw new CarrierError("Falta el número de contrato de Andreani.", "NOT_CONFIGURED");
  return contract;
}

export function volumeCm3(pkg: { lengthCm: number; widthCm: number; heightCm: number }) {
  return Math.max(1, Math.round(pkg.lengthCm * pkg.widthCm * pkg.heightCm));
}

export function parseAndreaniQuote(json: unknown): CarrierQuote {
  const body = (json ?? {}) as Record<string, unknown>;
  const withTax = body.tarifaConIva as Record<string, unknown> | undefined;
  const withoutTax = body.tarifaSinIva as Record<string, unknown> | undefined;
  const total = Number(withTax?.total ?? withoutTax?.total ?? body.total);
  if (!Number.isFinite(total) || total <= 0) {
    throw new CarrierError("Andreani no devolvió una tarifa para ese destino.", "INVALID_DATA", undefined, body);
  }
  return { priceArs: Math.ceil(total), deliveryDaysMin: null, deliveryDaysMax: null };
}

export function parseAndreaniBranches(json: unknown): CarrierBranch[] {
  const list = Array.isArray(json) ? json : Array.isArray((json as { sucursales?: unknown })?.sucursales) ? (json as { sucursales: unknown[] }).sucursales : [];
  return list.flatMap((item) => {
    const b = item as Record<string, unknown>;
    const address = (b.direccion ?? {}) as Record<string, unknown>;
    const extra = (b.datosAdicionales ?? {}) as Record<string, unknown>;
    // Solo las que entregan envíos al público.
    if (extra.seHaceAtencionAlCliente === false || extra.entregaEnvios === false) return [];
    const id = String(b.id ?? b.numero ?? "").trim();
    if (!id) return [];
    const hours = Array.isArray(b.horarioDeAtencion) ? "" : typeof b.horarioDeAtencion === "string" ? b.horarioDeAtencion : "";
    return [
      {
        id,
        name: String(b.descripcion ?? b.nombre ?? `Sucursal ${id}`),
        address: [address.calle, address.numero].filter(Boolean).join(" "),
        locality: String(address.localidad ?? ""),
        province: String(address.provincia ?? address.region ?? ""),
        postalCode: String(address.codigoPostal ?? ""),
        hours: hours || undefined,
      },
    ];
  });
}

export function parseAndreaniCreated(json: unknown): { trackingNumber: string; carrierShipmentId: string; labelReady: boolean } {
  const body = (json ?? {}) as Record<string, unknown>;
  const bultos = Array.isArray(body.bultos) ? (body.bultos as Record<string, unknown>[]) : [];
  const first = bultos[0] ?? {};
  const trackingNumber = String(first.numeroDeEnvio ?? body.numeroDeEnvio ?? body.numeroAndreani ?? "").trim();
  if (!trackingNumber) {
    throw new CarrierError("Andreani aceptó el envío pero no devolvió número de seguimiento.", "AMBIGUOUS", undefined, body);
  }
  const state = String(body.estado ?? "").toLowerCase();
  return {
    trackingNumber,
    carrierShipmentId: String(body.agrupadorDeBultos ?? trackingNumber),
    labelReady: state !== "pendiente",
  };
}

function onlyDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

export function buildAndreaniOrder(request: CreateShipmentRequest, contract: string) {
  const phone = (value: string) => [{ tipo: 1, numero: onlyDigits(value) || value }];
  const postal = (a: CreateShipmentRequest["origin"]) => ({
    codigoPostal: a.postalCode,
    calle: a.street,
    numero: a.number || "S/N",
    localidad: a.locality,
    region: a.province,
    pais: "Argentina",
    ...(a.floor ? { componentesDeDireccion: [{ meta: "piso", contenido: a.floor }] } : {}),
  });

  return {
    contrato: contract,
    origen: { postal: postal(request.origin) },
    destino:
      request.deliveryType === "BRANCH" && request.branchId
        ? { sucursal: { id: request.branchId } }
        : { postal: postal(request.destination) },
    remitente: {
      nombreCompleto: request.sender.fullName,
      email: request.sender.email,
      documentoTipo: "CUIT",
      documentoNumero: onlyDigits(request.sender.taxId),
      telefonos: phone(request.sender.phone),
    },
    destinatario: [
      {
        nombreCompleto: request.recipient.fullName,
        email: request.recipient.email,
        documentoTipo: onlyDigits(request.recipient.taxId).length === 11 ? "CUIT" : "DNI",
        documentoNumero: onlyDigits(request.recipient.taxId),
        telefonos: phone(request.recipient.phone),
      },
    ],
    productoAEntregar: "Alimentos envasados",
    bultos: [
      {
        kilos: Math.max(0.1, Math.round(request.pkg.weightGrams / 10) / 100),
        largoCm: request.pkg.lengthCm,
        anchoCm: request.pkg.widthCm,
        altoCm: request.pkg.heightCm,
        volumenCm: volumeCm3(request.pkg),
        valorDeclaradoConImpuestos: Math.round(request.pkg.declaredValueArs),
        referencias: [
          { meta: "idCliente", contenido: request.reference },
          ...(request.notes ? [{ meta: "observaciones", contenido: request.notes.slice(0, 120) }] : []),
        ],
      },
    ],
  };
}

export const andreaniAdapter: CarrierAdapter = {
  code: "ANDREANI",

  isConfigured() {
    const cfg = config();
    // Sin número de cliente Andreani no cotiza ("Contrato, cliente y codigo postal de destino son parametros requeridos").
    return Boolean(cfg.user && cfg.password && cfg.contractHome && cfg.clientNumber);
  },

  async quote(request) {
    const cfg = config();
    const params = new URLSearchParams({
      cpDestino: request.destinationPostalCode,
      contrato: contractFor(request.deliveryType),
      ...(cfg.clientNumber ? { cliente: cfg.clientNumber } : {}),
      ...(cfg.originBranch ? { sucursalOrigen: cfg.originBranch } : {}),
      "bultos[0][valorDeclarado]": String(Math.round(request.pkg.declaredValueArs)),
      "bultos[0][volumen]": String(volumeCm3(request.pkg)),
      "bultos[0][kilos]": String(Math.max(0.1, Math.round(request.pkg.weightGrams / 10) / 100)),
    });
    const response = await authed((authToken) =>
      carrierFetch(NAME, `${cfg.baseUrl}/v1/tarifas?${params.toString()}`, {
        headers: { "x-authorization-token": authToken },
        timeoutMs: QUOTE_TIMEOUT_MS,
        retryOnce: true,
      }),
    );
    return parseAndreaniQuote(response.json);
  },

  async branches(postalCode) {
    const cfg = config();
    const response = await authed((authToken) =>
      carrierFetch(NAME, `${cfg.baseUrl}/v2/sucursales?codigoPostal=${encodeURIComponent(postalCode)}`, {
        headers: { "x-authorization-token": authToken },
        timeoutMs: QUOTE_TIMEOUT_MS,
        retryOnce: true,
      }),
    );
    return parseAndreaniBranches(response.json);
  },

  async createShipment(request) {
    const cfg = config();
    const body = buildAndreaniOrder(request, contractFor(request.deliveryType));
    const response = await authed((authToken) =>
      carrierFetch(NAME, `${cfg.baseUrl}/v2/ordenes-de-envio`, {
        method: "POST",
        headers: { "x-authorization-token": authToken },
        body,
        timeoutMs: CREATE_TIMEOUT_MS,
        creates: true,
      }),
    );
    const created = parseAndreaniCreated(response.json);
    const label = created.labelReady ? await this.fetchLabel(created).catch(() => null) : null;
    return { trackingNumber: created.trackingNumber, carrierShipmentId: created.carrierShipmentId, label, raw: response.json };
  },

  // La API pública no ofrece buscar órdenes por nuestra referencia: un alta ambigua queda para revisar a mano.
  async findByReference(): Promise<CreatedShipment | null> {
    return null;
  },

  async fetchLabel(created) {
    const cfg = config();
    const response = await authed((authToken) =>
      carrierFetch(NAME, `${cfg.baseUrl}/v2/ordenes-de-envio/${encodeURIComponent(created.trackingNumber)}/etiquetas`, {
        headers: { "x-authorization-token": authToken },
        timeoutMs: LABEL_TIMEOUT_MS,
        retryOnce: true,
        responseType: "binary",
      }),
    );
    if (response.binary && response.binary.length > 100) return { contentType: "application/pdf", data: response.binary };
    // Algunas cuentas devuelven la etiqueta en base64 dentro de un JSON.
    const encoded = (response.json as { pdf?: unknown; etiqueta?: unknown } | null)?.pdf ?? (response.json as { etiqueta?: unknown } | null)?.etiqueta;
    if (typeof encoded === "string" && encoded.length > 100) return { contentType: "application/pdf", data: Buffer.from(encoded, "base64") };
    return null;
  },
};
