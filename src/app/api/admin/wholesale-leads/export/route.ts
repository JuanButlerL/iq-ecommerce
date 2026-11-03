import { getWholesaleLeads } from "@/features/wholesale/leads";
import { WHOLESALE_LEAD_STATUS_LABELS } from "@/features/wholesale/lead-status";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError } from "@/lib/http/route";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

function csvCell(value: string | null | undefined) {
  const text = value ?? "";
  // Evita que Excel interprete el contenido como fórmula.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  try {
    await assertAdminSection("wholesale");
    const leads = await getWholesaleLeads();
    const header = [
      "Fecha",
      "Estado",
      "Nombre",
      "Negocio",
      "Tipo de negocio",
      "Teléfono",
      "Email",
      "CUIT",
      "Calle",
      "Piso / Depto",
      "Ciudad",
      "Provincia",
      "CP",
      "Referencia",
      "Cantidad estimada",
      "Mensaje",
      "Notas internas",
    ];
    const rows = leads.map((lead) => [
      formatArgentinaDateTime(lead.createdAt),
      WHOLESALE_LEAD_STATUS_LABELS[lead.status],
      lead.name,
      lead.businessName,
      lead.businessType,
      lead.phone,
      lead.email,
      lead.cuit,
      lead.street,
      lead.floor,
      lead.city,
      lead.province,
      lead.postalCode,
      lead.reference,
      lead.monthlyVolume,
      lead.message,
      lead.adminNotes,
    ]);
    const csv = "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="consultas-mayoristas-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
