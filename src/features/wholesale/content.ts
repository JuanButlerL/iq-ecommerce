// Contenido editable de /mayoristas. Se guarda como un único JSON en wholesale_page;
// si todavía no hay nada guardado (o el JSON es inválido) se usa DEFAULT_WHOLESALE_CONTENT.

export const WHOLESALE_BARS_PER_DISPLAY = 12;

export type WholesaleSectionIntro = {
  eyebrow: string;
  title: string;
  description: string;
};

export type WholesaleContent = {
  enabled: boolean;
  // "scrypt$<salt>$<hash>" de la contraseña para ver /mayoristas. Vacío = página abierta.
  // Nunca se manda al navegador: el admin solo ve si hay contraseña o no.
  accessPasswordHash: string;
  seoTitle: string;
  seoDescription: string;
  // Vacío = se usa el WhatsApp de Configuración.
  whatsappNumber: string;
  topbar: string;
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    description: string;
    chips: { label: string; accent: boolean }[];
    primaryCta: string;
    secondaryCta: string;
  };
  stats: { value: string; label: string }[];
  products: WholesaleSectionIntro & {
    items: { name: string; description: string; imageUrl: string; imageAlt: string }[];
  };
  profiles: WholesaleSectionIntro & { items: { icon: string; title: string; description: string }[] };
  reasons: WholesaleSectionIntro & { items: { icon: string; title: string; description: string }[] };
  conditions: WholesaleSectionIntro & {
    plans: {
      icon: string;
      title: string;
      subtitle: string;
      price: number;
      priceUnit: string;
      highlighted: boolean;
      rows: { label: string; value: string; note: string }[];
      cta: string;
    }[];
  };
  steps: WholesaleSectionIntro & { items: { title: string; description: string }[] };
  testimonials: WholesaleSectionIntro & { items: { tag: string; quote: string; name: string; meta: string }[] };
  contact: WholesaleSectionIntro & {
    leadTitle: string;
    leadDescription: string;
    // Casillas que reciben un aviso por cada consulta nueva. Vacío = sin aviso.
    leadNotificationEmails: string[];
    businessTypes: string[];
    monthlyVolumes: string[];
    // Mientras esté en false, la pestaña "Ya soy cliente" muestra "Próximamente".
    orderEnabled: boolean;
    orderComingSoonText: string;
    orderTitle: string;
    orderDescription: string;
    minDisplays: number;
    orderItems: { name: string; price: number }[];
  };
  faq: WholesaleSectionIntro & { items: { question: string; answer: string }[] };
};

