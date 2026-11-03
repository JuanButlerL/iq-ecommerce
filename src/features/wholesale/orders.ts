import { OrderStatus, PaymentMethod, PaymentProvider, Prisma, SyncStatus, type WholesaleCustomer } from "@prisma/client";

import { sendEmail } from "@/features/email/provider";
import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { ensureMercadoPagoPreference } from "@/features/orders/services/mercado-pago-service";
import { syncOrder } from "@/features/orders/services/sync-service";
import { getTrustedWholesaleCustomerIds, trustWholesaleCustomer } from "@/features/wholesale/device";
import { buildWholesaleOrderAdminEmail, buildWholesaleOrderCustomerEmail, type WholesaleOrderEmailData } from "@/features/wholesale/order-email";
import {
  WHOLESALE_PAYMENT_METHOD_LABELS,
  buildWholesaleShippingSettings,
  calculateWholesalePricing,
  isSameDeliveryAddress,
  type WholesalePaymentMethod,
} from "@/features/wholesale/pricing";
import { getWholesaleSettings, getWholesaleShippingRule, type WholesaleSettingsData } from "@/features/wholesale/settings";
import { TAX_CONDITION_LABELS, getInvoiceType } from "@/features/wholesale/tax-condition";
import { prisma } from "@/lib/db/prisma";
import { canUseMercadoPagoCheckout } from "@/lib/integrations/mercadopago/client";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { formatCuit } from "@/lib/utils/cuit";
import { buildNextOrderNumber, buildOrderNumberPrefix } from "@/lib/utils/order-number";
import { wholesaleOrderSchema, type WholesaleOrderInput } from "@/lib/validations/wholesale-order";

type CreatedWholesaleOrder = { id: string; publicOrderNumber: string; paymentMethod: PaymentMethod };

// Lo que el pedido necesita del cliente. Un cliente nuevo todavía no existe: se da de alta junto con el pedido.
type OrderCustomer = Pick<
  WholesaleCustomer,
  "email" | "cuit" | "legalName" | "businessName" | "taxCondition" | "allowDeferredPayment" | "street" | "floor" | "city" | "province" | "postalCode"
> & { id: string | null; extraDiscountPercentage: number | Prisma.Decimal };

type ResolvedCustomer =
  | { isNewCustomer: false; customer: WholesaleCustomer; createData: null }
  | { isNewCustomer: true; customer: OrderCustomer; createData: Prisma.WholesaleCustomerUncheckedCreateInput };

// Mercado Pago necesita estar habilitado en Condiciones y configurado en el servidor.
export function isPaymentMethodEnabled(method: WholesalePaymentMethod, settings: Pick<WholesaleSettingsData, "enableMercadoPago" | "enableBankTransfer" | "enableEcheq">) {
  if (method === "MERCADO_PAGO") return settings.enableMercadoPago && canUseMercadoPagoCheckout();
  if (method === "BANK_TRANSFER") return settings.enableBankTransfer;
  if (method === "ECHEQ") return settings.enableEcheq;
  return true;
}

function splitName(fullName: string) {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName: firstName ?? fullName, lastName: rest.join(" ") };
}

