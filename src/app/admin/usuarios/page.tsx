import { AdminUsersPanel } from "@/features/admin/components/admin-users-panel";
import { getAdminUsers } from "@/features/admin/queries/admin-users";
import { requirePrincipalAdmin } from "@/lib/auth/admin";
import { ADMIN_SECTIONS } from "@/lib/auth/admin-permissions";

export default async function AdminUsersPage() {
  await requirePrincipalAdmin();
  const users = await getAdminUsers();

  return <AdminUsersPanel users={users} sections={ADMIN_SECTIONS} />;
}
