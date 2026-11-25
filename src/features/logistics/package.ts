// Arma los bultos de un pedido. Sin dependencias: lo usan el servidor y los tests.
//
// IQ Kids despacha displays de 12 barritas (360 g, 10x12x7 cm). Según cuántos displays lleva el pedido se
// arma una caja de medida conocida (tabla de logística, 2026-11-24); de 10 en adelante se completan bultos de
// 10 y el resto va en otra caja. Un producto que trae varios displays (ej. "3 Display Mix") cuenta como esos
// displays: se deduce de su peso cargado en el admin (1080 g = 3 displays).

export type UnitDimensions = {
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
};

export type PackageDefaults = {
  defaultUnitWeightGrams: number;
  defaultUnitLengthCm: number;
  defaultUnitWidthCm: number;
  defaultUnitHeightCm: number;
};

export type PackageLine = {
  quantity: number;
  // Medidas de una unidad de venta (de ahí sale cuántos displays trae).
  unit: UnitDimensions;
  // Displays de la tienda que trae una unidad (bultos mayoristas).
  components?: { quantity: number; unit: UnitDimensions }[];
};

export type Box = { weightGrams: number; lengthCm: number; widthCm: number; heightCm: number };

// Lo que se cotiza y se manda al transportista: los bultos, y un total para las APIs de un solo paquete.
export type ComputedPackage = Box & { boxes: Box[]; displays: number };

export const DISPLAY_WEIGHT_GRAMS = 360;
export const DISPLAYS_PER_FULL_BOX = 10;

// Cantidad de displays -> caja (largo x ancho x alto en cm). Peso = 360 g por display.
export const DISPLAY_BOXES: Record<number, [number, number, number]> = {
  1: [10, 12, 7],
  2: [10, 12, 14],
  3: [10, 12, 21],
  4: [17, 12, 21],
  5: [20, 12, 21],
  6: [20, 12, 21],
  7: [20, 12, 28],
  8: [20, 12, 28],
  9: [20, 12, 35],
  10: [20, 12, 35],
};

function displaysPerUnit(unit: UnitDimensions) {
  if (!unit.weightGrams || unit.weightGrams <= 0) return 1;
  return Math.max(1, Math.round(unit.weightGrams / DISPLAY_WEIGHT_GRAMS));
}

export function countDisplays(lines: PackageLine[]) {
  return lines
    .filter((line) => line.quantity > 0)
    .reduce((total, line) => {
      // Bulto mayorista sin peso propio: cuenta los displays de su composición.
      if (!line.unit.weightGrams && line.components?.length) {
        const perUnit = line.components.reduce((sum, c) => sum + Math.max(0, c.quantity) * displaysPerUnit(c.unit), 0);
        return total + line.quantity * Math.max(1, perUnit);
      }
      return total + line.quantity * displaysPerUnit(line.unit);
    }, 0);
}

export function boxesForDisplays(displays: number): Box[] {
  const n = Math.max(1, Math.round(displays));
  const boxes: Box[] = [];
  const full = Math.floor(n / DISPLAYS_PER_FULL_BOX);
  const rest = n % DISPLAYS_PER_FULL_BOX;
  const box = (count: number): Box => {
    const [lengthCm, widthCm, heightCm] = DISPLAY_BOXES[count];
    return { weightGrams: count * DISPLAY_WEIGHT_GRAMS, lengthCm, widthCm, heightCm };
  };
  for (let i = 0; i < full; i += 1) boxes.push(box(DISPLAYS_PER_FULL_BOX));
  if (rest > 0) boxes.push(box(rest));
  return boxes;
}

// Un solo paquete equivalente (para APIs que cotizan un bulto): peso total, base más grande y alturas apiladas.
function combine(boxes: Box[]): Box {
  return {
    weightGrams: boxes.reduce((s, b) => s + b.weightGrams, 0),
    lengthCm: Math.max(...boxes.map((b) => b.lengthCm)),
    widthCm: Math.max(...boxes.map((b) => b.widthCm)),
    heightCm: boxes.reduce((s, b) => s + b.heightCm, 0),
  };
}

export function computePackage(lines: PackageLine[], _defaults?: PackageDefaults): ComputedPackage {
  const displays = Math.max(1, countDisplays(lines));
  const boxes = boxesForDisplays(displays);
  return { ...combine(boxes), boxes, displays };
}

// Clave de la cotización guardada: misma cantidad de displays = mismos bultos = mismo precio.
export function quoteBucket(pkg: ComputedPackage) {
  return { weight: pkg.weightGrams, volume: pkg.displays };
}
