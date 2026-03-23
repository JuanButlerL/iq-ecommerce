import { ProductColorTheme } from "@prisma/client";

export const productThemeMap: Record<
  ProductColorTheme,
  { surface: string; accent: string; chip: string; text: string }
> = {
  CACAO: {
    surface: "from-[#fbd6d9] to-[#fff0f1]",
    accent: "#F48991",
    chip: "bg-[#fee6e8]",
    text: "text-[#b2555d]",
  },
  BANANA: {
    surface: "from-[#ffe792] to-[#fff7db]",
    accent: "#f0b517",
    chip: "bg-[#fff2bf]",
    text: "text-[#956d00]",
  },
  PEANUT: {
    surface: "from-[#cef4ff] to-[#edfafe]",
    accent: "#39bce3",
    chip: "bg-[#dff7ff]",
    text: "text-[#137794]",
  },
};
