// Botón que se dibuja encima de un banner (imagen completa con los textos ya diseñados).
// Posición en % de la imagen y tamaño relativo a su ancho, así queda igual en cualquier pantalla.
export type SlideButton = {
  label: string;
  url: string;
  bgColor: string;
  textColor: string;
  outline: boolean;
  shape: "pill" | "rounded";
  x: number;
  y: number;
  size: number;
  mobileX: number;
  mobileY: number;
  mobileSize: number;
};

export const DEFAULT_SLIDE_BUTTON: SlideButton = {
  label: "COMPRAR\nAHORA",
  url: "/productos",
  bgColor: "#ffd35c",
  textColor: "#2c2241",
  outline: false,
  shape: "rounded",
  x: 50,
  y: 75,
  size: 5,
  mobileX: 50,
  mobileY: 80,
  mobileSize: 5,
};

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

// Lo que viene de la base (JSON) se normaliza: un dato roto nunca rompe la home.
export function parseSlideButton(value: unknown): SlideButton | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const label = typeof raw.label === "string" ? raw.label.slice(0, 60) : "";
  const url = typeof raw.url === "string" ? raw.url.slice(0, 300) : "";
  if (!label.trim() || !url.trim()) return null;
  return {
    label,
    url,
    bgColor: typeof raw.bgColor === "string" && HEX.test(raw.bgColor) ? raw.bgColor : DEFAULT_SLIDE_BUTTON.bgColor,
    textColor: typeof raw.textColor === "string" && HEX.test(raw.textColor) ? raw.textColor : DEFAULT_SLIDE_BUTTON.textColor,
    outline: raw.outline === true,
    shape: raw.shape === "pill" ? "pill" : "rounded",
    x: clamp(raw.x, 0, 100, DEFAULT_SLIDE_BUTTON.x),
    y: clamp(raw.y, 0, 100, DEFAULT_SLIDE_BUTTON.y),
    size: clamp(raw.size, 1, 10, DEFAULT_SLIDE_BUTTON.size),
    mobileX: clamp(raw.mobileX, 0, 100, DEFAULT_SLIDE_BUTTON.mobileX),
    mobileY: clamp(raw.mobileY, 0, 100, DEFAULT_SLIDE_BUTTON.mobileY),
    mobileSize: clamp(raw.mobileSize, 1, 10, DEFAULT_SLIDE_BUTTON.mobileSize),
  };
}