export async function createWholesaleOrder(payload: unknown) {
  const parsed = wholesaleOrderSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Revisá los datos del pedido.", 400, true);
  }

  const input = parsed.data;
  const existingOrder = await prisma.order.findUnique({
    where: { checkoutRequestKey: input.checkoutRequestKey },
    select: { id: true, publicOrderNumber: true, paymentMethod: true },
  });

  if (existingOrder) {
    return buildResponse(existingOrder);
  }

  const [settings, shippingRule] = await Promise.all([getWholesaleSettings(), getWholesaleShippingRule()]);

  if (!isPaymentMethodEnabled(input.paymentMethod, settings)) {
    throw new AppError("Ese medio de pago no está disponible. Elegí otro.", 400, true);
  }

  // Productos: precio y disponibilidad salen siempre de la base, nunca del navegador.
  const productIds = [...new Set(input.items.map((item) => item.wholesaleProductId))];
  const products = await prisma.wholesaleProduct.findMany({ where: { id: { in: productIds }, active: true, soldOut: false } });

  if (products.length !== productIds.length) {
    throw new AppError("Uno o más productos ya no están disponibles. Revisá tu pedido.", 400, true);
  }

  const lines = input.items.map((item) => {
    const product = products.find((entry) => entry.id === item.wholesaleProductId)!;
    return { product, quantity: item.quantity, priceArs: product.priceArs };
  });
  const displays = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (displays < settings.minDisplays) {
    throw new AppError(`El pedido mínimo es de ${settings.minDisplays} displays (podés combinar productos).`, 400, true);
  }

  const { customer, isNewCustomer, createData } = await resolveCustomer(input);
  const deliveryAddressChanged = !isNewCustomer && !isSameDeliveryAddress(customer, input.delivery);

  if (input.paymentMethod === "DEFERRED") {
    if (!customer.allowDeferredPayment) {
      throw new AppError("El pago posterior a la entrega no está habilitado para tu cuenta. Elegí otro medio de pago.", 400, true);
    }
    if (deliveryAddressChanged) {
      throw new AppError("El pago posterior a la entrega solo está disponible para tu dirección habitual. Elegí otro medio de pago o usá esa dirección.", 400, true);
    }
  }

  const subtotalArs = lines.reduce((sum, line) => sum + line.priceArs * line.quantity, 0);
  const shippingQuote = calculateShippingQuote(subtotalArs, input.delivery.province, buildWholesaleShippingSettings(shippingRule, settings.freeShippingThresholdArs));
  const pricing = calculateWholesalePricing({
    lines,
    extraDiscountPercentage: Number(customer.extraDiscountPercentage),
    paymentMethod: input.paymentMethod,
    enableBankTransferDiscount: settings.enableBankTransferDiscount,
    bankTransferDiscountPercentage: settings.bankTransferDiscountPercentage,
    shippingArs: shippingQuote.shippingArs,
  });
  const { firstName, lastName } = splitName(input.delivery.contactName);
  const paymentMethod = input.paymentMethod as PaymentMethod;
  let created: (CreatedWholesaleOrder & { customerId: string }) | null = null;

  for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
    try {
      created = await prisma.$transaction(async (tx) => {
        // Si el pedido no llega a crearse, el cliente nuevo tampoco queda en el maestro.
        const customerId = createData ? (await tx.wholesaleCustomer.create({ data: createData })).id : customer.id!;
        const prefix = buildOrderNumberPrefix();
        const latest = await tx.order.findFirst({
          where: { publicOrderNumber: { startsWith: prefix } },
          orderBy: { createdAt: "desc" },
          select: { publicOrderNumber: true },
        });
        const order = await tx.order.create({
          data: {
            publicOrderNumber: buildNextOrderNumber(prefix, latest?.publicOrderNumber),
            checkoutRequestKey: input.checkoutRequestKey,
            channel: "WHOLESALE",
            wholesaleCustomerId: customerId,
            customerFirstName: firstName,
            customerLastName: lastName,
            customerEmail: customer.email,
            customerPhone: input.delivery.phone,
            customerTaxId: customer.cuit,
            customerBusinessName: customer.legalName || customer.businessName,
            customerTaxCondition: input.taxCondition,
            province: input.delivery.province,
            locality: input.delivery.city,
            postalCode: input.delivery.postalCode,
            addressLine: input.delivery.street,
            addressExtra: [input.delivery.floor, input.delivery.reference].filter(Boolean).join(" · ") || null,
            notes: input.notes,
            extraDiscountPercentage: pricing.extraDiscountArs > 0 ? pricing.extraDiscountPercentage : null,
            extraDiscountArs: pricing.extraDiscountArs,
            paymentMethodDiscountPercentage: pricing.transferDiscountArs > 0 ? pricing.transferDiscountPercentage : null,
            paymentMethodDiscountArs: pricing.transferDiscountArs,
            subtotalArs: pricing.subtotalArs,
            shippingArs: pricing.shippingArs,
            totalArs: pricing.totalArs,
            paymentMethod,
            paymentProvider: paymentMethod === "MERCADO_PAGO" ? PaymentProvider.MERCADO_PAGO : PaymentProvider.MANUAL_TRANSFER,
            paymentProviderStatus: paymentMethod === "MERCADO_PAGO" ? "pending" : null,
            paymentProviderStatusDetail: paymentMethod === "MERCADO_PAGO" ? "waiting_checkout" : null,
            deliveryAddressChanged,
            syncStatus: SyncStatus.PENDING,
          },
        });

        await tx.orderItem.createMany({
          data: lines.map((line) => ({
            orderId: order.id,
            productId: line.product.productId,
            wholesaleProductId: line.product.id,
            productNameSnapshot: `${line.product.name} (display x${line.product.unitsPerDisplay})`,
            unitPriceArs: line.priceArs,
            quantity: line.quantity,
            lineTotalArs: line.priceArs * line.quantity,
          })),
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: OrderStatus.PENDING_PAYMENT,
            note: [
              `Pedido mayorista (${displays} displays) con ${WHOLESALE_PAYMENT_METHOD_LABELS[input.paymentMethod]}.`,
              isNewCustomer ? "Cliente nuevo." : null,
              pricing.extraDiscountArs > 0 ? `Descuento especial del CUIT ${pricing.extraDiscountPercentage}%.` : null,
              pricing.transferDiscountArs > 0 ? `Descuento por transferencia ${pricing.transferDiscountPercentage}%.` : null,
              deliveryAddressChanged ? "Dirección de entrega distinta a la del maestro." : null,
            ]
              .filter(Boolean)
              .join(" "),
            changedBy: "system",
          },
        });

        // La condición frente al IVA declarada en el pedido queda como la vigente del cliente.
        if (!createData && customer.taxCondition !== input.taxCondition) {
          await tx.wholesaleCustomer.update({ where: { id: customerId }, data: { taxCondition: input.taxCondition } });
        }

        return { id: order.id, publicOrderNumber: order.publicOrderNumber, paymentMethod: order.paymentMethod, customerId };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // Otro pedido dio de alta el mismo CUIT en paralelo.
        if (String(error.meta?.target ?? "").includes("cuit")) {
          throw new AppError("Ese CUIT ya está registrado. Escribinos por WhatsApp y lo resolvemos.", 409, true);
        }
        const duplicated = await prisma.order.findUnique({
          where: { checkoutRequestKey: input.checkoutRequestKey },
          select: { id: true, publicOrderNumber: true, paymentMethod: true },
        });
        if (duplicated) return buildResponse(duplicated);
        continue;
      }
      throw error;
    }
  }

  if (!created) {
    throw new AppError("No pudimos generar el número de pedido. Probá de nuevo.", 500, true);
  }

  if (isNewCustomer) {
    await trustWholesaleCustomer(created.customerId);
  }

  await syncOrder(created.id).catch(async (syncError) => {
    await prisma.order.update({
      where: { id: created.id },
      data: { syncStatus: SyncStatus.ERROR, syncLastError: syncError instanceof Error ? syncError.message : "Sync error" },
    });
  });

  await notifyWholesaleOrder({
    orderNumber: created.publicOrderNumber,
    orderId: created.id,
    settings,
    data: {
      orderNumber: created.publicOrderNumber,
      createdAt: new Date(),
      contactName: input.delivery.contactName,
      email: customer.email,
      phone: input.delivery.phone,
      cuit: formatCuit(customer.cuit),
      businessName: customer.businessName || customer.legalName,
      taxConditionLabel: TAX_CONDITION_LABELS[input.taxCondition],
      invoiceType: getInvoiceType(input.taxCondition),
      address: [input.delivery.street, input.delivery.floor, input.delivery.city, input.delivery.province, `CP ${input.delivery.postalCode}`].filter(Boolean).join(", "),
      reference: input.delivery.reference,
      notes: input.notes,
      paymentMethod: input.paymentMethod,
      items: lines.map((line) => ({
        name: `${line.product.name} (display x${line.product.unitsPerDisplay})`,
        quantity: line.quantity,
        unitPriceArs: line.priceArs,
        lineTotalArs: line.priceArs * line.quantity,
      })),
      subtotalArs: pricing.subtotalArs,
      extraDiscountArs: pricing.extraDiscountArs,
      extraDiscountPercentage: pricing.extraDiscountPercentage,
      transferDiscountArs: pricing.transferDiscountArs,
      shippingArs: pricing.shippingArs,
      totalArs: pricing.totalArs,
      isNewCustomer,
      deliveryAddressChanged,
    },
  });

  return buildResponse(created);
}

