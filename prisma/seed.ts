import { PrismaClient, ProductColorTheme, ShippingMode } from "@prisma/client";

import { ARGENTINA_PROVINCES } from "../src/lib/constants/provinces";

const prisma = new PrismaClient();

const productSeed = [
  {
    slug: "caja-barritas-cacao-x-12",
    name: "Caja Barritas Cacao x 12 unidades",
    shortDescription: "Barritas con cacao, ingredientes naturales y perfil suave para chicos.",
    longDescription:
      "Una caja pensada para familias que buscan una colacion simple, rica y con sentido comun. Hecha con ingredientes naturales y una identidad visual rosa protagonista.",
    priceArs: 21660,
    colorTheme: ProductColorTheme.CACAO,
    featured: true,
    sortOrder: 1,
    images: [
      "/placeholders/products/cacao-1.svg",
      "/placeholders/products/cacao-2.svg",
      "/placeholders/products/cacao-3.svg",
    ],
  },
  {
    slug: "caja-barritas-banana-x-12",
    name: "Caja Barritas Banana x 12 unidades",
    shortDescription: "Version banana, luminosa y dulce, con identidad amarilla.",
    longDescription:
      "La caja de banana mantiene el lenguaje premium e infantil de IQ Kids con una lectura clara, amigable y lista para comprar en pocos pasos.",
    priceArs: 21660,
    colorTheme: ProductColorTheme.BANANA,
    featured: true,
    sortOrder: 2,
    images: [
      "/placeholders/products/banana-1.svg",
      "/placeholders/products/banana-2.svg",
      "/placeholders/products/banana-3.svg",
    ],
  },
  {
    slug: "caja-barritas-mani-x-12",
    name: "Caja Barritas Mani x 12 unidades",
    shortDescription: "Barritas sabor mani con identidad fresca y acento celeste.",
    longDescription:
      "La opcion mani completa la linea inicial de tres productos, con composicion limpia, fuerte presencia de marca y una experiencia de compra directa.",
    priceArs: 21660,
    colorTheme: ProductColorTheme.PEANUT,
    featured: true,
    sortOrder: 3,
    images: [
      "/placeholders/products/mani-1.svg",
      "/placeholders/products/mani-2.svg",
      "/placeholders/products/mani-3.svg",
    ],
  },
];

