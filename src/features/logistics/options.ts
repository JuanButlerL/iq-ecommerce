import type { SalesChannel, ShippingCarrier, ShippingDeliveryType, ShippingPriceSource } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { computeDispatchDate, type DateKey } from "@/features/logistics/business-days";
import { computePackage, quoteBucket, type ComputedPackage, type PackageLine } from "@/features/logistics/package";
import { carrierAvailability, getDefaultWarehouse, getHolidayCalendar, getShippingSettings, type ShippingSettingsData } from "@/features/logistics/settings";
import { getCarrierAdapter } from "@/lib/integrations/logistics";
import type { CarrierBranch, CarrierCode } from "@/lib/integrations/logistics/types";

export const CARRIER_LABELS: Record<ShippingCarrier, string> = {
  OWN: "Reparto IQ Kids",
  ANDREANI: "Andreani",
  CORREO_AR: "Correo Argentino",
};

export type ShippingOption = {
  id: string;
  carrier: ShippingCarrier;
  deliveryType: ShippingDeliveryType;
  label: string;
  // Precio del transportista o de la zona, antes de envío gratis y descuentos.
  carrierPriceArs: number;
  priceSource: ShippingPriceSource;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  zoneName: string | null;
};

export type ShippingOptionsResult =
  | { enabled: false }
  | {
      enabled: true;
      options: ShippingOption[];
      dispatchDate: DateKey;
      // El CP no está en la tabla y no hay transportistas: se cobra con la tabla por provincia.
      postalCodeKnown: boolean;
    };

export type ShippingOptionsInput = {
  channel: SalesChannel;
  postalCode: string;
  province: string;
  locality?: string;
  lines: PackageLine[];
  declaredValueArs: number;
  // Logística fija del cliente mayorista (vacío = la decide la tabla de CP).
  preferredCarrier?: ShippingCarrier | null;
  // Precio de envío fijo del cliente mayorista: reemplaza el de la zona o el transportista.
  customerShippingPriceArs?: number | null;
  // Precio de la tabla por provincia, para cuando no hay ninguna cotización.
  fallbackPriceArs: number;
  now?: Date;
};

export function optionId(carrier: ShippingCarrier, deliveryType: ShippingDeliveryType) {
  return `${carrier}:${deliveryType}`;
}

function normalizePostalCode(value: string) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 4);
}

export async function findOwnZone(postalCode: string, locality?: string) {
  const cp = normalizePostalCode(postalCode);
  if (!cp) return null;
  const rows = await prisma.postalCode.findMany({
    where: { postalCode: cp, ownZoneId: { not: null }, ownZone: { active: true } },
    include: { ownZone: true },
  });
  if (rows.length === 0) return null;
  const wanted = (locality ?? "").trim().toLowerCase();
  const match = rows.find((row) => row.locality.trim().toLowerCase() === wanted) ?? rows[0];
  return match.ownZone;
}

async function postalCodeExists(postalCode: string) {
  const cp = normalizePostalCode(postalCode);
  if (!cp) return false;
  return (await prisma.postalCode.count({ where: { postalCode: cp } })) > 0;
}

type CachedQuote = { priceArs: number; deliveryDaysMin: number | null; deliveryDaysMax: number | null; source: ShippingPriceSource };

// Cotización con la API, guardada por `quoteCacheHours`. Si la API falla se usa la última guardada aunque
// esté vieja; si nunca hubo, el precio de la tabla por provincia.
export async function quoteWithCache(
  carrier: CarrierCode,
  deliveryType: ShippingDeliveryType,
  destination: { postalCode: string; province: string },
  pkg: ComputedPackage,
  declaredValueArs: number,
  originPostalCode: string,
  settings: ShippingSettingsData,
  fallbackPriceArs: number,
): Promise<CachedQuote> {
  const cp = normalizePostalCode(destination.postalCode);
  const bucket = quoteBucket(pkg);
  const cacheKey = [carrier, deliveryType, cp, bucket.weight, bucket.volume].join("|");
  const cached = await prisma.shippingQuoteCache.findUnique({ where: { cacheKey } });
  const freshUntil = cached ? cached.fetchedAt.getTime() + settings.quoteCacheHours * 3_600_000 : 0;

  if (cached && Date.now() < freshUntil) {
    return { priceArs: cached.priceArs, deliveryDaysMin: cached.deliveryDaysMin, deliveryDaysMax: cached.deliveryDaysMax, source: "CACHED" };
  }

  try {
    // Se cotiza con el peso redondeado hacia arriba, así la cotización guardada sirve para todo el rango.
    const quote = await getCarrierAdapter(carrier).quote({
      originPostalCode,
      destinationPostalCode: cp,
      destinationProvince: destination.province,
      deliveryType,
      pkg: { ...pkg, declaredValueArs },
    });
    await prisma.shippingQuoteCache.upsert({
      where: { cacheKey },
      update: { priceArs: quote.priceArs, deliveryDaysMin: quote.deliveryDaysMin, deliveryDaysMax: quote.deliveryDaysMax, fetchedAt: new Date() },
      create: {
        cacheKey,
        carrier,
        deliveryType,
        postalCode: cp,
        priceArs: quote.priceArs,
        deliveryDaysMin: quote.deliveryDaysMin,
        deliveryDaysMax: quote.deliveryDaysMax,
        fetchedAt: new Date(),
      },
    });
    return { ...quote, source: "LIVE" };
  } catch (error) {
    console.error(`[logistica] cotización ${carrier} ${deliveryType} CP ${cp} falló`, error instanceof Error ? error.message : error);
    if (cached) {
      return { priceArs: cached.priceArs, deliveryDaysMin: cached.deliveryDaysMin, deliveryDaysMax: cached.deliveryDaysMax, source: "CACHED" };
    }
    return { priceArs: fallbackPriceArs, deliveryDaysMin: null, deliveryDaysMax: null, source: "FALLBACK" };
  }
}

