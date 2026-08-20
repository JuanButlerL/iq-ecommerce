import { PrismaClient, ProductColorTheme, ShippingMode } from "@prisma/client";

import { ARGENTINA_PROVINCES } from "../src/lib/constants/provinces";

const prisma = new PrismaClient();

const productSeed = [
  {
    slug: "caja-mix-x-12-unidades",
    name: "Caja Mix x 12 unidades",
    shortDescription: "Seleccion de 12 barritas con 4 de cada sabor para descubrir el favorito de tu hijo.",
    longDescription:
      "Una caja pensada para probar los tres sabores de IQ Kids y resolver la semana con una sola compra. Incluye 4 de banana, 4 de mani y 4 de cacao.",
    priceArs: 21660,
    homeVarietyLabel: "MIX",
    colorTheme: ProductColorTheme.CACAO,
    visualAccentHex: "#F48991",
    visualSurfaceHex: "#FFF6F7",
    visualTextHex: "#2c2241",
    featured: true,
    sortOrder: 1,
    images: ["/redesign/decision-less-2.jpg"],
  },
  {
    slug: "caja-barritas-cacao-x-12",
    name: "Caja Barritas Cacao x 12 unidades",
    shortDescription: "Barritas con cacao, ingredientes naturales y perfil suave para chicos.",
    longDescription:
      "Una caja pensada para familias que buscan una colacion simple, rica y con sentido comun. Hecha con ingredientes naturales y una identidad visual rosa protagonista.",
    priceArs: 21660,
    homeVarietyLabel: "CACAO",
    colorTheme: ProductColorTheme.CACAO,
    featured: true,
    sortOrder: 2,
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
    homeVarietyLabel: "BANANA",
    colorTheme: ProductColorTheme.BANANA,
    featured: true,
    sortOrder: 3,
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
    homeVarietyLabel: "MANI",
    colorTheme: ProductColorTheme.PEANUT,
    featured: true,
    sortOrder: 4,
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
        "Podés comprar por debajo del mínimo, pero en ese caso se agrega envío según la configuración vigente.",
      transferInstructions:
        "Transferi el monto exacto dentro del plazo de reserva y subi el comprobante para confirmar tu pedido.",
      enableBankTransfer: true,
      enableMercadoPago: true,
      enableBankTransferDiscount: false,
      bankTransferDiscountPercentage: 0,
      orderReservationHours: 24,
      institutionalBanner: "Alimentos con Sentido Comun",
      announcementBarEnabled: true,
      announcementBarText: "Envio gratis en compras mayores a $60.000 - 48/72hs a todo el pais",
      subscriptionSectionEnabled: true,
      subscriptionCtaUrl: "https://wa.me/5491133334444",
      subscriptionHeroNote: "10% off en tu primera compra - 15% para siempre suscribiendote",
      subscriptionItemOne: "6 cajas a eleccion",
      subscriptionItemTwo: "Menu quincenal",
      subscriptionItemThree: "Sesion nutricional",
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
        "Podés comprar por debajo del mínimo, pero en ese caso se agrega envío según la configuración vigente.",
      transferInstructions:
        "Transferi el monto exacto dentro del plazo de reserva y subi el comprobante para confirmar tu pedido.",
      enableBankTransfer: true,
      enableMercadoPago: true,
      enableBankTransferDiscount: false,
      bankTransferDiscountPercentage: 0,
      orderReservationHours: 24,
      institutionalBanner: "Alimentos con Sentido Comun",
      announcementBarEnabled: true,
      announcementBarText: "Envio gratis en compras mayores a $60.000 - 48/72hs a todo el pais",
      subscriptionSectionEnabled: true,
      subscriptionCtaUrl: "https://wa.me/5491133334444",
      subscriptionHeroNote: "10% off en tu primera compra - 15% para siempre suscribiendote",
      subscriptionItemOne: "6 cajas a eleccion",
      subscriptionItemTwo: "Menu quincenal",
      subscriptionItemThree: "Sesion nutricional",
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
        homeVarietyLabel: product.homeVarietyLabel ?? null,
        colorTheme: product.colorTheme,
        visualAccentHex: product.visualAccentHex ?? null,
        visualSurfaceHex: product.visualSurfaceHex ?? null,
        visualTextHex: product.visualTextHex ?? null,
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
        homeVarietyLabel: product.homeVarietyLabel ?? null,
        colorTheme: product.colorTheme,
        visualAccentHex: product.visualAccentHex ?? null,
        visualSurfaceHex: product.visualSurfaceHex ?? null,
        visualTextHex: product.visualTextHex ?? null,
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
      discountType: "PERCENTAGE",
      discountPercentage: 10,
      fixedDiscountArs: null,
      active: true,
    },
    create: {
      code: "BIENVENIDA10",
      description: "Cupon de ejemplo para testing local.",
      discountType: "PERCENTAGE",
      discountPercentage: 10,
      fixedDiscountArs: null,
      active: true,
    },
  });

  const testimonials = [
    {
      name: "Valeria",
      roleLabel: "Mama de Mateo (7) - Buenos Aires",
      quote: "La primera semana, la vianda volvio vacia. Eso no pasaba en meses.",
      sortOrder: 1,
    },
    {
      name: "Marcos",
      roleLabel: "Papa de Tomas (5) - Buenos Aires",
      quote: "Siempre batallamos con los snacks. Esta la pide el solo.",
      sortOrder: 2,
    },
    {
      name: "Caro",
      roleLabel: "Mama de Lucia (9) - Buenos Aires",
      quote: "La lleva al colegio, a la plaza, al club. Va a todos lados.",
      sortOrder: 3,
    },
  ];

  for (const testimonial of testimonials) {
    await prisma.testimonial.upsert({
      where: {
        id: `00000000-0000-0000-0000-00000000000${testimonial.sortOrder}`,
      },
      update: testimonial,
      create: {
        id: `00000000-0000-0000-0000-00000000000${testimonial.sortOrder}`,
        ...testimonial,
        active: true,
      },
    });
  }

  const mixProduct = await prisma.product.findUnique({
    where: { slug: "caja-mix-x-12-unidades" },
  });
  const peanutProduct = await prisma.product.findUnique({
    where: { slug: "caja-barritas-mani-x-12" },
  });
  const cacaoProduct = await prisma.product.findUnique({
    where: { slug: "caja-barritas-cacao-x-12" },
  });
  const bananaProduct = await prisma.product.findUnique({
    where: { slug: "caja-barritas-banana-x-12" },
  });

  if (mixProduct && peanutProduct && cacaoProduct && bananaProduct) {
    const homeSlots = [
      {
        id: "10000000-0000-0000-0000-000000000001",
        slotOrder: 1,
        productId: mixProduct.id,
        eyebrow: "Banana · Mani · Cacao",
        title: "Descubri el favorito de tu hijo",
        description: "Empeza por una seleccion pensada para probar sabores y resolver la semana.",
        quote: "Una genialidad, me di cuenta que su preferido es el de cacao.",
        buttonLabel: "Ver producto ->",
      },
      {
        id: "10000000-0000-0000-0000-000000000002",
        slotOrder: 2,
        productId: peanutProduct.id,
        eyebrow: "Caja Barritas Mani x 12 unidades",
        title: "La vianda resuelta para toda la semana",
        description: "Barritas sabor mani con identidad fresca y acento celeste.",
        quote: "La vianda volvio vacia. Eso no pasaba en meses.",
        buttonLabel: "Ver producto ->",
      },
      {
        id: "10000000-0000-0000-0000-000000000003",
        slotOrder: 3,
        productId: cacaoProduct.id,
        eyebrow: "Caja Barritas Cacao x 12 unidades",
        title: "Chocolate sin leer etiquetas",
        description: "Barritas con cacao, ingredientes naturales y perfil suave para chicos.",
        quote: "Siempre batalle con los snacks. Esta la pide el solo.",
        buttonLabel: "Ver producto ->",
      },
      {
        id: "10000000-0000-0000-0000-000000000004",
        slotOrder: 4,
        productId: bananaProduct.id,
        eyebrow: "Caja Barritas Banana x 12 unidades",
        title: "Ingredientes que reconoces, sabor que acepta",
        description: "Version banana, luminosa y dulce, con identidad amarilla.",
        quote: "La lleva al colegio, a la plaza, al club. Va a todos lados.",
        buttonLabel: "Ver producto ->",
      },
    ];

    for (const slot of homeSlots) {
      await prisma.homeFeaturedProductSlot.upsert({
        where: { slotOrder: slot.slotOrder },
        update: {
          productId: slot.productId,
          eyebrow: slot.eyebrow,
          title: slot.title,
          description: slot.description,
          quote: slot.quote,
          buttonLabel: slot.buttonLabel,
        },
        create: slot,
      });
    }
  }
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
