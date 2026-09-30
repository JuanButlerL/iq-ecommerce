import { assertAdminSection } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";
import { uploadNewsletterImage } from "@/lib/storage/newsletter-images";

const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await assertAdminSection("newsletter");
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = formData.get("folder");

    if (!(file instanceof File) || typeof folder !== "string") {
      throw new AppError("Upload inválido.", 400, true);
    }

    if (!allowedImageMimeTypes.has(file.type)) {
      throw new AppError("Formato de imagen no soportado. Usá JPG, PNG o WEBP.", 400, true);
    }

    if (file.size > maxImageSize) {
      throw new AppError("La imagen supera el máximo de 5 MB. Achicala antes de subirla.", 400, true);
    }

    return routeOk(await uploadNewsletterImage(file, folder));
  } catch (error) {
    return routeError(error);
  }
}
