import crypto from "node:crypto";

import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";

const VERSION = "v1";

// AES-256-GCM. Formato: v1:<iv>:<tag>:<ciphertext>, todo en base64.
export function encryptSecret(plain: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
}

export function decryptSecret(payload: string) {
  const [version, iv, tag, data] = payload.split(":");

  if (version !== VERSION || !iv || !tag || !data) {
    throw new AppError("Secreto cifrado con formato no valido.", 500, false);
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export function hasSecretKey() {
  return /^[0-9a-fA-F]{64}$/.test(env.WHATSAPP_TOKEN_ENCRYPTION_KEY ?? "");
}

function getKey() {
  if (!hasSecretKey()) {
    throw new AppError("WHATSAPP_TOKEN_ENCRYPTION_KEY no configurada (64 caracteres hex).", 503);
  }

  return Buffer.from(env.WHATSAPP_TOKEN_ENCRYPTION_KEY as string, "hex");
}
