import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

import { AppError } from "@/lib/errors/app-error";
import { env } from "@/lib/env";

let mercadoPagoClient: MercadoPagoConfig | null = null;

function assertMercadoPagoEnvironment() {
  if (!env.mercadoPagoEnabled) {
    throw new AppError("Mercado Pago no esta habilitado en este entorno.", 400);
  }

  if (!env.hasMercadoPagoAccessToken) {
    throw new AppError("La configuracion de Mercado Pago esta incompleta.", 500, false);
  }

  if (env.MERCADO_PAGO_ENVIRONMENT === "production" && env.mercadoPagoUsesTestToken) {
    throw new AppError("La configuracion de Mercado Pago es invalida para produccion.", 500, false);
  }

  if (env.MERCADO_PAGO_ENVIRONMENT === "sandbox" && !env.mercadoPagoUsesTestToken) {
    throw new AppError("La configuracion de Mercado Pago sandbox requiere un access token TEST-.", 500, false);
  }
}

export function canUseMercadoPagoCheckout() {
  return env.mercadoPagoEnabled && env.hasMercadoPagoAccessToken;
}

export function getMercadoPagoClient() {
  assertMercadoPagoEnvironment();

  if (!mercadoPagoClient) {
    mercadoPagoClient = new MercadoPagoConfig({
      accessToken: env.MERCADO_PAGO_ACCESS_TOKEN ?? "",
      options: {
        timeout: 5000,
      },
    });
  }

  return mercadoPagoClient;
}

export function getMercadoPagoPreferenceClient() {
  return new Preference(getMercadoPagoClient());
}

export function getMercadoPagoPaymentClient() {
  return new Payment(getMercadoPagoClient());
}

export function getMercadoPagoNotificationUrl() {
  if (!env.hasMercadoPagoWebhookSecret) {
    return undefined;
  }

  return new URL("/api/payments/mercadopago/webhook", env.NEXT_PUBLIC_SITE_URL).toString();
}

export function getMercadoPagoReturnUrl(orderNumber: string) {
  return new URL(`/checkout/mercado-pago/${orderNumber}/retorno`, env.NEXT_PUBLIC_SITE_URL).toString();
}

export function getMercadoPagoStatementDescriptor() {
  return env.MERCADO_PAGO_STATEMENT_DESCRIPTOR?.trim() || undefined;
}

export function isMercadoPagoPublicSiteUrl() {
  try {
    const siteUrl = new URL(env.NEXT_PUBLIC_SITE_URL);

    return !["localhost", "127.0.0.1"].includes(siteUrl.hostname);
  } catch {
    return false;
  }
}

export function getMercadoPagoWebhookSecret() {
  if (!env.MERCADO_PAGO_WEBHOOK_SECRET) {
    throw new AppError("Falta MERCADO_PAGO_WEBHOOK_SECRET.", 500, false);
  }

  return env.MERCADO_PAGO_WEBHOOK_SECRET;
}

export function preferMercadoPagoSandboxUrl() {
  return env.MERCADO_PAGO_ENVIRONMENT === "sandbox";
}
