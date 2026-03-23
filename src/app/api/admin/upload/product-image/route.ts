import { requireAdmin } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";
import { uploadProductImage } from "@/lib/storage/product-images";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const file = formData.get("file");
    const slug = formData.get("slug");

    if (!(file instanceof File) || typeof slug !== "string") {
      throw new Error("Upload invalido.");
    }

    const uploaded = await uploadProductImage(file, slug);

    return routeOk(uploaded);
  } catch (error) {
    return routeError(error);
  }
}