// Cliente existente: solo si este navegador ya lo identificó (email + CUIT). Cliente nuevo: se da de alta con pago anticipado.
async function resolveCustomer(input: WholesaleOrderInput): Promise<ResolvedCustomer> {
  if (input.customer.mode === "existing") {
    const trustedIds = await getTrustedWholesaleCustomerIds();
    const customer = trustedIds.includes(input.customer.customerId)
      ? await prisma.wholesaleCustomer.findUnique({ where: { id: input.customer.customerId } })
      : null;

    if (!customer) {
      throw new AppError("Volvé a identificarte con tu email y CUIT para confirmar el pedido.", 401, true);
    }
    if (!customer.active) {
      throw new AppError("Tu cuenta mayorista está pausada. Escribinos por WhatsApp y lo resolvemos.", 403, true);
    }

    return { customer, isNewCustomer: false, createData: null };
  }

  const { email, cuit, legalName, businessName, businessType } = input.customer;
  const [sameEmail, sameCuit] = await Promise.all([
    prisma.wholesaleCustomer.count({ where: { email } }),
    prisma.wholesaleCustomer.findUnique({ where: { cuit }, select: { email: true } }),
  ]);

  if (sameEmail > 0) {
    throw new AppError("Ese email ya está registrado. Volvé al paso anterior e identificate con tu CUIT.", 409, true);
  }
  if (sameCuit) {
    throw new AppError("Ese CUIT ya está registrado con otro email. Escribinos por WhatsApp y lo resolvemos.", 409, true);
  }

  const createData = {
    email,
    cuit,
    legalName,
    businessName,
    businessType,
    taxCondition: input.taxCondition,
    contactName: input.delivery.contactName,
    phone: input.delivery.phone,
    street: input.delivery.street,
    floor: input.delivery.floor,
    city: input.delivery.city,
    province: input.delivery.province,
    postalCode: input.delivery.postalCode,
    reference: input.delivery.reference,
  };

  return {
    isNewCustomer: true,
    customer: { ...createData, id: null, allowDeferredPayment: false, extraDiscountPercentage: 0 },
    createData,
  };
}

