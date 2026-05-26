export function buildMetaPurchaseEventId(orderNumber: string) {
  return `purchase:${orderNumber}`;
}
