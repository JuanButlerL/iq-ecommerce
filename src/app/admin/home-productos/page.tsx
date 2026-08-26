import { HomeFeaturedProductsAdminPanel } from "@/features/admin/components/home-featured-products-admin-panel";
import { getAdminProducts } from "@/features/products/queries";
import { getAdminHomeFeaturedProductSlots } from "@/features/home-featured-products/queries";
import { requireAdminSection } from "@/lib/auth/admin";

type AdminProducts = Awaited<ReturnType<typeof getAdminProducts>>;
type AdminHomeSlots = Awaited<ReturnType<typeof getAdminHomeFeaturedProductSlots>>;

function buildFallbackSlots(
  products: AdminProducts,
  slots: AdminHomeSlots,
) {
  if (slots.length === 4) {
    return slots.map((slot: AdminHomeSlots[number]) => ({
      slotOrder: slot.slotOrder,
      productId: slot.productId,
      eyebrow: slot.eyebrow,
      title: slot.title,
      description: slot.description,
      quote: slot.quote,
      buttonLabel: slot.buttonLabel,
    }));
  }

  const orderedProducts = products.slice(0, 4);
  const fallbackContent = [
    {
      eyebrow: "Banana · Mani · Cacao",
      title: "Descubri el favorito de tu hijo",
      description: "Empeza por una seleccion pensada para probar sabores y resolver la semana.",
      quote: "Una genialidad, me di cuenta que su preferido es el de cacao.",
      buttonLabel: "Ver producto ->",
    },
    {
      eyebrow: orderedProducts[1]?.name ?? "",
      title: "La vianda resuelta para toda la semana",
      description: orderedProducts[1]?.shortDescription ?? "",
      quote: "La vianda volvio vacia. Eso no pasaba en meses.",
      buttonLabel: "Ver producto ->",
    },
    {
      eyebrow: orderedProducts[2]?.name ?? "",
      title: "Chocolate sin leer etiquetas",
      description: orderedProducts[2]?.shortDescription ?? "",
      quote: "Siempre batalle con los snacks. Esta la pide el solo.",
      buttonLabel: "Ver producto ->",
    },
    {
      eyebrow: orderedProducts[3]?.name ?? "",
      title: "Ingredientes que reconoces, sabor que acepta",
      description: orderedProducts[3]?.shortDescription ?? "",
      quote: "La lleva al colegio, a la plaza, al club. Va a todos lados.",
      buttonLabel: "Ver producto ->",
    },
  ];

  return fallbackContent.map((content, index) => ({
    slotOrder: index + 1,
    productId: orderedProducts[index]?.id ?? products[0]?.id ?? "",
    eyebrow: content.eyebrow,
    title: content.title,
    description: content.description,
    quote: content.quote,
    buttonLabel: content.buttonLabel,
  }));
}

export default async function AdminHomeProductsPage() {
  await requireAdminSection("home-products");

  const [products, slots] = await Promise.all([
    getAdminProducts(),
    getAdminHomeFeaturedProductSlots(),
  ]);

  return (
    <HomeFeaturedProductsAdminPanel
      products={products.map((product: AdminProducts[number]) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
      }))}
      slots={buildFallbackSlots(products, slots)}
    />
  );
}