async function buildResponse(order: CreatedWholesaleOrder) {
  const mercadoPago = order.paymentMethod === PaymentMethod.MERCADO_PAGO ? await ensureMercadoPagoPreference(order.id) : null;
  return { orderNumber: order.publicOrderNumber, paymentMethod: order.paymentMethod, mercadoPago };
}

// Los avisos nunca hacen fallar el pedido: si un email no sale, queda en el log.
async function notifyWholesaleOrder({
  orderNumber,
  orderId,
  settings,
  data,
}: {
  orderNumber: string;
  orderId: string;
  settings: WholesaleSettingsData;
  data: WholesaleOrderEmailData;
}) {
  if (!env.canSendEmail) {
    return;
  }

  const customerEmail = buildWholesaleOrderCustomerEmail(data, { orderUrl: `${env.NEXT_PUBLIC_SITE_URL}/mayoristas/pedido/${orderNumber}` });
  const adminEmail = buildWholesaleOrderAdminEmail(data, { adminUrl: `${env.NEXT_PUBLIC_SITE_URL}/admin/pedidos/${orderId}` });
  const sends = [
    { to: data.email, replyTo: settings.orderNotificationEmails[0] ?? null, ...customerEmail },
    ...settings.orderNotificationEmails.map((to) => ({ to, replyTo: data.email, ...adminEmail })),
  ];

  for (const message of sends) {
    try {
      await sendEmail({
        fromEmail: env.EMAIL_FROM_DEFAULT,
        senderName: "IQ Kids Mayoristas",
        replyToEmail: message.replyTo ?? undefined,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    } catch (error) {
      console.error("wholesale order email failed", { orderNumber, to: message.to, error });
    }
  }
}
