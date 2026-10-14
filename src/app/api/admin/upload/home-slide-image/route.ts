import { assertAdminSection } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";
import { uploadHomeSlideImage } from "@/lib/storage/home-slide-images";

const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await assertAdminSection("home-carousel");
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AppError("Upload inválido.", 400, true);
    }

    if (!allowedImageMimeTypes.has(file.type)) {
      throw new AppError("Formato de imagen no soportado. Usá JPG, PNG o WEBP.", 400, true);
    }

    if (file.size > maxImageSize) {
      throw new AppError("La imagen supera el máximo de 8 MB. Achicala antes de subirla.", 400, true);
    }

    return routeOk(await uploadHomeSlideImage(file));
  } catch (error) {
    return routeError(error);
  }
}
