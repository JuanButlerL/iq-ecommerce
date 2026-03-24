export type ArgentinaProvince = {
  code: string;
  name: string;
  shippingPrice: number;
};

export const ARGENTINA_PROVINCES: ArgentinaProvince[] = [
  { code: "B", name: "Buenos Aires", shippingPrice: 5200 },
  { code: "GBA", name: "GBA", shippingPrice: 5200 },
  { code: "C", name: "CABA", shippingPrice: 4800 },
  { code: "K", name: "Catamarca", shippingPrice: 6900 },
  { code: "H", name: "Chaco", shippingPrice: 7200 },
  { code: "U", name: "Chubut", shippingPrice: 7900 },
  { code: "X", name: "Cordoba", shippingPrice: 5600 },
  { code: "W", name: "Corrientes", shippingPrice: 7100 },
  { code: "E", name: "Entre Rios", shippingPrice: 6300 },
  { code: "P", name: "Formosa", shippingPrice: 7600 },
  { code: "Y", name: "Jujuy", shippingPrice: 7600 },
  { code: "L", name: "La Pampa", shippingPrice: 6200 },
  { code: "F", name: "La Rioja", shippingPrice: 7100 },
  { code: "M", name: "Mendoza", shippingPrice: 6200 },
  { code: "N", name: "Misiones", shippingPrice: 7800 },
  { code: "Q", name: "Neuquen", shippingPrice: 6900 },
  { code: "R", name: "Rio Negro", shippingPrice: 6900 },
  { code: "A", name: "Salta", shippingPrice: 7600 },
  { code: "J", name: "San Juan", shippingPrice: 6500 },
  { code: "D", name: "San Luis", shippingPrice: 6200 },
  { code: "Z", name: "Santa Cruz", shippingPrice: 8600 },
  { code: "S", name: "Santa Fe", shippingPrice: 5600 },
  { code: "G", name: "Santiago del Estero", shippingPrice: 6700 },
  { code: "V", name: "Tierra del Fuego", shippingPrice: 9200 },
  { code: "T", name: "Tucuman", shippingPrice: 6900 },
];

const PROVINCE_NAME_ALIASES: Record<string, string> = {
  "ciudad autonoma de buenos aires": "CABA",
  caba: "CABA",
  "gran buenos aires": "GBA",
  gba: "GBA",
};

export function normalizeProvinceName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return PROVINCE_NAME_ALIASES[normalized] ?? name.trim();
}
