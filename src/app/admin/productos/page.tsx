import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAdminProducts } from "@/features/products/queries";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminProductsPage() {
  await requireAdmin();
  const products = await getAdminProducts();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Catalogo</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Productos</h1>
        </div>
        <Link href="/admin/productos/nuevo">
          <Button className="w-full sm:w-auto">Nuevo producto</Button>
        </Link>
      </div>
      <Card className="p-6">
        <div className="space-y-3 md:hidden">
          {products.map((product) => (
            <div key={product.id} className="rounded-[1.5rem] border border-brand-ink/10 bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/productos/${product.id}`} className="block truncate font-bold text-brand-ink">
                    {product.name}
                  </Link>
                  <p className="mt-1 text-sm text-brand-ink/65">${product.priceArs.toLocaleString("es-AR")}</p>
                </div>
                <Link href={`/admin/productos/${product.id}`}>
                  <Button variant="secondary" size="sm" className="whitespace-nowrap">
                    Editar
                  </Button>
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-ink/50">
                <span>Estado: {product.active ? "Activo" : "Inactivo"}</span>
                <span>Visible: {product.visible ? "Si" : "No"}</span>
                <span>Orden: {product.sortOrder}</span>
                <span>Destacado: {product.featured ? "Sí" : "No"}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-brand-ink/50">
                <th className="pb-3">Nombre</th>
                <th className="pb-3">Precio</th>
                <th className="pb-3">Estado</th>
                <th className="pb-3">Visible</th>
                <th className="pb-3">Orden</th>
                <th className="pb-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/10">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="py-3">
                    <Link href={`/admin/productos/${product.id}`} className="font-bold text-brand-ink underline-offset-2 hover:underline">
                      {product.name}
                    </Link>
                  </td>
                  <td className="py-3 text-brand-ink/70">${product.priceArs.toLocaleString("es-AR")}</td>
                  <td className="py-3 text-brand-ink/70">{product.active ? "Activo" : "Inactivo"}</td>
                  <td className="py-3 text-brand-ink/70">{product.visible ? "Si" : "No"}</td>
                  <td className="py-3 text-brand-ink/70">{product.sortOrder}</td>
                  <td className="py-3 text-right">
                    <Link href={`/admin/productos/${product.id}`}>
                      <Button variant="secondary" size="sm" className="whitespace-nowrap">
                        Editar
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
