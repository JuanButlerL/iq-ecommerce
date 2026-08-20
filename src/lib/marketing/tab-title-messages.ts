type TabTitleContext = {
  pathname: string;
  cartItemCount: number;
};

type TabTitleRule = {
  id: string;
  matches: (context: TabTitleContext) => boolean;
  messages: (context: TabTitleContext) => string[];
  mobileResumeMessage: (context: TabTitleContext) => string;
};

function formatCartCount(cartItemCount: number) {
  if (cartItemCount === 1) {
    return "Tenés 1 producto listo";
  }

  return `Tenés ${cartItemCount} productos listos`;
}

const tabTitleRules: TabTitleRule[] = [
  {
    id: "checkout-transfer",
    matches: ({ pathname }) => pathname.startsWith("/checkout/transfer/"),
    messages: () => ["Subí tu comprobante 💸", "Tu pedido sigue reservado", "Estamos a un paso"],
    mobileResumeMessage: () => "Seguimos con tu comprobante.",
  },
  {
    id: "checkout-mercado-pago",
    matches: ({ pathname }) => pathname.startsWith("/checkout/mercado-pago/"),
    messages: () => ["Completá el pago 💳", "Tu pedido sigue activo", "Volvé a finalizarlo"],
    mobileResumeMessage: () => "Seguimos con tu pago.",
  },
  {
    id: "checkout-confirmacion",
    matches: ({ pathname }) => pathname.startsWith("/checkout/confirmacion/"),
    messages: () => ["¡Gracias por comprar! 💛", "Tu pedido ya quedó registrado", "IQ Kids sigue con vos"],
    mobileResumeMessage: () => "Tu pedido ya quedó confirmado.",
  },
  {
    id: "checkout",
    matches: ({ pathname }) => pathname === "/checkout",
    messages: () => ["Estás a 1 paso ✅", "Tu pedido está casi listo", "Completá tu compra"],
    mobileResumeMessage: () => "Seguimos con tu compra.",
  },
  {
    id: "cart",
    matches: ({ pathname }) => pathname === "/carrito",
    messages: ({ cartItemCount }) =>
      cartItemCount > 0
        ? ["Tu carrito te espera 🛒", formatCartCount(cartItemCount), "Cerrá tu compra"]
        : ["Tu carrito te espera 🛒", "Elegí tus sabores favoritos", "Volvé cuando quieras"],
    mobileResumeMessage: ({ cartItemCount }) =>
      cartItemCount > 0 ? "Tu carrito sigue listo para cerrar." : "Podés volver a elegir tus sabores.",
  },
  {
    id: "product-detail",
    matches: ({ pathname }) => pathname.startsWith("/productos/"),
    messages: ({ cartItemCount }) =>
      cartItemCount > 0
        ? ["Volvé 👀", formatCartCount(cartItemCount), "Sumá este sabor también"]
        : ["Volvé 👀", "Este sabor te está esperando", "Elegí tu próxima caja"],
    mobileResumeMessage: ({ cartItemCount }) =>
      cartItemCount > 0 ? "Este sabor puede sumarse a tu compra." : "Este sabor te estaba esperando.",
  },
  {
    id: "products",
    matches: ({ pathname }) => pathname === "/productos",
    messages: ({ cartItemCount }) =>
      cartItemCount > 0
        ? ["Seguimos por acá 👀", formatCartCount(cartItemCount), "Tu compra está encaminada"]
        : ["Seguimos por acá 👀", "Elegí tu sabor ideal", "Tus barritas te esperan"],
    mobileResumeMessage: ({ cartItemCount }) =>
      cartItemCount > 0 ? "Seguimos con tu selección." : "Seguimos viendo sabores.",
  },
  {
    id: "contact",
    matches: ({ pathname }) => pathname === "/contacto",
    messages: () => ["Seguimos por acá 👀", "Tu consulta nos espera", "Volvé cuando quieras"],
    mobileResumeMessage: () => "Tu consulta sigue abierta.",
  },
  {
    id: "home",
    matches: ({ pathname }) => pathname === "/",
    messages: ({ cartItemCount }) =>
      cartItemCount > 0
        ? ["Volvé 👀", formatCartCount(cartItemCount), "Tus barritas te esperan"]
        : ["Volvé 👀", "Tus barritas te esperan", "IQ Kids sigue acá"],
    mobileResumeMessage: ({ cartItemCount }) =>
      cartItemCount > 0 ? "Tus barritas siguen esperándote." : "Seguimos donde lo dejaste.",
  },
];

export function getTabTitleMessages(context: TabTitleContext) {
  const matchedRule = tabTitleRules.find((rule) => rule.matches(context));
  const messages = matchedRule?.messages(context) ?? ["Volvé 👀", "IQ Kids te espera", "Seguimos donde lo dejaste"];

  return [...new Set(messages.filter(Boolean))];
}

export function getMobileResumeMessage(context: TabTitleContext) {
  const matchedRule = tabTitleRules.find((rule) => rule.matches(context));

  return matchedRule?.mobileResumeMessage(context) ?? "Seguimos donde lo dejaste.";
}
