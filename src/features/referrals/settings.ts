import { prisma } from "@/lib/db/prisma";

export const DEFAULT_REFERRAL_SHARE_MESSAGE =
  "Te paso las barritas que comen mis chicos 🍌🥜🍫 Pocos ingredientes reales y sin azúcar agregada. Con mi código {codigo} tenés {descuento} en tu primera compra en iqkids.com.ar 💛";

export const DEFAULT_REFERRAL_TERMS = [
  "Tu código le da {descuento} a una amiga en su primera compra en la web, sin mínimo, sobre los productos. El envío se cobra como siempre.",
  "Vos sumás {credito} de crédito por cada amiga nueva que compre con tu código, sin tope.",
  "Amiga nueva: su DNI, email, teléfono y dirección no tienen compras anteriores en IQ Kids.",
  "El crédito se acredita cuando se confirma la compra de tu amiga (pago con Mercado Pago o comprobante de transferencia). Si el pedido se cancela o el pago no llega, el crédito se anula.",
  "El crédito vence a los {vigencia} días y se usa en la web con tu código de crédito y tu DNI.",
  "No se suma a otras promociones ni vale con tu propio código. Si el crédito supera la compra, el resto queda para la próxima.",
  "Podemos anular créditos ante usos indebidos. Los cambios en las reglas se avisan con 15 días.",
].join("\n");

export type ReferralSettingsView = {
  enabled: boolean;
  friendDiscountPercentage: number;
  creditAmountArs: number;
  creditValidityDays: number;
  creditHoldDays: number;
  requireManualApproval: boolean;
  shareMessage: string;
  shareImageUrl: string | null;
  termsText: string;
};

export async function getReferralSettings(): Promise<ReferralSettingsView> {
  const settings = await prisma.referralSettings.findUnique({ where: { id: 1 } });

  return {
    enabled: settings?.enabled ?? false,
    friendDiscountPercentage: settings ? Number(settings.friendDiscountPercentage) : 15,
    creditAmountArs: settings?.creditAmountArs ?? 5000,
    creditValidityDays: settings?.creditValidityDays ?? 90,
    creditHoldDays: settings?.creditHoldDays ?? 0,
    requireManualApproval: settings?.requireManualApproval ?? false,
    shareMessage: settings?.shareMessage?.trim() || DEFAULT_REFERRAL_SHARE_MESSAGE,
    shareImageUrl: settings?.shareImageUrl?.trim() || null,
    termsText: settings?.termsText?.trim() || DEFAULT_REFERRAL_TERMS,
  };
}

/** Replaces {codigo}, {descuento}, {credito}, {espera} and {vigencia} in admin-editable texts. */
export function fillReferralTemplate(template: string, settings: ReferralSettingsView, code = "") {
  const credit = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(
    settings.creditAmountArs,
  );

  return template
    .replaceAll("{codigo}", code)
    .replaceAll("{descuento}", `${settings.friendDiscountPercentage}%`)
    .replaceAll("{credito}", credit)
    .replaceAll("{espera}", String(settings.creditHoldDays))
    .replaceAll("{vigencia}", String(settings.creditValidityDays));
}
