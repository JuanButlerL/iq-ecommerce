import { ProofReviewPanel } from "@/features/orders/components/proof-review-panel";
import { listProofsToReview } from "@/features/orders/services/proof-review-service";
import { requireAdminSection } from "@/lib/auth/admin";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminProofsPage() {
  await requireAdminSection("orders");
  const items = await listProofsToReview();
  return <ProofReviewPanel items={JSON.parse(JSON.stringify(items))} emailEnabled={env.canSendEmail} />;
}
