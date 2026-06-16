import { TestimonialsAdminPanel } from "@/features/admin/components/testimonials-admin-panel";
import { getAdminTestimonials } from "@/features/testimonials/queries";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminTestimonialsPage() {
  await requireAdmin();
  const testimonials = await getAdminTestimonials();

  return <TestimonialsAdminPanel testimonials={testimonials} />;
}
