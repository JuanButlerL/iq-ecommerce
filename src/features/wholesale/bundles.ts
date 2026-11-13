// Bultos mayoristas: un producto mayorista siempre se compone de displays de la tienda (banana, cacao, maní, mix…).
// Sin dependencias: lo usan el admin, la página, el carrito, el servidor y la sincronización con la planilla.

export type WholesaleKind = "FIXED" | "CUSTOM";

// Un display base dentro de una unidad del producto mayorista.
export type WholesaleComponent = { productId: string; name: string; quantity: number };

export const WHOLESALE_MAX_BOX_DISPLAYS = 100;

// "Caja Barritas Cacao x 12 unidades" → "Cacao". Para mostrar composiciones cortas y claras.
export function shortProductName(name: string) {
  const short = name
    .replace(/^\s*(caja|display|pack)\s+(de\s+)?(barritas?\s+)?/i, "")
    .replace(/\s*x\s*\d+\s*(unidades|unid\.?|u\.?)?\s*$/i, "")
    .trim();
  return short || name.trim();
}

export function countComponentDisplays(components: Pick<WholesaleComponent, "quantity">[]) {
  return components.reduce((sum, component) => sum + Math.max(0, component.quantity), 0);
}

// Displays que trae una unidad de venta: la suma de la composición fija o el tamaño de la caja a elección.
export function displaysPerUnit(product: { kind: WholesaleKind; boxDisplays: number; components: Pick<WholesaleComponent, "quantity">[] }) {
  return product.kind === "CUSTOM" ? product.boxDisplays : countComponentDisplays(product.components);
}

// "3 Banana · 3 Cacao · 3 Maní · 1 Mix"
export function describeComposition(components: Pick<WholesaleComponent, "name" | "quantity">[]) {
  return components
    .filter((component) => component.quantity > 0)
    .map((component) => `${component.quantity} ${shortProductName(component.name)}`)
    .join(" · ");
}

// Cómo se llama la unidad de venta en la página: un display suelto o un bulto/caja con N displays.
export function saleUnitLabel(product: { kind: WholesaleKind; boxDisplays: number; components: Pick<WholesaleComponent, "quantity">[] }) {
  const displays = displaysPerUnit(product);
  if (product.kind === "CUSTOM") return `Armá tu caja · ${displays} displays`;
  if (displays === 0) return "Sin composición";
  return displays === 1 ? "Display" : `Bulto · ${displays} displays`;
}

export function isSingleDisplay(product: { kind: WholesaleKind; components: Pick<WholesaleComponent, "quantity">[] }) {
  return product.kind === "FIXED" && product.components.length === 1 && product.components[0]!.quantity === 1;
}

// Nombre que queda en el pedido (y en la planilla, el email y Mercado Pago), con la composición a la vista.
export function buildOrderItemName(product: { name: string; kind: WholesaleKind; unitsPerDisplay: number }, components: WholesaleComponent[]) {
  if (product.kind === "FIXED" && components.length === 1 && components[0]!.quantity === 1) {
    return `${product.name} (display x${product.unitsPerDisplay})`;
  }
  return `${product.name} (${countComponentDisplays(components)} displays: ${describeComposition(components)})`;
}

// La elección del cliente en "armá tu caja": productId → displays.
export type WholesaleSelection = { productId: string; quantity: number }[];

