import { EmailAuditPanel } from "@/features/admin/components/email-audit-panel";
import { getEmailAuditPreview } from "@/features/email/automation-service";
import { requireAdminSection } from "@/lib/auth/admin";
import { parseArgentinaDateParam } from "@/lib/utils/datetime";

type AdminEmailAuditPageProps = {
  searchParams?: Promise<{
    desde?: string;
    hasta?: string;
  }>;
};

export default async function AdminEmailAuditPage({ searchParams }: AdminEmailAuditPageProps) {
  await requireAdminSection("emails");
  const params = await searchParams;
  const logFrom = parseArgentinaDateParam(params?.desde ?? null);
  const logTo = parseArgentinaDateParam(params?.hasta ?? null, true);
  const preview = await getEmailAuditPreview({ logFrom, logTo });

  return <EmailAuditPanel {...preview} logFilters={{ desde: params?.desde ?? "", hasta: params?.hasta ?? "" }} />;
}
