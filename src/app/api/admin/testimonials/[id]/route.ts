import { deleteTestimonial, saveTestimonial } from "@/features/testimonials/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdminSection("testimonials");
    const payload = await request.json();
    const { id } = await params;
    await saveTestimonial(payload, id);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdminSection("testimonials");
    const { id } = await params;
    await deleteTestimonial(id);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