// Normaliza la elección: solo cantidades positivas, sin repetidos y en el orden de los sabores del admin.
export function normalizeSelection(selection: WholesaleSelection, allowed: Pick<WholesaleComponent, "productId">[]) {
  const totals = new Map<string, number>();
  for (const entry of selection) {
    const quantity = Math.floor(Number(entry.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    totals.set(entry.productId, (totals.get(entry.productId) ?? 0) + quantity);
  }
  const order = allowed.map((component) => component.productId);
  return [...totals.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((a, b) => order.indexOf(a.productId) - order.indexOf(b.productId));
}

// Valida la caja armada contra los sabores habilitados y su tamaño. Devuelve la composición o el motivo del rechazo.
export function resolveCustomSelection(
  selection: WholesaleSelection,
  allowed: Pick<WholesaleComponent, "productId" | "name">[],
  boxDisplays: number,
): { ok: true; components: WholesaleComponent[] } | { ok: false; error: string } {
  const normalized = normalizeSelection(selection, allowed);
  const components: WholesaleComponent[] = [];

  for (const entry of normalized) {
    const option = allowed.find((component) => component.productId === entry.productId);
    if (!option) {
      return { ok: false, error: "Uno de los sabores elegidos ya no está disponible para armar la caja." };
    }
    components.push({ productId: option.productId, name: option.name, quantity: entry.quantity });
  }

  const total = countComponentDisplays(components);
  if (total !== boxDisplays) {
    return { ok: false, error: `Cada caja lleva ${boxDisplays} displays y elegiste ${total}. Revisá la caja.` };
  }

  return { ok: true, components };
}

// Clave de la línea del carrito: el mismo producto con otra elección de sabores es otra línea.
export function buildCartKey(productId: string, selection?: WholesaleSelection | null) {
  if (!selection || selection.length === 0) return productId;
  const signature = [...selection]
    .filter((entry) => entry.quantity > 0)
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((entry) => `${entry.productId}=${entry.quantity}`)
    .join(",");
  return `${productId}|${signature}`;
}

// Lee la composición guardada en el ítem del pedido. Algo mal formado se ignora (el ítem viaja como antes).
export function parseComponentsSnapshot(value: unknown): WholesaleComponent[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const components: WholesaleComponent[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const { productId, name, quantity } = entry as Record<string, unknown>;
    if (typeof productId !== "string" || !productId || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) return null;
    components.push({ productId, name: typeof name === "string" ? name : "", quantity });
  }
  return components;
}

export type ExplodedItemRow = {
  key: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

// Abre un ítem mayorista en sus displays base para la planilla y la app de operaciones.
// El precio del bulto se reparte igual entre sus displays (todos traen las mismas barritas), y la suma de las
// líneas da exactamente el total del ítem: el redondeo de centavos lo absorbe la última línea.
export function explodeOrderItem(item: {
  id: string;
  quantity: number;
  unitPriceArs: number;
  lineTotalArs: number;
  productNameSnapshot: string;
  components: WholesaleComponent[];
}): ExplodedItemRow[] {
  const displaysPerItemUnit = countComponentDisplays(item.components);
  const totalDisplays = displaysPerItemUnit * item.quantity;

  if (displaysPerItemUnit <= 0 || totalDisplays <= 0) {
    return [];
  }

  const pricePerDisplay = roundCents(item.lineTotalArs / totalDisplays);
  const single = item.components.length === 1;
  // "Bulto Mix (10 displays: …)" → "Bulto Mix": la composición ya la dice cada línea.
  const bundleName = item.productNameSnapshot.replace(/\s*\([^()]*\)\s*$/, "").trim() || item.productNameSnapshot;
  let allocated = 0;

  return item.components.map((component, index) => {
    const quantity = component.quantity * item.quantity;
    const isLast = index === item.components.length - 1;
    const lineTotal = isLast ? roundCents(item.lineTotalArs - allocated) : roundCents(pricePerDisplay * quantity);
    allocated = roundCents(allocated + lineTotal);

    return {
      // Un solo componente conserva el id del ítem, igual que antes de los bultos.
      key: single ? item.id : `${item.id}-${index + 1}`,
      productId: component.productId,
      name: single && component.quantity === 1 ? item.productNameSnapshot : `${component.name} · ${bundleName}`,
      quantity,
      unitPrice: isLast ? roundCents(lineTotal / quantity) : pricePerDisplay,
      lineTotal,
    };
  });
}

// Lo que la página, la ficha y el carrito necesitan de cada producto mayorista a la venta.
export type WholesaleSaleProduct = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  priceArs: number;
  unitsPerDisplay: number;
  soldOut: boolean;
  // Lleva la etiqueta "Más elegido".
  highlighted: boolean;
  kind: WholesaleKind;
  boxDisplays: number;
  // Displays que trae cada unidad de venta.
  displays: number;
  // FIXED: la composición. CUSTOM: los sabores que se pueden elegir (quantity 0).
  components: WholesaleComponent[];
};

export type WholesaleCartLine<P extends WholesaleSaleProduct = WholesaleSaleProduct> = {
  key: string;
  product: P;
  quantity: number;
  // Displays de cada unidad (la composición fija o la caja armada).
  components: WholesaleComponent[];
  displaysPerUnit: number;
  displays: number;
  lineTotalArs: number;
  // Si la línea no se puede comprar (sin stock, o una caja que ya no coincide con lo que se vende), el motivo.
  problem: string | null;
};

// Cruza el carrito guardado en el navegador con lo que hoy está a la venta.
export function resolveCartLines<P extends WholesaleSaleProduct>(
  items: { key: string; productId: string; quantity: number; selection?: WholesaleSelection }[],
  products: P[],
): WholesaleCartLine<P>[] {
  const lines: WholesaleCartLine<P>[] = [];

  for (const item of items) {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product || item.quantity <= 0) continue;

    let components = product.components;
    let problem: string | null = product.soldOut ? "Sin stock: no se incluye en el pedido" : null;

    if (product.kind === "CUSTOM") {
      const resolved = resolveCustomSelection(item.selection ?? [], product.components, product.boxDisplays);
      if (resolved.ok) {
        components = resolved.components;
      } else {
        components = [];
        problem = problem ?? "Esta caja cambió: sacala y volvé a armarla";
      }
    }

    const perUnit = product.kind === "CUSTOM" ? product.boxDisplays : countComponentDisplays(components);
    lines.push({
      key: item.key,
      product,
      quantity: item.quantity,
      components,
      displaysPerUnit: perUnit,
      displays: perUnit * item.quantity,
      lineTotalArs: product.priceArs * item.quantity,
      problem,
    });
  }

  return lines;
}
