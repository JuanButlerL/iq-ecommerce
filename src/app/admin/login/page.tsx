import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { AdminLoginForm } from "@/features/admin/components/admin-login-form";
import { getAdminSession } from "@/lib/auth/admin";

export default async function AdminLoginPage() {
  const session = await getAdminSession();

  if (session) {
    redirect("/admin");
  }

  return (
    <Container className="flex min-h-screen items-center justify-center py-10 md:py-16">
      <AdminLoginForm />
    </Container>
  );
}
