type TabTitleContext = {
  pathname: string;
  cartItemCount: number;
};

type TabTitleRule = {
  id: string;
  matches: (context: TabTitleContext) => boolean;
  messages: (context: TabTitleContext) => string[];
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
  },
  {
    id: "checkout-mercado-pago",
    matches: ({ pathname }) => pathname.startsWith("/checkout/mercado-pago/"),
    messages: () => ["Completá el pago 💳", "Tu pedido sigue activo", "Volvé a finalizarlo"],
  },
  {
    id: "checkout-confirmacion",
    matches: ({ pathname }) => pathname.startsWith("/checkout/confirmacion/"),
    messages: () => ["¡Gracias por comprar! 💛", "Tu pedido ya quedó registrado", "IQ Kids sigue con vos"],
  },
  {
    id: "checkout",
    matches: ({ pathname }) => pathname === "/checkout",
    messages: () => ["Estás a 1 paso ✅", "Tu pedido está casi listo", "Completá tu compra"],
  },
  {
    id: "cart",
    matches: ({ pathname }) => pathname === "/carrito",
    messages: ({ cartItemCount }) =>
      cartItemCount > 0
        ? ["Tu carrito te espera 🛒", formatCartCount(cartItemCount), "Cerrá tu compra"]
        : ["Tu carrito te espera 🛒", "Elegí tus sabores favoritos", "Volvé cuando quieras"],
  },
  {
    id: "product-detail",
    matches: ({ pathname }) => pathname.startsWith("/productos/"),
    messages: ({ cartItemCount }) =>
      cartItemCount > 0
        ? ["Volvé 👀", formatCartCount(cartItemCount), "Sumá este sabor también"]
        : ["Volvé 👀", "Este sabor te está esperando", "Elegí tu próxima caja"],
  },
  {
    id: "products",
    matches: ({ pathname }) => pathname === "/productos",
    messages: ({ cartItemCount }) =>
      cartItemCount > 0
        ? ["Seguimos por acá 👀", formatCartCount(cartItemCount), "Tu compra está encaminada"]
        : ["Seguimos por acá 👀", "Elegí tu sabor ideal", "Tus barritas te esperan"],
  },
  {
    id: "contact",
    matches: ({ pathname }) => pathname === "/contacto",
    messages: () => ["Seguimos por acá 👀", "Tu consulta nos espera", "Volvé cuando quieras"],
  },
  {
    id: "home",
    matches: ({ pathname }) => pathname === "/",
    messages: ({ cartItemCount }) =>
      cartItemCount > 0
        ? ["Volvé 👀", formatCartCount(cartItemCount), "Tus barritas te esperan"]
        : ["Volvé 👀", "Tus barritas te esperan", "IQ Kids sigue acá"],
  },
];

export function getTabTitleMessages(context: TabTitleContext) {
  const matchedRule = tabTitleRules.find((rule) => rule.matches(context));
  const messages = matchedRule?.messages(context) ?? ["Volvé 👀", "IQ Kids te espera", "Seguimos donde lo dejaste"];

  return [...new Set(messages.filter(Boolean))];
  }
