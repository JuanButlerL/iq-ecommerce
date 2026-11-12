// Colores de las tarjetas de /mayoristas. Sin "use client": lo usan la página (servidor) y la grilla.

export type WholesaleProductTheme = { accent: string; surface: string; text: string };

const THEME_BY_COLOR = {
  CACAO: { accent: "#F48991", surface: "#FFF3F4", text: "#2c2241" },
  BANANA: { accent: "#ffd35c", surface: "#FFF8DF", text: "#2c2241" },
  PEANUT: { accent: "#7bd8f7", surface: "#EEF9FE", text: "#2c2241" },
} as const;

// Mismo criterio que la home minorista: los colores cargados en el producto y, si faltan, los del tema.
export function buildWholesaleProductTheme(
  product: { colorTheme: keyof typeof THEME_BY_COLOR; visualAccentHex: string | null; visualSurfaceHex: string | null; visualTextHex: string | null } | null,
): WholesaleProductTheme | null {
  if (!product) return null;
  const fallback = THEME_BY_COLOR[product.colorTheme] ?? THEME_BY_COLOR.CACAO;
  return {
    accent: product.visualAccentHex ?? fallback.accent,
    surface: product.visualSurfaceHex ?? fallback.surface,
    text: product.visualTextHex ?? fallback.text,
  };
}

// Respaldo por nombre para productos sin vínculo a la tienda.
export function getWholesaleProductTheme(name: string): WholesaleProductTheme {
  const normalized = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  if (normalized.includes("cacao")) return { accent: "#F48991", surface: "#FFF3F4", text: "#2c2241" };
  if (normalized.includes("banana")) return { accent: "#ffd35c", surface: "#FFF8DF", text: "#2c2241" };
  if (normalized.includes("mani")) return { accent: "#7bd8f7", surface: "#EEF9FE", text: "#2c2241" };
  return { accent: "#F48991", surface: "#FFF3F4", text: "#2c2241" };
}
