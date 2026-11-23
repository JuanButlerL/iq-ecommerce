// Arma el paquete (peso y medidas) de un pedido. Sin dependencias: lo usan el servidor y los tests.

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
  // Medidas de una unidad de venta. Si faltan, se usan `components` o los valores por defecto.
  unit: UnitDimensions;
  // Displays de la tienda que trae una unidad (bultos mayoristas sin medidas propias).
  components?: { quantity: number; unit: UnitDimensions }[];
};

export type ComputedPackage = { weightGrams: number; lengthCm: number; widthCm: number; heightCm: number };

function complete(unit: UnitDimensions) {
  return Boolean(unit.weightGrams && unit.lengthCm && unit.widthCm && unit.heightCm);
}

function withDefaults(unit: UnitDimensions, defaults: PackageDefaults) {
  return {
    weightGrams: unit.weightGrams || defaults.defaultUnitWeightGrams,
    lengthCm: unit.lengthCm || defaults.defaultUnitLengthCm,
    widthCm: unit.widthCm || defaults.defaultUnitWidthCm,
    heightCm: unit.heightCm || defaults.defaultUnitHeightCm,
  };
}

type Piece = { weightGrams: number; lengthCm: number; widthCm: number; heightCm: number; count: number };

function pieces(line: PackageLine, defaults: PackageDefaults): Piece[] {
  if (!complete(line.unit) && line.components?.length) {
    return line.components.flatMap((component) =>
      pieces({ quantity: component.quantity * line.quantity, unit: component.unit }, defaults),
    );
  }
  return [{ ...withDefaults(line.unit, defaults), count: line.quantity }];
}

// Las unidades se apilan: el largo y ancho del paquete son los mayores, y la altura sale del volumen total.
export function computePackage(lines: PackageLine[], defaults: PackageDefaults): ComputedPackage {
  const all = lines.filter((line) => line.quantity > 0).flatMap((line) => pieces(line, defaults));
  if (all.length === 0) {
    return {
      weightGrams: defaults.defaultUnitWeightGrams,
      lengthCm: defaults.defaultUnitLengthCm,
      widthCm: defaults.defaultUnitWidthCm,
      heightCm: defaults.defaultUnitHeightCm,
    };
  }
  const weightGrams = all.reduce((sum, p) => sum + p.weightGrams * p.count, 0);
  const volume = all.reduce((sum, p) => sum + p.lengthCm * p.widthCm * p.heightCm * p.count, 0);
  const lengthCm = Math.max(...all.map((p) => p.lengthCm));
  const widthCm = Math.max(...all.map((p) => p.widthCm));
  const heightCm = Math.max(Math.max(...all.map((p) => p.heightCm)), Math.ceil(volume / (lengthCm * widthCm)));
  return { weightGrams: Math.round(weightGrams), lengthCm, widthCm, heightCm };
}

// Para guardar cotizaciones: paquetes parecidos comparten precio (peso cada 500 g, volumen cada 2.000 cm³).
export function quoteBucket(pkg: ComputedPackage) {
  const weight = Math.ceil(pkg.weightGrams / 500) * 500;
  const volume = Math.ceil((pkg.lengthCm * pkg.widthCm * pkg.heightCm) / 2000) * 2000;
  return { weight, volume };
}
