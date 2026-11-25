import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createSupabaseAdminClient } from "@/lib/auth/supabase/admin";
import { env } from "@/lib/env";

// Etiquetas de envío: mismo bucket privado que los comprobantes, en labels/<pedido>/.
export async function uploadShippingLabel(data: Buffer, orderNumber: string, contentType = "application/pdf") {
  const safeOrder = orderNumber.replace(/[^a-zA-Z0-9-_]/g, "-");
  const extension = contentType === "image/png" ? "png" : contentType === "image/jpeg" ? "jpg" : "pdf";
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;

  if (!env.hasSupabaseAdmin) {
    const storagePath = path.posix.join("uploads", "labels", safeOrder, fileName);
    const absolutePath = path.join(process.cwd(), "public", storagePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, new Uint8Array(data));
    return { storagePath };
  }

  const supabase = createSupabaseAdminClient();
  const storagePath = `labels/${safeOrder}/${fileName}`;
  const { error } = await supabase.storage.from(env.SUPABASE_PROOF_BUCKET).upload(storagePath, data, {
    cacheControl: "3600",
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return { storagePath };
}

export async function createShippingLabelUrl(storagePath: string) {
  if (!env.hasSupabaseAdmin) {
    return storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(env.SUPABASE_PROOF_BUCKET).createSignedUrl(storagePath, env.SUPABASE_PROOF_SIGNED_URL_EXPIRES_IN);
  if (error) throw error;
  return data.signedUrl;
}
