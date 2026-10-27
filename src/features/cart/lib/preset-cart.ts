// Shareable "pre-filled cart" links for ads, e.g.
//   /carrito?productos=caja-barritas-mani-x-12,caja-barritas-cacao-x-12:2
// Each entry is a product slug with an optional ":quantity". Unknown, hidden,
// inactive or sold-out products are ignored, and quantities are clamped.

export const PRESET_CART_PARAM = "productos";
const MAX_PRESET_ENTRIES = 10;
const MAX_PRESET_QUANTITY = 20;

type PresetProduct = { id: string; slug: string; active: boolean; visible: boolean; manualSoldOut: boolean };

export function parsePresetCart(raw: string | undefined | null, products: PresetProduct[]) {
  if (!raw) {
    return [];
  }

  const bySlug = new Map(products.map((product) => [product.slug.toLowerCase(), product]));
  const quantities = new Map<string, number>();

  for (const entry of raw.split(",").slice(0, MAX_PRESET_ENTRIES)) {
    const [slugPart, quantityPart] = entry.trim().split(":");
    const product = bySlug.get((slugPart ?? "").trim().toLowerCase());

    if (!product || !product.active || !product.visible || product.manualSoldOut) {
      continue;
    }

    const parsed = Number.parseInt(quantityPart ?? "1", 10);
    const quantity = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_PRESET_QUANTITY) : 1;
    quantities.set(product.id, Math.min((quantities.get(product.id) ?? 0) + quantity, MAX_PRESET_QUANTITY));
  }

  return Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }));
}
