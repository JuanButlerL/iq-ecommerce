import { paymentProofSchema } from "@/lib/validations/proof";
import { attachPaymentProof } from "@/features/orders/services/order-service";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  try {
    const { orderNumber } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error("Archivo invalido.");
    }

    paymentProofSchema.parse({
      orderNumber,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });

    const result = await attachPaymentProof(orderNumber, file);

    return routeOk(result);
  } catch (error) {
    return routeError(error);
  }
}
