import type { SyncProvider } from "@prisma/client";

export type OrderSheetRow = {
  order_id: string;
  public_order_number: string;
  fecha_hora: string;
  estado: string;
  payment_status: string;
  customer_first_name: string;
  customer_last_name: string;
  email: string;
  telefono: string;
  dni_cuit: string;
  provincia: string;
  localidad: string;
  codigo_postal: string;
  direccion: string;
  direccion_extra: string;
  observaciones: string;
  cupon: string;
  porcentaje_descuento: number;
  descuento: number;
  subtotal: number;
  envio: number;
  total: number;
  medio_pago: string;
  comprobante_url: string;
  fuente: string;
  created_at: string;
};

export type OrderItemSheetRow = {
  order_item_id: string;
  order_id: string;
  product_id: string;
  producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal_item: number;
};

export type OrderSyncPayload = {
  provider: SyncProvider;
  order: OrderSheetRow;
  items: OrderItemSheetRow[];
};

export type OrderSyncResult = {
  success: boolean;
  provider: SyncProvider;
  requestPayload: OrderSyncPayload;
  responsePayload?: unknown;
  errorMessage?: string;
};

export interface OrderSyncProvider {
  readonly provider: SyncProvider;
  syncOrder(payload: OrderSyncPayload): Promise<OrderSyncResult>;
}
