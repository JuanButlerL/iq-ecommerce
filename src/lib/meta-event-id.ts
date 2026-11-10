export function buildMetaPurchaseEventId(orderNumber: string) {
  return `purchase:${orderNumber}`;
}

// El navegador y el servidor mandan la misma compra mayorista con este id para que Meta la cuente una vez.
export function buildWholesaleMetaPurchaseEventId(orderNumber: string) {
  return `purchase-mayorista:${orderNumber}`;
}
