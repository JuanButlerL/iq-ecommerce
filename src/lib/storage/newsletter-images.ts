import { createSupabaseAdminClient } from "@/lib/auth/supabase/admin";
import { env } from "@/lib/env";
import { writeLocalUpload } from "@/lib/storage/local-storage";

type UploadResult = {
  storagePath: string;
  publicUrl: string;
};

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Same public bucket as product images, under its own folder.
export async function uploadNewsletterImage(file: File, folderKey: string): Promise<UploadResult> {
  if (!env.hasSupabaseAdmin) {
    return writeLocalUpload("newsletters", folderKey, file);
  }

  const supabase = createSupabaseAdminClient();
  const extension = extensionByMimeType[file.type] ?? "jpg";
  const safeFolder = folderKey.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "general";
  const storagePath = `newsletters/${safeFolder}/${crypto.randomUUID()}.${extension}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage.from(env.SUPABASE_PRODUCT_BUCKET).upload(storagePath, arrayBuffer, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(env.SUPABASE_PRODUCT_BUCKET).getPublicUrl(storagePath);

  return { storagePath, publicUrl: data.publicUrl };
}