export async function getShippingOptions(input: ShippingOptionsInput): Promise<ShippingOptionsResult> {
  const result = await computeShippingOptions(input);
  const fixed = input.customerShippingPriceArs;
  if (!result.enabled || fixed === null || fixed === undefined || fixed < 0) return result;
  return {
    ...result,
    options: result.options.map((option) => ({ ...option, carrierPriceArs: fixed, priceSource: "CUSTOMER" as ShippingPriceSource })),
  };
}

async function computeShippingOptions(input: ShippingOptionsInput): Promise<ShippingOptionsResult> {
  const settings = await getShippingSettings();
  if (!settings.enabled) return { enabled: false };

  const calendar = await getHolidayCalendar();
  const dispatchDate = computeDispatchDate(input.now ?? new Date(), settings, calendar);
  const options: ShippingOption[] = [];
  const zone = settings.ownEnabled ? await findOwnZone(input.postalCode, input.locality) : null;
  const ownOption = (priceArs: number, source: ShippingPriceSource, zoneName: string | null, days?: { min: number; max: number }) =>
    ({
      id: optionId("OWN", "HOME"),
      carrier: "OWN",
      deliveryType: "HOME",
      label: CARRIER_LABELS.OWN,
      carrierPriceArs: priceArs,
      priceSource: source,
      deliveryDaysMin: days?.min ?? null,
      deliveryDaysMax: days?.max ?? null,
      zoneName,
    }) satisfies ShippingOption;

  const zonePrice = zone ? (input.channel === "WHOLESALE" ? zone.wholesalePriceArs ?? zone.priceArs : zone.priceArs) : null;

  // 1. Cliente mayorista con reparto propio habilitado: va primero y también puede elegir Andreani/Correo.
  if (input.preferredCarrier === "OWN") {
    options.push(
      zone
        ? ownOption(zonePrice ?? 0, "OWN_ZONE", zone.name, { min: zone.deliveryDaysMin, max: zone.deliveryDaysMax })
        : ownOption(input.fallbackPriceArs, "FALLBACK", null),
    );
  }

  // 2. CP de reparto propio.
  if (zone && (!input.preferredCarrier || input.preferredCarrier === "OWN")) {
    if (input.preferredCarrier === "OWN") return { enabled: true, options, dispatchDate, postalCodeKnown: true };
    options.push(ownOption(zonePrice ?? 0, "OWN_ZONE", zone.name, { min: zone.deliveryDaysMin, max: zone.deliveryDaysMax }));
    return { enabled: true, options, dispatchDate, postalCodeKnown: true };
  }

  // 3. Andreani y Correo.
  const availability = carrierAvailability(settings);
  const carriers: CarrierCode[] = (["ANDREANI", "CORREO_AR"] as CarrierCode[]).filter(
    (code) => availability[code] && (!input.preferredCarrier || input.preferredCarrier === "OWN" || input.preferredCarrier === code),
  );
  const warehouse = await getDefaultWarehouse();
  const pkg = computePackage(input.lines, settings);
  const types: ShippingDeliveryType[] = settings.branchPickupEnabled ? ["HOME", "BRANCH"] : ["HOME"];

  // Precio por tabla (elegido en Admin > Logística): se cobra la tabla por provincia de siempre y no se
  // consulta la API para el precio; la elección de transportista y sucursal funciona igual.
  if (settings.carrierPricing !== "LIVE") {
    options.push(
      ...carriers.flatMap((carrier) =>
        types.map(
          (deliveryType) =>
            ({
              id: optionId(carrier, deliveryType),
              carrier,
              deliveryType,
              label: `${CARRIER_LABELS[carrier]} · ${deliveryType === "BRANCH" ? "retiro en sucursal" : "a domicilio"}`,
              carrierPriceArs: input.fallbackPriceArs,
              priceSource: "LEGACY",
              deliveryDaysMin: null,
              deliveryDaysMax: null,
              zoneName: null,
            }) satisfies ShippingOption,
        ),
      ),
    );
    return { enabled: true, options, dispatchDate, postalCodeKnown: Boolean(zone) || (await postalCodeExists(input.postalCode)) };
  }

  const quotes = await Promise.all(
    carriers.flatMap((carrier) =>
      types.map(async (deliveryType) => {
        const quote = await quoteWithCache(
          carrier,
          deliveryType,
          { postalCode: input.postalCode, province: input.province },
          pkg,
          input.declaredValueArs,
          warehouse?.postalCode ?? "",
          settings,
          input.fallbackPriceArs,
        );
        // La cotización del transportista más llevar el paquete hasta él. El precio de respaldo (tabla por
        // provincia) ya es un precio al cliente: no lleva recargo.
        const surcharge = quote.source === "FALLBACK" ? 0 : carrier === "ANDREANI" ? settings.andreaniSurchargeArs : settings.correoSurchargeArs;
        // Descuento del contrato de Andreani que la API no trae aplicado (configurable en el admin).
        const discountPct = quote.source !== "FALLBACK" && carrier === "ANDREANI" ? Math.min(90, Math.max(0, settings.andreaniDiscountPct)) : 0;
        const carrierPrice = Math.round(quote.priceArs * (1 - discountPct / 100));
        return {
          id: optionId(carrier, deliveryType),
          carrier,
          deliveryType,
          label: `${CARRIER_LABELS[carrier]} · ${deliveryType === "BRANCH" ? "retiro en sucursal" : "a domicilio"}`,
          carrierPriceArs: carrierPrice + Math.max(0, surcharge),
          priceSource: quote.source,
          deliveryDaysMin: quote.deliveryDaysMin,
          deliveryDaysMax: quote.deliveryDaysMax,
          zoneName: null,
        } satisfies ShippingOption;
      }),
    ),
  );
  // Sin cotización real, el retiro en sucursal no se ofrece (no sabemos si hay sucursal cerca).
  options.push(...quotes.filter((option) => option.deliveryType === "HOME" || option.priceSource !== "FALLBACK"));

  return { enabled: true, options, dispatchDate, postalCodeKnown: Boolean(zone) || (await postalCodeExists(input.postalCode)) };
}

