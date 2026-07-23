import { EmailAutomationsPanel } from "@/features/admin/components/email-automations-panel";
import { getEmailAutomationPreview } from "@/features/email/automation-service";
import { requireAdminSection } from "@/lib/auth/admin";

export default async function AdminEmailsPage() {
  await requireAdminSection("emails");
  const preview = await getEmailAutomationPreview();

  return <EmailAutomationsPanel {...preview} />;
}
