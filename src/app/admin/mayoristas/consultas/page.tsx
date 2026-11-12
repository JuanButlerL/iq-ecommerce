import type { WholesaleLeadStatus } from "@prisma/client";

import { WholesaleLeadsPanel } from "@/features/admin/components/wholesale-leads-panel";
import { toArgentineWhatsappNumber } from "@/features/wholesale/lead-email";
import { getWholesaleLeadCounts, getWholesaleLeads } from "@/features/wholesale/leads";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { requireAdminSection } from "@/lib/auth/admin";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";
import { WHOLESALE_LEAD_STATUSES } from "@/lib/validations/wholesale-lead";

// Ej: "Facebook Ads · mayoristas_nov26 · leadform_whatsapp (meta / paid_social)".
function formatLeadOrigin(
  session: { sourceLabel: string; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; utmContent: string | null } | null,
) {
  if (!session) return null;
  const utm = [session.utmSource, session.utmMedium].filter(Boolean).join(" / ");
  return [session.sourceLabel, session.utmCampaign, session.utmContent].filter(Boolean).join(" · ") + (utm ? ` (${utm})` : "");
}

export default async function AdminWholesaleLeadsPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  await requireAdminSection("wholesale");
  const { estado } = await searchParams;
  const status = WHOLESALE_LEAD_STATUSES.find((value) => value === estado?.toUpperCase()) as WholesaleLeadStatus | undefined;
  const [leads, counts, content] = await Promise.all([getWholesaleLeads(status), getWholesaleLeadCounts(), getWholesaleContent()]);

  return (
    <WholesaleLeadsPanel
      status={status ?? null}
      counts={counts}
      notificationEmails={content.contact.leadNotificationEmails}
      leads={leads.map((lead) => ({
        id: lead.id,
        status: lead.status,
        createdAt: formatArgentinaDateTime(lead.createdAt),
        name: lead.name,
        businessName: lead.businessName,
        businessType: lead.businessType,
        phone: lead.phone,
        whatsappNumber: toArgentineWhatsappNumber(lead.phone),
        email: lead.email,
        cuit: lead.cuit,
        address: [lead.street, lead.floor, lead.city, lead.province, lead.postalCode ? `CP ${lead.postalCode}` : null].filter(Boolean).join(", "),
        reference: lead.reference,
        monthlyVolume: lead.monthlyVolume,
        origin: formatLeadOrigin(lead.marketingSession),
        message: lead.message,
        adminNotes: lead.adminNotes ?? "",
        notified: Boolean(lead.notifiedAt),
        notificationError: lead.notificationError,
        customerId: lead.customers[0]?.id ?? null,
      }))}
    />
  );
}
