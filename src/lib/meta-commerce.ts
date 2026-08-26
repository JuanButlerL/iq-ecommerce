export type MetaCommerceItem = {
  id: string;
  name: string;
  quantity: number;
  itemPrice: number;
};

type MetaPurchaseDataInput = {
  orderNumber: string;
  totalArs: number;
  shippingArs: number;
  items: MetaCommerceItem[];
};

export function getProductsValue(totalArs: number, shippingArs: number) {
  return Math.max(0, totalArs - shippingArs);
}

export function buildMetaPurchaseData({ orderNumber, totalArs, shippingArs, items }: MetaPurchaseDataInput) {
  return {
    currency: "ARS",
    value: getProductsValue(totalArs, shippingArs),
    order_id: orderNumber,
    content_type: "product",
    content_ids: items.map((item) => item.id),
    content_name: [...new Set(items.map((item) => item.name))].join(", "),
    contents: items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      item_price: item.itemPrice,
    })),
    num_items: items.reduce((total, item) => total + item.quantity, 0),
  };
}
