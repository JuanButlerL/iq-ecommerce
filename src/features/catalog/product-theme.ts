import { ProductColorTheme } from "@prisma/client";

type ThemeDefinition = {
  surface: string;
  surfaceSolid: string;
  accent: string;
  chip: string;
  text: string;
};

const defaultThemeMap: Record<ProductColorTheme, ThemeDefinition> = {
  CACAO: {
    surface: "from-[#fbd6d9] to-[#fff0f1]",
    surfaceSolid: "#fff0f1",
    accent: "#F48991",
    chip: "bg-[#fee6e8]",
    text: "text-[#b2555d]",
  },
  BANANA: {
    surface: "from-[#ffe792] to-[#fff7db]",
    surfaceSolid: "#fff7db",
    accent: "#f0b517",
    chip: "bg-[#fff2bf]",
    text: "text-[#956d00]",
  },
  PEANUT: {
    surface: "from-[#cef4ff] to-[#edfafe]",
    surfaceSolid: "#edfafe",
    accent: "#39bce3",
    chip: "bg-[#dff7ff]",
    text: "text-[#137794]",
  },
};

export const productFallbackImageMap: Record<ProductColorTheme, string> = {
  CACAO: "/home/cacao.webp",
  BANANA: "/home/banana.webp",
  PEANUT: "/home/mani.webp",
};

export function resolveProductTheme(product: {
  colorTheme: ProductColorTheme;
  visualAccentHex?: string | null;
  visualSurfaceHex?: string | null;
  visualTextHex?: string | null;
}) {
  const baseTheme = defaultThemeMap[product.colorTheme];

  if (!product.visualAccentHex && !product.visualSurfaceHex && !product.visualTextHex) {
    return baseTheme;
  }

  const accent = product.visualAccentHex || baseTheme.accent;
  const surfaceSolid = product.visualSurfaceHex || baseTheme.surfaceSolid;
  const textHex = product.visualTextHex || accent;

  return {
    surface: `from-[${surfaceSolid}] to-[${surfaceSolid}]`,
    surfaceSolid,
    accent,
    chip: baseTheme.chip,
    text: `text-[${textHex}]`,
  };
}
