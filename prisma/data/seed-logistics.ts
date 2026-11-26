// Carga inicial de la logística en el deploy. Idempotente: se puede correr más de una vez sin duplicar nada.
//   docker compose run --rm app npx tsx prisma/data/seed-logistics.ts
//
// 1. Tabla de códigos postales: copia de codigos_postales_db de la app (iq_app_db) al 2026-11-24.
//    Es el punto de partida; de acá en adelante se edita desde Admin > Logística.
// 2. Zonas de reparto propio "CABA" ($5.000) y "GBA Norte" ($7.500), precios que pasó Juan el 2026-11-24.
// 3. Hora de corte 13:00 (config_corte de la app).
// 4. Peso y medidas de los productos que no los tienen: 1 cajita = 1 display (360 g, 10x12x7);
//    "3 Cajitas ..." = 3 displays (1080 g). La web arma el bulto según la cantidad de displays.
// No prende la integración: eso se hace a mano desde el admin.
import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/db/prisma";
import { importPostalCodes } from "@/features/logistics/postal-codes";
import { DISPLAY_BOXES, DISPLAY_WEIGHT_GRAMS } from "@/features/logistics/package";

const CSV = path.join(process.cwd(), "prisma", "data", "codigos-postales-app-2026-11-24.csv");

async function main() {
  const result = await importPostalCodes(readFileSync(CSV, "utf8"));
  console.log(`CP: ${result.rows} filas, ${result.created} nuevas, ${result.updated} actualizadas, ${result.own} de reparto propio.`);

  // Mayoristas: el precio de su tabla de envíos de hoy para esa provincia (CABA hoy es sin cargo), así no
  // cambia lo que paga un mayorista. Si la tabla no tiene la provincia, el mismo precio que minoristas.
  const zones = [
    { name: "CABA", priceArs: 5000, wholesaleProvinces: ["CABA"], sortOrder: 0 },
    { name: "GBA Norte", priceArs: 7500, wholesaleProvinces: ["GBA", "Buenos Aires"], sortOrder: 1 },
  ];
  const wholesaleRule = await prisma.shippingRule.findFirst({
    where: { channel: "WHOLESALE", active: true },
    include: { provinces: { where: { active: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const wholesalePrice = (names: string[]) => {
    for (const name of names) {
      const row = wholesaleRule?.provinces.find((p) => p.provinceName.trim().toLowerCase() === name.toLowerCase());
      if (row) return row.shippingPrice;
    }
    return null;
  };
  for (const zone of zones) {
    const current = await prisma.ownDeliveryZone.findUnique({ where: { name: zone.name } });
    // Una zona que ya tiene precio (cargado en el admin) no se toca.
    if (current && current.priceArs > 0) {
      console.log(`Zona ${zone.name}: ya tenía precio ${current.priceArs}, no se cambia.`);
      continue;
    }
    const data = {
      priceArs: zone.priceArs,
      wholesalePriceArs: wholesalePrice(zone.wholesaleProvinces),
      deliveryDaysMin: 1,
      deliveryDaysMax: 2,
      sortOrder: zone.sortOrder,
      active: true,
    };
    await prisma.ownDeliveryZone.upsert({ where: { name: zone.name }, update: data, create: { name: zone.name, ...data } });
    console.log(`Zona ${zone.name}: precio ${data.priceArs}${data.wholesalePriceArs !== null ? `, mayorista ${data.wholesalePriceArs}` : ""}, ${data.active ? "activa" : "APAGADA (sin precio)"}.`);
  }

  for (const product of await prisma.product.findMany({ where: { weightGrams: null } })) {
    const match = product.name.match(/^\s*(\d+)\s+(cajitas?|displays?)/i);
    const displays = Math.min(10, Math.max(1, match ? Number(match[1]) : 1));
    const [lengthCm, widthCm, heightCm] = DISPLAY_BOXES[displays];
    await prisma.product.update({
      where: { id: product.id },
      data: { weightGrams: displays * DISPLAY_WEIGHT_GRAMS, lengthCm, widthCm, heightCm },
    });
    console.log(`Producto "${product.name}": ${displays} display(s), ${displays * DISPLAY_WEIGHT_GRAMS} g.`);
  }

  // Depósito de origen / remitente de las etiquetas: el mismo que imprimen hoy las etiquetas de Andreani
  // (IKIFOODS SRL, Perón 1966, CABA 1040). Teléfono y email de Nico (WhatsApp Business). Solo si no hay ninguno.
  if ((await prisma.warehouse.count()) === 0) {
    await prisma.warehouse.create({
      data: {
        name: "Depósito IKIFOODS",
        contactName: "IKIFOODS SRL",
        phone: "5491173933235",
        email: "nicolas@ikifoods.com.ar",
        taxId: "30718938305",
        street: "Tte. Gral. Juan Domingo Perón",
        number: "1966",
        locality: "CABA",
        province: "CABA",
        postalCode: "1040",
        isDefault: true,
        active: true,
      },
    });
    console.log("Depósito de origen: IKIFOODS SRL, Perón 1966, CABA 1040.");
  }

  // Configuración del pase (Juan, 2026-11-25): Andreani con tarifa real -25% + $2.500, Correo apagado hasta Paq.ar,
  // reparto propio y retiro en sucursal prendidos. Solo la primera vez (si ya se tocó desde el admin, no se pisa).
  // La integración queda APAGADA: se prende desde el admin después de la prueba de punta a punta.
  await prisma.shippingSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const before = await prisma.shippingSettings.findUniqueOrThrow({ where: { id: 1 } });
  if (!before.enabled && before.andreaniDiscountPct === 0 && before.carrierPricing === "TABLE") {
    await prisma.shippingSettings.update({
      where: { id: 1 },
      data: {
        cutoffHour: 13,
        cutoffMinute: 0,
        carrierPricing: "LIVE",
        andreaniDiscountPct: 25,
        andreaniSurchargeArs: 2500,
        andreaniEnabled: true,
        correoEnabled: false,
        ownEnabled: true,
        branchPickupEnabled: true,
      },
    });
  }
  const settings = await prisma.shippingSettings.findUniqueOrThrow({ where: { id: 1 } });
  console.log(
    `Corte ${settings.cutoffHour}:${String(settings.cutoffMinute).padStart(2, "0")}. Precio ${settings.carrierPricing}, descuento Andreani ${settings.andreaniDiscountPct}%, recargo $${settings.andreaniSurchargeArs}. ` +
      `Andreani ${settings.andreaniEnabled ? "sí" : "no"}, Correo ${settings.correoEnabled ? "sí" : "no"}, propio ${settings.ownEnabled ? "sí" : "no"}. Integración ${settings.enabled ? "PRENDIDA" : "apagada"}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
