import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WHOLESALE_CUSTOMER_FILTERS, getWholesaleCustomers, type WholesaleCustomerFilter } from "@/features/wholesale/customers";
import { TAX_CONDITION_LABELS } from "@/features/wholesale/tax-condition";
import { requireAdminSection } from "@/lib/auth/admin";
import { cn } from "@/lib/utils/cn";
import { formatCuit } from "@/lib/utils/cuit";

export default async function AdminWholesaleCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string }> }) {
  await requireAdminSection("wholesale");
  const { q, filtro } = await searchParams;
  const filter = (filtro && filtro in WHOLESALE_CUSTOMER_FILTERS ? filtro : "todos") as WholesaleCustomerFilter;
  const customers = await getWholesaleCustomers({ search: q, filter });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Mayorista</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Clientes</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/70 md:text-base">
            Maestro de clientes mayoristas, uno por CUIT. Acá se habilita el pago posterior a la entrega y el descuento especial de cada CUIT.
          </p>
        </div>
        <Link
          href="/admin/mayoristas/clientes/nuevo"
          className="inline-flex items-center gap-2 rounded-full bg-brand-pink px-5 py-2.5 text-sm font-extrabold text-white shadow-soft hover:bg-[#ea737d]"
        >
          <Plus className="h-4 w-4" /> Nuevo cliente
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-3" action="/admin/mayoristas/clientes">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink/40" />
          <Input name="q" defaultValue={q ?? ""} placeholder="Buscar por email, CUIT, negocio, contacto o ciudad" className="pl-10" />
        </div>
        {filter !== "todos" ? <input type="hidden" name="filtro" value={filter} /> : null}
      </form>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(WHOLESALE_CUSTOMER_FILTERS) as WholesaleCustomerFilter[]).map((key) => {
          const params = new URLSearchParams({ ...(q ? { q } : {}), ...(key !== "todos" ? { filtro: key } : {}) }).toString();
          return (
            <Link
              key={key}
              href={`/admin/mayoristas/clientes${params ? `?${params}` : ""}`}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-extrabold transition",
                filter === key ? "bg-brand-ink text-white" : "bg-white text-brand-ink ring-1 ring-brand-ink/10 hover:ring-brand-pink/40",
              )}
            >
              {WHOLESALE_CUSTOMER_FILTERS[key]}
            </Link>
          );
        })}
      </div>

      {customers.length === 0 ? (
        <Card className="p-8 text-center text-sm text-brand-ink/60">
          {q || filter !== "todos" ? "No hay clientes que coincidan con la búsqueda." : "Todavía no hay clientes mayoristas. Los podés crear a mano o desde una consulta."}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-brand-ink/10 text-xs uppercase tracking-[0.08em] text-brand-ink/50">
              <tr>
                <th className="px-5 py-3 font-extrabold">Cliente</th>
                <th className="px-5 py-3 font-extrabold">CUIT</th>
                <th className="px-5 py-3 font-extrabold">Contacto</th>
                <th className="px-5 py-3 font-extrabold">Entrega</th>
                <th className="px-5 py-3 font-extrabold">Condiciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/5">
              {customers.map((customer) => {
                const discount = Number(customer.extraDiscountPercentage);
                return (
                  <tr key={customer.id} className={cn("align-top hover:bg-[#fff6f7]/60", !customer.active && "opacity-55")}>
                    <td className="px-5 py-3">
                      <Link href={`/admin/mayoristas/clientes/${customer.id}`} className="font-extrabold text-brand-ink hover:text-brand-pink">
                        {customer.businessName || customer.legalName || customer.contactName}
                      </Link>
                      <p className="text-xs text-brand-ink/55">{[customer.legalName, customer.businessType].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {formatCuit(customer.cuit)}
                      <p className="text-xs text-brand-ink/55">{customer.taxCondition ? TAX_CONDITION_LABELS[customer.taxCondition] : "IVA sin informar"}</p>
                    </td>
                    <td className="px-5 py-3">
                      {customer.contactName}
                      <p className="text-xs text-brand-ink/55">{customer.email}</p>
                      <p className="text-xs text-brand-ink/55">{customer.phone}</p>
                    </td>
                    <td className="px-5 py-3">
                      {customer.city}
                      <p className="text-xs text-brand-ink/55">{customer.province}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {!customer.active ? <span className="rounded-full bg-brand-ink/10 px-2.5 py-0.5 text-[11px] font-extrabold text-brand-ink/60">Inactivo</span> : null}
                        {customer.allowDeferredPayment ? (
                          <span className="rounded-full bg-brand-mint px-2.5 py-0.5 text-[11px] font-extrabold text-brand-ink">Pago diferido</span>
                        ) : (
                          <span className="rounded-full bg-[#fff6f7] px-2.5 py-0.5 text-[11px] font-bold text-brand-ink/60">Pago anticipado</span>
                        )}
                        {discount > 0 ? <span className="rounded-full bg-brand-cyan/40 px-2.5 py-0.5 text-[11px] font-extrabold text-brand-ink">-{discount}% extra</span> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {customers.length === 500 ? <p className="text-xs text-brand-ink/50">Se muestran los 500 más recientes. Usá el buscador para encontrar el resto.</p> : null}
    </div>
  );
}
