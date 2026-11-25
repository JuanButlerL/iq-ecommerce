import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";

// Tabla de códigos postales: importación desde el CSV de codigos_postales_db (la planilla de la app).
// Sin dependencias del resto de la logística: la usan el admin y el script de carga inicial del deploy.

export function ownZoneNameFor(province: string) {
  const p = province.trim().toLowerCase();
  if (p === "caba" || p.includes("ciudad aut")) return "CABA";
  if (p === "buenos aires" || p === "gba") return "GBA Norte";
  return province.trim();
}

// CSV exportado de codigos_postales_db: id_provincia, provincia, id, localidad, cp, Propia.
// Las filas con Propia = "Si" van a la zona "CABA" o "GBA Norte" (provincia de Buenos Aires); otra provincia,
// a una zona con su nombre. Las zonas que no existen se crean apagadas y con precio 0. Después se pueden
// mover CP de zona desde el admin, y volver a importar no pisa la zona de un CP que sigue siendo propio.
export function parsePostalCodesCsv(text: string) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new AppError("El archivo no tiene filas.", 400, true);
  const separator = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const split = (line: string) => {
    const out: string[] = [];
    let current = "";
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === separator && !quoted) {
        out.push(current);
        current = "";
      } else current += char;
    }
    out.push(current);
    return out.map((value) => value.trim());
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const col = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iProvince = col(["provincia", "province"]);
  const iLocality = col(["localidad", "locality"]);
  const iCp = col(["cp", "codigo_postal", "código postal", "postal_code"]);
  const iOwn = col(["propia", "own"]);
  if (iProvince < 0 || iLocality < 0 || iCp < 0) {
    throw new AppError("El CSV tiene que tener las columnas provincia, localidad y cp.", 400, true);
  }
  const rows = new Map<string, { postalCode: string; province: string; locality: string; own: boolean }>();
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const postalCode = (cells[iCp] ?? "").replace(/\D/g, "").slice(0, 4);
    const locality = (cells[iLocality] ?? "").slice(0, 120);
    const province = (cells[iProvince] ?? "").slice(0, 80);
    if (postalCode.length !== 4 || !locality) continue;
    const own = iOwn >= 0 && /^s[ií]$/i.test(cells[iOwn] ?? "");
    rows.set(`${postalCode}|${locality.toLowerCase()}`, { postalCode, province, locality, own });
  }
  return [...rows.values()];
}

export async function importPostalCodes(csvText: string) {
  const rows = parsePostalCodesCsv(csvText);
  if (rows.length === 0) throw new AppError("No encontramos códigos postales válidos en el archivo.", 400, true);
  if (rows.length > 50_000) throw new AppError("El archivo tiene demasiadas filas.", 400, true);

  const zonesByName = new Map((await prisma.ownDeliveryZone.findMany()).map((zone) => [zone.name.toLowerCase(), zone.id]));
  for (const name of new Set(rows.filter((row) => row.own).map((row) => ownZoneNameFor(row.province)))) {
    if (!zonesByName.has(name.toLowerCase())) {
      const zone = await prisma.ownDeliveryZone.create({ data: { name, priceArs: 0, active: false } });
      zonesByName.set(name.toLowerCase(), zone.id);
    }
  }

  const existing = new Map(
    (await prisma.postalCode.findMany({ select: { id: true, postalCode: true, locality: true, ownZoneId: true } })).map((row) => [
      `${row.postalCode}|${row.locality.toLowerCase()}`,
      row,
    ]),
  );
  let created = 0;
  let updated = 0;
  const toCreate: { postalCode: string; province: string; locality: string; ownZoneId: string | null }[] = [];

  for (const row of rows) {
    const key = `${row.postalCode}|${row.locality.toLowerCase()}`;
    const current = existing.get(key);
    const importedZone = row.own ? zonesByName.get(ownZoneNameFor(row.province).toLowerCase()) ?? null : null;
    if (!current) {
      toCreate.push({ postalCode: row.postalCode, province: row.province, locality: row.locality, ownZoneId: importedZone });
      continue;
    }
    // Un CP propio que ya estaba en una zona conserva su zona (puede haberse movido a mano a "Zona Norte").
    const nextZone = row.own ? current.ownZoneId ?? importedZone : null;
    if (nextZone !== current.ownZoneId) {
      await prisma.postalCode.update({ where: { id: current.id }, data: { ownZoneId: nextZone, province: row.province } });
      updated += 1;
    }
  }
  for (let i = 0; i < toCreate.length; i += 1000) {
    const result = await prisma.postalCode.createMany({ data: toCreate.slice(i, i + 1000), skipDuplicates: true });
    created += result.count;
  }
  return { rows: rows.length, created, updated, own: rows.filter((row) => row.own).length };
}
