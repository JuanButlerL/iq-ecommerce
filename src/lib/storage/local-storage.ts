import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
}

export async function writeLocalUpload(
  folder: string,
  entityKey: string,
  file: File,
) {
  const extension = file.name.split(".").pop() ?? "bin";
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const storagePath = path.posix.join("uploads", folder, entityKey, `${fileName}.${extension}`);
  const absolutePath = path.join(process.cwd(), "public", storagePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return {
    storagePath,
    publicUrl: `/${storagePath.replace(/\\/g, "/")}`,
  };
}
