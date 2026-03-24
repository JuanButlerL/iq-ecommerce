import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/section-heading";
import { HomeInstitutionalStrip } from "@/features/catalog/components/home-institutional-strip";
import { ProductCard } from "@/features/catalog/components/product-card";
import { getVisibleProducts } from "@/features/catalog/queries";

export default async function ProductsPage() {
  const products = await getVisibleProducts();

  return (
    <Container className="space-y-12 py-12 md:space-y-16 md:py-16">
      <section>
        <SectionHeading
          title="Productos"
          description="Una grilla limpia y directa, alineada al universo visual de IQ Kids."
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <HomeInstitutionalStrip />
    </Container>
  );
}
