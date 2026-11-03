import type { TaxCondition } from "@prisma/client";

export const TAX_CONDITION_LABELS: Record<TaxCondition, string> = {
  RESPONSABLE_INSCRIPTO: "Responsable Inscripto",
  MONOTRIBUTO: "Monotributo",
  EXENTO: "Exento",
  CONSUMIDOR_FINAL: "Consumidor final",
};

// Factura A solo para Responsable Inscripto; el resto recibe B.
export function getInvoiceType(taxCondition: TaxCondition | null) {
  if (!taxCondition) return null;
  return taxCondition === "RESPONSABLE_INSCRIPTO" ? "A" : "B";
}