async function main() {
  const shippingRule = await prisma.shippingRule.upsert({
    where: {
      id: "11111111-1111-1111-1111-111111111111",
    },
    update: {
      name: "Regla nacional base",
      mode: ShippingMode.FLAT,
      flatPrice: 6500,
      active: true,
      isDefault: true,
    },
    create: {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Regla nacional base",
      description: "Configuracion inicial editable desde admin.",
      mode: ShippingMode.FLAT,
      flatPrice: 6500,
      active: true,
      isDefault: true,
    },
  });

  await prisma.shippingRuleProvince.deleteMany({
    where: { shippingRuleId: shippingRule.id },
  });

  await prisma.shippingRuleProvince.createMany({
    data: ARGENTINA_PROVINCES.map((province) => ({
      shippingRuleId: shippingRule.id,
      provinceCode: province.code,
      provinceName: province.name,
      shippingPrice: province.shippingPrice,
      active: true,
    })),
  });

  await prisma.storeSettings.upsert({
    where: { id: "default" },
    update: {
      storeName: "IQ Kids",
      storeCurrency: "ARS",
      whatsappNumber: "5491133334444",
      instagramUrl: "https://www.instagram.com/iqkidsok",
      contactEmail: "hola@iqkids.com.ar",
      bankAlias: "IQKIDS.TIENDA",
      bankCbu: "0000003100000000000001",
      bankName: "Banco Galicia",
      bankHolder: "IQ Kids SAS",
      bankTaxId: "30-00000000-7",
      minimumOrderAmount: 20000,
      freeShippingThreshold: 60000,
      flatShippingPrice: 6500,
      shippingMode: ShippingMode.FLAT,
      activeShippingRuleId: shippingRule.id,
      checkoutMessage:
        "Podes comprar por debajo del minimo, pero en ese caso se agrega envio segun la configuracion vigente.",
      transferInstructions:
        "Transferi el monto exacto dentro del plazo de reserva y subi el comprobante para confirmar tu pedido.",
      enableBankTransfer: true,
      enableMercadoPago: true,
      enableBankTransferDiscount: false,
      bankTransferDiscountPercentage: 0,
      orderReservationHours: 24,
      institutionalBanner: "Alimentos con Sentido Comun",
      purchaseSuccessMessage:
        "Recibimos tu comprobante. Nuestro equipo va a validar el pago y avanzar con la preparacion.",
      requireTaxId: false,
      showFloatingWhatsapp: true,
      isStoreOpen: true,
    },
    create: {
      id: "default",
      storeName: "IQ Kids",
      storeCurrency: "ARS",
      whatsappNumber: "5491133334444",
      instagramUrl: "https://www.instagram.com/iqkidsok",
      contactEmail: "hola@iqkids.com.ar",
      bankAlias: "IQKIDS.TIENDA",
      bankCbu: "0000003100000000000001",
      bankName: "Banco Galicia",
      bankHolder: "IQ Kids SAS",
      bankTaxId: "30-00000000-7",
      minimumOrderAmount: 20000,
      freeShippingThreshold: 60000,
      flatShippingPrice: 6500,
      shippingMode: ShippingMode.FLAT,
      activeShippingRuleId: shippingRule.id,
      checkoutMessage:
        "Podes comprar por debajo del minimo, pero en ese caso se agrega envio segun la configuracion vigente.",
      transferInstructions:
        "Transferi el monto exacto dentro del plazo de reserva y subi el comprobante para confirmar tu pedido.",
      enableBankTransfer: true,
      enableMercadoPago: true,
      enableBankTransferDiscount: false,
      bankTransferDiscountPercentage: 0,
      orderReservationHours: 24,
      institutionalBanner: "Alimentos con Sentido Comun",
      purchaseSuccessMessage:
        "Recibimos tu comprobante. Nuestro equipo va a validar el pago y avanzar con la preparacion.",
      requireTaxId: false,
      showFloatingWhatsapp: true,
      isStoreOpen: true,
    },
  });

  await prisma.adminUser.upsert({
    where: { email: "admin@iqkids.local" },
    update: {
      fullName: "IQ Kids Admin",
      active: true,
    },
    create: {
      email: "admin@iqkids.local",
      fullName: "IQ Kids Admin",
      active: true,
      role: "SUPER_ADMIN",
    },
  });

  for (const product of productSeed) {
    const savedProduct = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        priceArs: product.priceArs,
        colorTheme: product.colorTheme,
        active: true,
        visible: true,
        manualSoldOut: false,
        featured: product.featured,
        sortOrder: product.sortOrder,
      },
      create: {
        slug: product.slug,
        name: product.name,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        priceArs: product.priceArs,
        colorTheme: product.colorTheme,
        active: true,
        visible: true,
        manualSoldOut: false,
        featured: product.featured,
        sortOrder: product.sortOrder,
      },
    });

    await prisma.productImage.deleteMany({
      where: { productId: savedProduct.id },
    });

    await prisma.productImage.createMany({
      data: product.images.map((image, index) => ({
        productId: savedProduct.id,
        filePath: image,
        publicUrl: image,
        altText: `${product.name} imagen ${index + 1}`,
        sortOrder: index,
        isPrimary: index === 0,
      })),
    });
  }

  await prisma.coupon.upsert({
    where: { code: "BIENVENIDA10" },
    update: {
      description: "Cupon de ejemplo para testing local.",
      discountPercentage: 10,
      active: true,
    },
    create: {
      code: "BIENVENIDA10",
      description: "Cupon de ejemplo para testing local.",
      discountPercentage: 10,
      active: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
