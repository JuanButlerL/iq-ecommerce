import type { WholesaleLeadStatus } from "@prisma/client";

export const WHOLESALE_LEAD_STATUS_LABELS: Record<WholesaleLeadStatus, string> = {
  NEW: "Nueva",
  CONTACTED: "Contactada",
  CLIENT: "Cliente",
  DISCARDED: "Descartada",
};
