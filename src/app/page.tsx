import { Container } from "@/components/layout/container";
import { HomeInstitutionalStrip } from "@/features/catalog/components/home-institutional-strip";
import { HomeProductCard } from "@/features/catalog/components/home-product-card";
import { getFeaturedProducts } from "@/features/catalog/queries";

export default async function HomePage() {
  const products = await getFeaturedProducts();

  return (
    <div className="bg-white">
      <Container className="py-5 text-center md:py-6">
        <p className="text-[22px] font-medium text-brand-ink/70 md:text-[26px]">Alimentos con Sentido Común</p>
        <h1 className="mt-3 text-4xl font-extrabold text-brand-ink md:text-5xl">
          Con Ingredientes Naturales y NADA MÁS!
        </h1>
        <h2 className="mt-12 text-3xl font-extrabold text-brand-ink md:mt-14 md:text-4xl">Nuestras Barritas</h2>
      </Container>

      <Container className="pb-10 pt-4 md:pb-16">
        <div className="mx-auto grid max-w-[1160px] justify-center gap-x-8 gap-y-14 [grid-template-columns:repeat(auto-fit,minmax(240px,260px))] xl:gap-x-10">
          {products.map((product) => (
            <div key={product.id} className="w-full">
              <HomeProductCard product={product} />
            </div>
          ))}
        </div>
      </Container>
      <HomeInstitutionalStrip />
    </div>
  );
}
