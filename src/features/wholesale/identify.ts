import type { WholesaleCustomer } from "@prisma/client";

import { canRememberWholesaleDevices, getTrustedWholesaleCustomerIds, trustWholesaleCustomer } from "@/features/wholesale/device";
import { sendWholesaleNewDeviceNotice } from "@/features/wholesale/new-device-notice";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { normalizeCuit } from "@/lib/utils/cuit";
import { wholesaleIdentifySchema } from "@/lib/validations/wholesale-order";

// Lo que el checkout recibe de un cliente reconocido para precargar el formulario.
export type WholesaleCustomerProfile = {
  id: string;
  email: string;
  cuit: string;
  legalName: string | null;
  businessName: string | null;
  contactName: string;
  phone: string;
  taxCondition: WholesaleCustomer["taxCondition"];
  street: string;
  floor: string | null;
  city: string;
  province: string;
  postalCode: string;
  reference: string | null;
  allowDeferredPayment: boolean;
  extraDiscountPercentage: number;
};

export type WholesaleIdentifyResult =
  | { status: "new" }
  | { status: "needs_cuit" }
  | { status: "recognized"; customers: WholesaleCustomerProfile[] };

export function toWholesaleCustomerProfile(customer: WholesaleCustomer): WholesaleCustomerProfile {
  return {
    id: customer.id,
    email: customer.email,
    cuit: customer.cuit,
    legalName: customer.legalName,
    businessName: customer.businessName,
    contactName: customer.contactName,
    phone: customer.phone,
    taxCondition: customer.taxCondition,
    street: customer.street,
    floor: customer.floor,
    city: customer.city,
    province: customer.province,
    postalCode: customer.postalCode,
    reference: customer.reference,
    allowDeferredPayment: customer.allowDeferredPayment,
    extraDiscountPercentage: Number(customer.extraDiscountPercentage),
  };
}

// Freno a probar CUITs al azar: intentos fallidos por IP en memoria del proceso (igual que la contraseña de /mayoristas).
const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILED_ATTEMPTS = 6;
const FAILED_WINDOW_MS = 15 * 60 * 1000;

function isBlocked(ip: string) {
  const entry = failedAttempts.get(ip);
  if (!entry || entry.resetAt < Date.now()) {
    failedAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
}

function registerFailure(ip: string) {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    failedAttempts.set(ip, { count: 1, resetAt: now + FAILED_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export async function identifyWholesaleCustomer(payload: unknown, request: { ip: string; userAgent: string | null }): Promise<WholesaleIdentifyResult> {
  const { ip } = request;
  const parsed = wholesaleIdentifySchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Revisá el email.", 400, true);
  }

  if (isBlocked(ip)) {
    throw new AppError("Hubo demasiados intentos. Probá de nuevo en unos minutos o escribinos por WhatsApp.", 429, true);
  }

  const { email } = parsed.data;
  const cuit = parsed.data.cuit ? normalizeCuit(parsed.data.cuit) : "";
  const customers = await prisma.wholesaleCustomer.findMany({ where: { email }, orderBy: { createdAt: "asc" } });

  if (customers.length === 0) {
    return { status: "new" };
  }

  const trustedIds = new Set(await getTrustedWholesaleCustomerIds());

  if (cuit) {
    const match = customers.find((customer) => customer.cuit === cuit);

    if (!match) {
      registerFailure(ip);
      throw new AppError("Ese CUIT no coincide con los datos cargados para este email. Revisalo o escribinos por WhatsApp.", 401, true);
    }

    if (!match.active) {
      throw new AppError("Tu cuenta mayorista está pausada. Escribinos por WhatsApp y lo resolvemos.", 403, true);
    }

    // Sin cookie firmable el pedido no podría confirmarse: mejor avisar ahora que fallar al final.
    if (!canRememberWholesaleDevices()) {
      throw new AppError("No podemos validar tu cuenta en este momento. Escribinos por WhatsApp y cargamos tu pedido.", 503, true);
    }

    if (!trustedIds.has(match.id)) {
      sendWholesaleNewDeviceNotice(match, { userAgent: request.userAgent });
    }

    await trustWholesaleCustomer(match.id);
    trustedIds.add(match.id);
  }

  const recognized = customers.filter((customer) => customer.active && trustedIds.has(customer.id));

  if (recognized.length === 0) {
    return { status: "needs_cuit" };
  }

  return { status: "recognized", customers: recognized.map(toWholesaleCustomerProfile) };
}
