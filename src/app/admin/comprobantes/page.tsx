import { ProofReviewPanel } from "@/features/orders/components/proof-review-panel";
import { listProofsToReview } from "@/features/orders/services/proof-review-service";
import { requireAdminSection } from "@/lib/auth/admin";
import { getShippingSettings } from "@/features/logistics/settings";

export const dynamic = "force-dynamic";

export default async function AdminProofsPage() {
  await requireAdminSection("orders");
  const [items, settings] = await Promise.all([listProofsToReview(), getShippingSettings()]);
  return <ProofReviewPanel items={JSON.parse(JSON.stringify(items))} requireApproval={settings.requireProofApproval} />;
}
