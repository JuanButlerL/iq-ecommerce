import { requireAdmin } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";
import { uploadProductImage } from "@/lib/storage/product-images";

const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const file = formData.get("file");
    const slug = formData.get("slug");

    if (!(file instanceof File) || typeof slug !== "string") {
      throw new Error("Upload invalido.");
    }

    if (!allowedImageMimeTypes.has(file.type)) {
      throw new AppError("Formato de imagen no soportado. Usa JPG, PNG o WEBP.", 400, true);
    }

    if (file.size > maxImageSize) {
      throw new AppError("La imagen supera el maximo de 8 MB.", 400, true);
    }

    const uploaded = await uploadProductImage(file, slug);

    return routeOk(uploaded);
  } catch (error) {
    return routeError(error);
  }
}