// Valida lo que eligió el cliente contra las opciones calculadas en el servidor.
export function pickOption(result: ShippingOptionsResult, selection: { carrier?: string | null; deliveryType?: string | null }) {
  if (!result.enabled) return null;
  if (result.options.length === 0) return null;
  const wanted = selection.carrier && selection.deliveryType ? `${selection.carrier}:${selection.deliveryType}` : null;
  const found = wanted ? result.options.find((option) => option.id === wanted) : null;
  // Sin elección (o una que ya no está), la primera: reparto propio o Andreani a domicilio.
  return found ?? (result.options.length === 1 || !wanted ? result.options[0] : null);
}

export async function getBranches(carrier: CarrierCode, postalCode: string, province: string): Promise<CarrierBranch[]> {
  const cp = normalizePostalCode(postalCode);
  const cacheKey = `${carrier}|${cp}|${province}`;
  const cached = await prisma.shippingBranchCache.findUnique({ where: { cacheKey } });
  // Las sucursales cambian poco: se guardan una semana.
  if (cached && Date.now() - cached.fetchedAt.getTime() < 7 * 24 * 3_600_000) {
    return cached.branches as unknown as CarrierBranch[];
  }
  try {
    const branches = await getCarrierAdapter(carrier).branches(cp, province);
    await prisma.shippingBranchCache.upsert({
      where: { cacheKey },
      update: { branches: branches as unknown as object, fetchedAt: new Date() },
      create: { cacheKey, carrier, branches: branches as unknown as object, fetchedAt: new Date() },
    });
    return branches;
  } catch (error) {
    console.error(`[logistica] sucursales ${carrier} CP ${cp} fallaron`, error instanceof Error ? error.message : error);
    return cached ? (cached.branches as unknown as CarrierBranch[]) : [];
  }
}
