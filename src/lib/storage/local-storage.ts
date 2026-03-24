import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export async function writeLocalUpload(
  folder: string,
  entityKey: string,
  file: File,
) {
  const extension = sanitizeFileName(file.name.split(".").pop() ?? "bin").replace(/\.+/g, "") || "bin";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(baseName)}`;
  const storagePath = path.posix.join(
    "uploads",
    sanitizePathSegment(folder),
    sanitizePathSegment(entityKey),
    `${fileName}.${extension}`,
  );
  const absolutePath = path.join(process.cwd(), "public", storagePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return {
    storagePath,
    publicUrl: `/${storagePath.replace(/\\/g, "/")}`,
  };
}
