import { requireAdmin } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";
import { saveProduct } from "@/features/products/mutations";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const payload = await request.json();
    await saveProduct(payload);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