export const DEFAULT_WHOLESALE_CONTENT: WholesaleContent = {
  enabled: true,
  accessPasswordHash: "scrypt$a4bf856f2cb32468980b2d349333ab84$ef4b1d70a6793c5017dfd63f2f09d77fc39cd1b709ceac25dcda143d60728629",
  seoTitle: "Snack saludable sin azúcar por mayor",
  seoDescription:
    "Snack saludable sin azúcar por mayor para dietéticas, kioscos y tiendas. Barritas de 4 a 6 ingredientes, sin azúcar agregada y sin TACC. Precio mayorista y respuesta en 24 horas.",
  whatsappNumber: "",
  topbar: "Venta mayorista · Envíos a todo el país · Respuesta en 24 horas",
  hero: {
    eyebrow: "Venta mayorista y distribuidores",
    title: "Snack saludable sin azúcar por mayor.",
    titleAccent: "Precio para dietéticas, kioscos, tiendas y más.",
    description:
      "Barritas para chicos con solo 4 a 6 ingredientes reales, sin azúcar agregada y sin TACC. Precio mayorista para comercios y distribuidores, envíos a todo el país y respuesta en 24 horas.",
    chips: [
      { label: "4 a 6 ingredientes", accent: false },
      { label: "Sin azúcar agregada", accent: false },
      { label: "Sin TACC", accent: false },
      { label: "Precio mayorista", accent: true },
      { label: "Respuesta en 24 h", accent: true },
    ],
    primaryCta: "Quiero precio mayorista →",
    secondaryCta: "Ya soy cliente: hacer pedido",
  },
  stats: [
    { value: "+5.000", label: "familias ya la probaron\nonline y en más de 130 comercios" },
    { value: "4 a 6", label: "ingredientes reales\nsegún el sabor" },
    { value: "0 g", label: "de azúcar agregada\nen cada barrita" },
    { value: "Sin TACC", label: "certificación oficial\nen el packaging" },
  ],
  products: {
    eyebrow: "Los productos",
    title: "Tres sabores y una Caja Mix",
    description:
      "Barritas de 30 g en display de 12 unidades. El display va directo al mostrador: el cliente ve los ingredientes en el frente del envase.",
    items: [
      { name: "Maní", description: "4 ingredientes. Display x12 barritas de 30 g.", imageUrl: "/mayoristas/mani.jpg", imageAlt: "Display de barritas iQ Kids sabor Maní" },
      { name: "Cacao", description: "4 ingredientes. Display x12 barritas de 30 g.", imageUrl: "/mayoristas/cacao.jpg", imageAlt: "Display de barritas iQ Kids sabor Cacao" },
      { name: "Banana", description: "6 ingredientes. Display x12 barritas de 30 g.", imageUrl: "/mayoristas/banana.jpg", imageAlt: "Display de barritas iQ Kids sabor Banana" },
      { name: "Caja Mix", description: "12 barritas con los tres sabores. Ideal para probar.", imageUrl: "/mayoristas/mix.jpg", imageAlt: "Caja Mix iQ Kids con los tres sabores" },
    ],
  },
  profiles: {
    eyebrow: "¿Para quién es esto?",
    title: "Pensado para negocios como el tuyo",
    description:
      "Trabajamos con distintos tipos de comercios y revendedores. Si vendés o querés vender a familias con hijos, iQ Kids encaja.",
    items: [
      { icon: "🌿", title: "Dietéticas", description: "Producto sin TACC, sin azúcar agregada y con ingredientes reconocibles, para el cliente que lee etiquetas." },
      { icon: "🏪", title: "Kioscos y minimercados", description: "Una alternativa al snack ultraprocesado. Diferenciás tu local y capturás al cliente que busca opciones mejores para sus hijos." },
      { icon: "🤱", title: "Tiendas de mamás y bebés", description: "La mayoría de las familias que nos compran tienen chicos de 1 a 3 años. Packaging atractivo que complementa tu oferta." },
      { icon: "💼", title: "Emprendedoras y revendedoras", description: "Un producto que ya tiene demanda gracias a nuestras campañas. Fácil de recomendar y de repetir." },
      { icon: "🎂", title: "Eventos y cotillón saludable", description: "La barrita que aparece en bolsitas de cumpleaños, canastas y regalos. Packaging lindo, producto diferente." },
      { icon: "🏫", title: "Jardines, colegios y clubes", description: "Snack sin azúcar agregada, sin TACC y sin conservantes para buffets, kioscos escolares o kits de colación." },
    ],
  },
  reasons: {
    eyebrow: "Por qué funciona en el punto de venta",
    title: "Un producto que se explica solo",
    description: "El comprador que llega a tu local muchas veces ya vio iQ Kids. Estas son las razones por las que se vende.",
    items: [
      { icon: "📱", title: "Demanda creada en redes", description: "Invertimos en publicidad en Instagram y Facebook todos los meses. Muchos de tus clientes ya vieron iQ Kids antes de entrar a tu local." },
      { icon: "🏷️", title: "El packaging cierra la venta", description: "Entre 4 y 6 ingredientes, todos visibles en el frente del envase. Sin lista larga ni letra chica: el comprador lo entiende en dos segundos." },
      { icon: "🔁", title: "Los comercios reponen", description: "Más de un tercio de los comercios que probaron iQ Kids ya volvió a pedir, y los que reponen lo hacen cada 5 semanas en promedio. Y ya son más de 5.000 las familias que la probaron." },
      { icon: "✅", title: "Sin objeciones de etiqueta", description: "Sin sellos negros, sin azúcar agregada, sin TACC y sin conservantes. El cliente exigente lo acepta sin preguntas." },
      { icon: "📦", title: "Tres sabores, una Caja Mix", description: "Maní, Cacao y Banana. La Caja Mix sirve para que el cliente pruebe los tres y como regalo." },
      { icon: "🍃", title: "Categoría en crecimiento", description: "Cada vez más familias buscan snacks con pocos ingredientes y sin azúcar agregada. Es lo que las familias que nos compran más valoran." },
    ],
  },
  conditions: {
    eyebrow: "Condiciones de compra",
    title: "Todo lo que necesitás saber antes de pedir",
    description: "Dos perfiles de cliente, condiciones claras y precios sin vueltas.",
    plans: [
      {
        icon: "🏪",
        title: "Comercios",
        subtitle: "Dietéticas, kioscos, tiendas de mamás y bebés",
        price: 16000,
        priceUnit: "/ display (x12 barritas)",
        highlighted: false,
        rows: [
          { label: "Pedido mínimo", value: "1 bulto = 10 displays", note: "Puede ser mixto de sabores" },
          { label: "Pago", value: "Transferencia / eCheq a 15 días", note: "Previo al despacho" },
          { label: "Envíos", value: "Todo el país · CABA y GBA reparto propio", note: "" },
          { label: "Vencimiento", value: "5 meses desde elaboración", note: "" },
          { label: "Factura", value: "A o B · Electrónica", note: "" },
        ],
        cta: "Quiero ser comercio →",
      },
      {
        icon: "🚚",
        title: "Distribuidores",
        subtitle: "Mayoristas que abastecen a múltiples comercios",
        price: 13200,
        priceUnit: "/ display (x12 barritas)",
        highlighted: true,
        rows: [
          { label: "Pedido mínimo", value: "10 bultos = 100 displays", note: "Puede ser mixto de sabores" },
          { label: "Pago", value: "Transferencia / eCheq a 15 días", note: "Previo al despacho" },
          { label: "Envíos", value: "Todo el país · Coordinamos según volumen", note: "" },
          { label: "Vencimiento", value: "5 meses desde elaboración", note: "" },
          { label: "Factura", value: "A o B · Electrónica", note: "" },
        ],
        cta: "Quiero ser distribuidor →",
      },
    ],
  },
  steps: {
    eyebrow: "El proceso",
    title: "Empezá en 3 pasos",
    description: "Sin burocracia y con respuesta en menos de 24 horas.",
    items: [
      { title: "Completá el formulario", description: "Contanos qué tipo de negocio tenés y en qué zona. En menos de 24 horas te mandamos la lista de precios y las condiciones." },
      { title: "Hacé tu primer pedido", description: "Desde 1 bulto (10 displays para comercios). Te recomendamos el mix de sabores según lo que más rota en tu tipo de negocio." },
      { title: "Recibís y empezás a vender", description: "Envío a todo el país. Te compartimos material para presentar el producto desde el primer día. Para reponer, nos escribís por WhatsApp y lo coordinamos." },
    ],
  },
  testimonials: {
    eyebrow: "Lo que dicen quienes ya trabajan con nosotros",
    title: "Negocios reales, familias reales",
    description: "Dietéticas y tiendas que ya tienen iQ Kids en su mostrador, y familias que la compran.",
    items: [
      {
        tag: "Emprendedora",
        quote:
          "Tiene alimentos reales que se alinean con la alimentación que le brindo a mis hijos, y también con lo que busco ofrecer en mi emprendimiento.",
        name: "Guadalupe",
        meta: "Emprendedora · Buenos Aires",
      },
    ],
  },
  contact: {
    eyebrow: "Contacto mayorista",
    title: "¿Querés vender iQ Kids o reponer tu stock?",
    description: "Dejanos tus datos y te contactamos en menos de 24 horas. Si ya sos cliente, escribinos por WhatsApp para reponer.",
    leadTitle: "Hablemos de tu negocio",
    leadDescription: "Completá tus datos y te contactamos en menos de 24 horas. Sin compromiso.",
    leadNotificationEmails: ["nicolas@ikifoods.com.ar"],
    businessTypes: [
      "Dietética",
      "Kiosco o minimercado",
      "Tienda de mamás y bebés",
      "Emprendedora / revendedora",
      "Eventos y cotillón",
      "Jardín, colegio o club",
      "Distribuidor o mayorista",
      "Otro",
    ],
    monthlyVolumes: [
      "3 a 5 displays por mes",
      "5 a 20 displays por mes",
      "20 a 50 displays por mes",
      "Más de 50 displays por mes",
      "Todavía no lo sé",
    ],
    orderEnabled: false,
    orderComingSoonText: "Muy pronto vas a poder armar tu pedido desde acá. Mientras tanto, escribinos por WhatsApp y lo cargamos por vos.",
    orderTitle: "Pedido rápido para clientes",
    orderDescription: "Elegí cuántos displays querés de cada sabor. Te confirmamos stock, envío y forma de pago por WhatsApp.",
    minDisplays: 10,
    orderItems: [
      { name: "Display Maní (x12)", price: 16000 },
      { name: "Display Cacao (x12)", price: 16000 },
      { name: "Display Banana (x12)", price: 16000 },
      { name: "Caja Mix (x12)", price: 16000 },
    ],
  },
  faq: {
    eyebrow: "Preguntas frecuentes",
    title: "Lo que nos preguntan los comercios",
    description: "",
    items: [
      {
        question: "¿Cuál es el pedido mínimo?",
        answer:
          "Para comercios: 1 bulto = 10 displays de 12 barritas (120 barritas). Para distribuidores: 10 bultos (100 displays). En ambos casos podés combinar sabores: Maní, Cacao, Banana y Caja Mix.",
      },
      {
        question: "¿Cuánto cuesta cada barrita por mayor?",
        answer:
          "Para comercios: $16.000 el display de 12 barritas ($1.333 por barrita, IVA incluido). Para distribuidores: $13.200 el display ($1.100 por barrita). Los precios están publicados en la sección de condiciones más arriba.",
      },
      { question: "¿Hacen envíos al interior?", answer: "Sí, a todo el país. En CABA y GBA entregamos con reparto propio; al interior enviamos por transporte o Andreani." },
      { question: "¿Cómo se paga?", answer: "Transferencia bancaria o eCheq a 15 días, siempre previo al despacho. Te enviamos el pedido una vez confirmado el pago." },
      { question: "¿Entregan factura?", answer: "Sí. Emitimos factura electrónica A o B en cada pedido." },
      { question: "¿Cuánto dura el producto?", answer: "5 meses desde la fecha de elaboración. Se conserva en lugar fresco y seco, sin heladera." },
      { question: "¿Tiene alérgenos?", answer: "Es sin TACC. Contiene maní y frutos secos (almendras y castañas de cajú, según el sabor). El detalle está en cada envase." },
      { question: "¿Me ayudan a venderlo?", answer: "Sí. Te compartimos fotos y material para tus redes, y te recomendamos qué sabores pedir según lo que más rota en tu tipo de negocio." },
    ],
  },
};

export const ARGENTINA_PROVINCES = [
  "Buenos Aires (CABA)",
  "Buenos Aires (GBA)",
  "Buenos Aires (Interior)",
  "Córdoba",
  "Santa Fe",
  "Mendoza",
  "Tucumán",
  "Salta",
  "Entre Ríos",
  "Misiones",
  "Corrientes",
  "Chaco",
  "Santiago del Estero",
  "San Juan",
  "Jujuy",
  "Río Negro",
  "Neuquén",
  "Formosa",
  "Chubut",
  "San Luis",
  "Catamarca",
  "La Rioja",
  "La Pampa",
  "Santa Cruz",
  "Tierra del Fuego",
];
