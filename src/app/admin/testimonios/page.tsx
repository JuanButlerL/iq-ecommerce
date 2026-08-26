import { TestimonialsAdminPanel } from "@/features/admin/components/testimonials-admin-panel";
import { getAdminTestimonials } from "@/features/testimonials/queries";
import { requireAdminSection } from "@/lib/auth/admin";

export default async function AdminTestimonialsPage() {
  await requireAdminSection("testimonials");
  const testimonials = await getAdminTestimonials();

  return <TestimonialsAdminPanel testimonials={testimonials} />;
}
