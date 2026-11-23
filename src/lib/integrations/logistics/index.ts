import { andreaniAdapter } from "@/lib/integrations/logistics/andreani";
import { correoArgentinoAdapter } from "@/lib/integrations/logistics/correo-argentino";
import type { CarrierAdapter, CarrierCode } from "@/lib/integrations/logistics/types";

const adapters: Record<CarrierCode, CarrierAdapter> = {
  ANDREANI: andreaniAdapter,
  CORREO_AR: correoArgentinoAdapter,
};

// Para tests: se reemplazan los adaptadores por falsos.
let overrides: Partial<Record<CarrierCode, CarrierAdapter>> = {};

export function getCarrierAdapter(code: CarrierCode): CarrierAdapter {
  return overrides[code] ?? adapters[code];
}

export function setCarrierAdaptersForTest(next: Partial<Record<CarrierCode, CarrierAdapter>>) {
  overrides = next;
}
