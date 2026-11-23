import type { ShippingCarrier, ShippingDeliveryType } from "@prisma/client";

export type CarrierCode = Extract<ShippingCarrier, "ANDREANI" | "CORREO_AR">;

export type PackageSpec = {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  declaredValueArs: number;
};

export type QuoteRequest = {
  originPostalCode: string;
  destinationPostalCode: string;
  destinationProvince: string;
  deliveryType: ShippingDeliveryType;
  branchId?: string | null;
  pkg: PackageSpec;
};

export type CarrierQuote = {
  priceArs: number;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
};

export type CarrierBranch = {
  id: string;
  name: string;
  address: string;
  locality: string;
  province: string;
  postalCode: string;
  hours?: string;
};

export type AddressSpec = {
  street: string;
  number: string;
  floor?: string | null;
  locality: string;
  province: string;
  postalCode: string;
};

export type PersonSpec = {
  fullName: string;
  email: string;
  phone: string;
  taxId?: string | null;
};

export type CreateShipmentRequest = {
  // Referencia única del pedido: se manda al transportista para poder encontrar el envío si una respuesta se pierde.
  reference: string;
  deliveryType: ShippingDeliveryType;
  branchId?: string | null;
  sender: PersonSpec;
  origin: AddressSpec;
  recipient: PersonSpec;
  destination: AddressSpec;
  pkg: PackageSpec;
  notes?: string | null;
};

export type CreatedShipment = {
  trackingNumber: string;
  carrierShipmentId: string;
  // PDF de la etiqueta, si el transportista la devuelve.
  label?: { contentType: string; data: Buffer } | null;
  raw: unknown;
};

// Errores clasificados para decidir si se reintenta.
export type CarrierErrorKind =
  // Seguro que no se creó nada (sin conexión, 5xx antes de crear, auth): se reintenta.
  | "RETRYABLE"
  // Datos que el transportista rechaza (CP inválido, dirección): no sirve reintentar igual.
  | "INVALID_DATA"
  // Puede que se haya creado (timeout después de enviar): hay que buscar por referencia antes de reintentar.
  | "AMBIGUOUS"
  // Falta configuración (credenciales, contrato).
  | "NOT_CONFIGURED";

export class CarrierError extends Error {
  constructor(
    message: string,
    readonly kind: CarrierErrorKind,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CarrierError";
  }
}

export interface CarrierAdapter {
  readonly code: CarrierCode;
  isConfigured(): boolean;
  quote(request: QuoteRequest): Promise<CarrierQuote>;
  branches(postalCode: string, province: string): Promise<CarrierBranch[]>;
  createShipment(request: CreateShipmentRequest): Promise<CreatedShipment>;
  // Busca un envío ya creado con nuestra referencia. null = no existe (o el transportista no permite buscar).
  findByReference(reference: string): Promise<CreatedShipment | null>;
  fetchLabel(created: { trackingNumber: string; carrierShipmentId: string }): Promise<{ contentType: string; data: Buffer } | null>;
  cancelShipment?(created: { trackingNumber: string; carrierShipmentId: string }): Promise<void>;
}
