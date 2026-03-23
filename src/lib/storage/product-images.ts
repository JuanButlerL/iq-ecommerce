import { createSupabaseAdminClient } from "@/lib/auth/supabase/admin";
import { env } from "@/lib/env";
import { writeLocalUpload } from "@/lib/storage/local-storage";

type UploadResult = {
  storagePath: string;
  publicUrl: string;
};

export async function uploadProductImage(file: File, slug: string): Promise<UploadResult> {
  if (!env.hasSupabaseAdmin) {
    return writeLocalUpload("products", slug, file);
  }

  const supabase = createSupabaseAdminClient();
  const extension = file.name.split(".").pop() ?? "jpg";
  const storagePath = `products/${slug}/${crypto.randomUUID()}.${extension}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(env.SUPABASE_PRODUCT_BUCKET)
    .upload(storagePath, arrayBuffer, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(env.SUPABASE_PRODUCT_BUCKET).getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: data.publicUrl,
  };
}
