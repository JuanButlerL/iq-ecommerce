import { getLogisticsAdminData } from "@/features/logistics/admin";
import { LogisticsAdminPanel } from "@/features/logistics/components/logistics-admin-panel";
import { requireAdminSection } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function AdminLogisticsPage() {
  await requireAdminSection("shipping");
  const data = await getLogisticsAdminData();
  return <LogisticsAdminPanel data={data} />;
}
