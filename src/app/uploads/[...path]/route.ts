import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

const contentTypeByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

function sanitizeSegments(segments: string[]) {
  return segments.filter((segment) => segment && segment !== "." && segment !== "..");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: rawSegments } = await params;
    const segments = sanitizeSegments(rawSegments);

    if (segments.length === 0) {
      return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    }

    const relativePath = path.join("public", "uploads", ...segments);
    const absolutePath = path.join(process.cwd(), relativePath);
    const fileBuffer = await readFile(absolutePath);
    const extension = path.extname(absolutePath).toLowerCase();

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentTypeByExtension[extension] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
  }
}
