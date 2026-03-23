import { createSupabaseAdminClient } from "@/lib/auth/supabase/admin";
import { env } from "@/lib/env";
import { writeLocalUpload } from "@/lib/storage/local-storage";

export async function uploadPaymentProof(file: File, orderNumber: string) {
  if (!env.hasSupabaseAdmin) {
    const uploaded = await writeLocalUpload("proofs", orderNumber, file);

    return {
      storagePath: uploaded.storagePath,
      publicUrl: uploaded.publicUrl,
    };
  }

  const supabase = createSupabaseAdminClient();
  const extension = file.name.split(".").pop() ?? "pdf";
  const storagePath = `proofs/${orderNumber}/${crypto.randomUUID()}.${extension}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage.from(env.SUPABASE_PROOF_BUCKET).upload(storagePath, arrayBuffer, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return {
    storagePath,
    publicUrl: env.enableProofPublicUrlSync
      ? supabase.storage.from(env.SUPABASE_PROOF_BUCKET).getPublicUrl(storagePath).data.publicUrl
      : null,
  };
}

export async function createPaymentProofSignedUrl(storagePath: string) {
  if (!env.hasSupabaseAdmin) {
    return storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(env.SUPABASE_PROOF_BUCKET)
    .createSignedUrl(storagePath, env.SUPABASE_PROOF_SIGNED_URL_EXPIRES_IN);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
