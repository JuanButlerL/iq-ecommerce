import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { hasWholesaleAccess } from "@/features/wholesale/access";
import { WholesaleCheckout } from "@/features/wholesale/components/wholesale-checkout";
import { getTrustedWholesaleCustomerIds } from "@/features/wholesale/device";
import { toWholesaleCustomerProfile } from "@/features/wholesale/identify";
import { getPublicWholesaleProducts } from "@/features/wholesale/products";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { getWholesaleSettings, getWholesaleShippingRule } from "@/features/wholesale/settings";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "Tu pedido mayorista",
  robots: { index: false, follow: false },
};

export default async function WholesaleCartPage() {
  const content = await getWholesaleContent();

  if (!content.enabled) {
    notFound();
  }

  if (!(await hasWholesaleAccess(content))) {
    redirect("/mayoristas");
  }

  const [products, settings, shippingRule, trustedIds] = await Promise.all([
    getPublicWholesaleProducts(),
    getWholesaleSettings(),
    getWholesaleShippingRule(),
    getTrustedWholesaleCustomerIds(),
  ]);
  // Un navegador recordado arranca con sus clientes ya identificados.
  const trustedCustomers =
    trustedIds.length > 0
      ? await prisma.wholesaleCustomer.findMany({ where: { id: { in: trustedIds }, active: true }, orderBy: { createdAt: "asc" } })
      : [];

  return (
    <WholesaleCheckout
      products={products.map((product) => ({
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        imageAlt: product.imageAlt,
        priceArs: product.priceArs,
        unitsPerDisplay: product.unitsPerDisplay,
        soldOut: product.soldOut,
      }))}
      settings={{
        minDisplays: settings.minDisplays,
        enableMercadoPago: settings.enableMercadoPago,
        enableBankTransfer: settings.enableBankTransfer,
        enableEcheq: settings.enableEcheq,
        echeqInstructions: settings.echeqInstructions,
        enableBankTransferDiscount: settings.enableBankTransferDiscount,
        bankTransferDiscountPercentage: settings.bankTransferDiscountPercentage,
        freeShippingThresholdArs: settings.freeShippingThresholdArs,
      }}
      shippingRule={{
        mode: shippingRule.mode,
        flatPrice: shippingRule.flatPrice,
        discountThresholdArs: shippingRule.discountThresholdArs,
        discountPercentage: shippingRule.discountPercentage,
        provinces: shippingRule.provinces.map((province) => ({
          active: province.active,
          provinceName: province.provinceName,
          shippingPrice: province.shippingPrice,
        })),
      }}
      businessTypes={content.contact.businessTypes}
      trustedCustomers={trustedCustomers.map(toWholesaleCustomerProfile)}
    />
  );
}
