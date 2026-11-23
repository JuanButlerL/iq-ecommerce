import type { SalesChannel, ShippingCarrier } from "@prisma/client";
import { getBranches, getShippingOptions, pickOption, type ShippingOption } from "@/features/logistics/options";
import type { DateKey } from "@/features/logistics/business-days";
import type { PackageLine } from "@/features/logistics/package";
import { AppError } from "@/lib/errors/app-error";
import type { CarrierBranch, CarrierCode } from "@/lib/integrations/logistics/types";

import type { ShippingSelection } from "@/features/logistics/selection";

export { shippingSelectionSchema, type ShippingSelection } from "@/features/logistics/selection";

export type ResolvedCheckoutShipping =
  | { enabled: false }
  | {
      enabled: true;
      option: ShippingOption;
      branch: CarrierBranch | null;
      dispatchDate: DateKey;
    };

export async function resolveCheckoutShipping(input: {
  channel: SalesChannel;
  postalCode: string;
  province: string;
  locality: string;
  lines: PackageLine[];
  declaredValueArs: number;
  fallbackPriceArs: number;
  preferredCarrier?: ShippingCarrier | null;
  selection?: ShippingSelection | null;
}): Promise<ResolvedCheckoutShipping> {
  const result = await getShippingOptions(input);
  if (!result.enabled) return { enabled: false };
  if (result.options.length === 0) {
    // Integración prendida pero sin transportistas disponibles: se sigue como antes.
    return { enabled: false };
  }

  const option = pickOption(result, input.selection ?? {});
  if (!option) {
    throw new AppError("Elegí de nuevo cómo querés recibir el pedido: cambiaron las opciones de envío.", 409);
  }

  let branch: CarrierBranch | null = null;
  if (option.deliveryType === "BRANCH") {
    const branchId = input.selection?.branchId?.trim();
    if (!branchId) throw new AppError("Elegí la sucursal donde vas a retirar el pedido.", 400);
    const branches = await getBranches(option.carrier as CarrierCode, input.postalCode, input.province);
    branch = branches.find((item) => item.id === branchId) ?? null;
    if (!branch) throw new AppError("La sucursal elegida ya no está disponible. Elegí otra.", 409);
  }

  return { enabled: true, option, branch, dispatchDate: result.dispatchDate };
}

// "Av. Corrientes 1234" -> { street: "Av. Corrientes", number: "1234" }. Para los pedidos mayoristas,
// que cargan calle y altura en un solo campo.
export function splitStreetNumber(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  const match = text.match(/^(.*?)[\s,]+(\d{1,6}(?:\s*(?:bis|[a-z]))?)(?:\s.*)?$/i);
  if (!match || !match[1]) return { street: text, number: "" };
  return { street: match[1].trim(), number: match[2].trim() };
}
