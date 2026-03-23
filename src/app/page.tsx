import { Container } from "@/components/layout/container";
import { HomeInstitutionalStrip } from "@/features/catalog/components/home-institutional-strip";
import { HomeProductCard } from "@/features/catalog/components/home-product-card";
import { getFeaturedProducts } from "@/features/catalog/queries";

export default async function HomePage() {
  const products = await getFeaturedProducts();

  return (
    <div className="bg-white">
      <Container className="py-5 text-center md:py-6">
        <p className="text-[22px] font-medium text-brand-ink/70 md:text-[26px]">Alimentos con Sentido Comun</p>
        <h1 className="mt-3 text-4xl font-extrabold text-brand-ink md:text-5xl">
          Con Ingredientes Naturales y NADA MAS!
        </h1>
        <h2 className="mt-12 text-3xl font-extrabold text-brand-ink md:mt-14 md:text-4xl">Nuestras Barritas</h2>
      </Container>

      <Container className="pb-10 pt-4 md:pb-16">
        <div className="grid gap-y-12 md:grid-cols-3 md:gap-x-10">
          {products.map((product) => (
            <HomeProductCard key={product.id} product={product} />
          ))}
        </div>
      </Container>
      <HomeInstitutionalStrip />
    </div>
  );
}
