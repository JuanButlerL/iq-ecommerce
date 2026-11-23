import { z } from "zod";

import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { applyProductDiscount, summarizeProductLines } from "@/features/catalog/lib/product-discount";
import { formatDispatchDate } from "@/features/logistics/business-days";
import { getBranches, getShippingOptions } from "@/features/logistics/options";
import type { PackageLine } from "@/features/logistics/package";
import { getStoreSettings } from "@/features/settings/queries";
import { getTrustedWholesaleCustomerIds } from "@/features/wholesale/device";
import { buildWholesaleShippingSettings } from "@/features/wholesale/pricing";
import { getWholesaleSettings, getWholesaleShippingRule } from "@/features/wholesale/settings";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { CarrierCode } from "@/lib/integrations/logistics/types";

// Pedido de opciones de envío desde el checkout (tienda o mayoristas). Los productos y precios salen de la base.
export const shippingOptionsRequestSchema = z.object({
  channel: z.enum(["RETAIL", "WHOLESALE"]).default("RETAIL"),
  postalCode: z.string().trim().regex(/^\d{4,8}$/),
  province: z.string().trim().min(2).max(80),
  locality: z.string().trim().max(120).optional().default(""),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional(),
        wholesaleProductId: z.string().uuid().optional(),
        quantity: z.number().int().min(1).max(1000),
        selection: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(1000) })).max(30).optional(),
      }),
    )
    .min(1)
    .max(50),
  wholesaleCustomerId: z.string().uuid().optional(),
});

export type ShippingOptionsRequest = z.infer<typeof shippingOptionsRequestSchema>;

const dims = { weightGrams: true, lengthCm: true, widthCm: true, heightCm: true } as const;

async function retailContext(request: ShippingOptionsRequest) {
  const ids = request.items.map((item) => item.productId).filter((id): id is string => Boolean(id));
  const products = (await prisma.product.findMany({ where: { id: { in: ids }, active: true } })).map((product) => applyProductDiscount(product));
  const lines = request.items.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return product ? [{ ...product, quantity: item.quantity }] : [];
  });
  if (lines.length === 0) throw new AppError("No encontramos los productos del carrito.", 400);
  const totals = summarizeProductLines(lines);
  const settings = await getStoreSettings();
  const fallback = calculateShippingQuote(totals.subtotalArs, request.province, settings);
  return {
    lines: lines.map((line) => ({ quantity: line.quantity, unit: { weightGrams: line.weightGrams, lengthCm: line.lengthCm, widthCm: line.widthCm, heightCm: line.heightCm } })) as PackageLine[],
    declaredValueArs: totals.subtotalArs,
    fallbackPriceArs: fallback.baseShippingArs,
    preferredCarrier: null,
  };
}

async function wholesaleContext(request: ShippingOptionsRequest) {
  const ids = request.items.map((item) => item.wholesaleProductId).filter((id): id is string => Boolean(id));
  const products = await prisma.wholesaleProduct.findMany({
    where: { id: { in: ids }, active: true },
    include: { components: { include: { product: { select: dims } } } },
  });
  const lines: PackageLine[] = [];
  let declaredValueArs = 0;
  for (const item of request.items) {
    const product = products.find((entry) => entry.id === item.wholesaleProductId);
    if (!product) continue;
    declaredValueArs += product.priceArs * item.quantity;
    const chosen = product.kind === "CUSTOM" && item.selection?.length ? item.selection : product.components.filter((c) => c.quantity > 0);
    lines.push({
      quantity: item.quantity,
      unit: { weightGrams: product.weightGrams, lengthCm: product.lengthCm, widthCm: product.widthCm, heightCm: product.heightCm },
      components: chosen.map((component) => {
        const base = product.components.find((entry) => entry.productId === component.productId)?.product;
        return { quantity: component.quantity, unit: { weightGrams: base?.weightGrams ?? null, lengthCm: base?.lengthCm ?? null, widthCm: base?.widthCm ?? null, heightCm: base?.heightCm ?? null } };
      }),
    });
  }
  if (lines.length === 0) throw new AppError("No encontramos los productos del pedido.", 400);
  const [settings, rule] = await Promise.all([getWholesaleSettings(), getWholesaleShippingRule()]);
  const fallback = calculateShippingQuote(declaredValueArs, request.province, buildWholesaleShippingSettings(rule, settings.freeShippingThresholdArs));

  // La logística fija del cliente solo se respeta si este navegador ya se identificó con ese cliente.
  let preferredCarrier = null;
  if (request.wholesaleCustomerId) {
    const trusted = await getTrustedWholesaleCustomerIds();
    if (trusted.includes(request.wholesaleCustomerId)) {
      preferredCarrier = (await prisma.wholesaleCustomer.findUnique({ where: { id: request.wholesaleCustomerId }, select: { preferredCarrier: true } }))?.preferredCarrier ?? null;
    }
  }
  return { lines, declaredValueArs, fallbackPriceArs: fallback.baseShippingArs, preferredCarrier };
}

export async function getCheckoutShippingOptions(request: ShippingOptionsRequest) {
  const context = request.channel === "WHOLESALE" ? await wholesaleContext(request) : await retailContext(request);
  const result = await getShippingOptions({
    channel: request.channel,
    postalCode: request.postalCode,
    province: request.province,
    locality: request.locality,
    ...context,
  });
  if (!result.enabled || result.options.length === 0) return { enabled: false as const };
  return {
    enabled: true as const,
    dispatchDate: result.dispatchDate,
    dispatchDateLabel: formatDispatchDate(result.dispatchDate),
    options: result.options.map((option) => ({
      id: option.id,
      carrier: option.carrier,
      deliveryType: option.deliveryType,
      label: option.label,
      carrierPriceArs: option.carrierPriceArs,
      deliveryDaysMin: option.deliveryDaysMin,
      deliveryDaysMax: option.deliveryDaysMax,
      zoneName: option.zoneName,
      // El navegador no necesita saber si fue en vivo o de respaldo; solo si el precio es estimado.
      estimated: option.priceSource === "FALLBACK",
    })),
  };
}

export async function getCheckoutBranches(carrier: CarrierCode, postalCode: string, province: string) {
  const branches = await getBranches(carrier, postalCode, province);
  return branches.slice(0, 30);
}
