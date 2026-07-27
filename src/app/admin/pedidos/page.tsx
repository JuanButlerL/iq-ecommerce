import Link from "next/link";
import { OrderStatus, PaymentMethod, PaymentStatus, SyncStatus } from "@prisma/client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getOrdersPage, type OrderFilters } from "@/features/orders/queries";
import { requireAdminSection } from "@/lib/auth/admin";
import { formatArgentinaDateTime, parseArgentinaDateParam } from "@/lib/utils/datetime";

type SearchParams = {
  search?: string;
  operationalStatus?: OrderFilters["operationalStatus"];
  orderStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  syncStatus?: string;
  proofStatus?: OrderFilters["proofStatus"];
  dateFrom?: string;
  dateTo?: string;
  page?: string;
};

function getEnumValue<T extends Record<string, string>>(enumObject: T, value?: string | null) {
  if (!value || value === "ALL") {
    return "ALL";
  }

  return Object.values(enumObject).includes(value) ? value : "ALL";
}

function getProofStatus(value?: string | null): OrderFilters["proofStatus"] {
  return value === "WITH_PROOF" || value === "WITHOUT_PROOF" ? value : "ALL";
}

function getOperationalStatus(value?: string | null): OrderFilters["operationalStatus"] {
  const valid: Array<NonNullable<OrderFilters["operationalStatus"]>> = [
    "ALL",
    "TO_COLLECT",
    "PROOF_REVIEW",
    "TO_PREPARE",
    "SYNC_ISSUES",
    "CANCELLED",
  ];

  return valid.includes(value as NonNullable<OrderFilters["operationalStatus"]>)
    ? (value as OrderFilters["operationalStatus"])
    : "ALL";
}

function buildQuery(params: SearchParams, overrides: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams();
  const merged = { ...params, ...overrides };

  for (const [key, value] of Object.entries(merged)) {
    if (value == null || value === "" || value === "ALL") {
      continue;
    }

    query.set(key, String(value));
  }

  return query.toString();
}

const operationalFilters: Array<{ value: NonNullable<OrderFilters["operationalStatus"]>; label: string; hint: string }> = [
  { value: "ALL", label: "Todos", hint: "Ultimos movimientos" },
  { value: "TO_COLLECT", label: "A cobrar", hint: "Transferencias sin comprobante" },
  { value: "PROOF_REVIEW", label: "Comprobante", hint: "Pendientes de validar" },
  { value: "TO_PREPARE", label: "Para preparar", hint: "Pagos confirmados" },
  { value: "SYNC_ISSUES", label: "Sync", hint: "Pendiente o error" },
  { value: "CANCELLED", label: "Cancelados", hint: "Cancelados o expirados" },
];

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdminSection("orders");
  const resolvedSearchParams = (await searchParams) ?? {};
  const page = Math.max(Number(resolvedSearchParams.page ?? 1) || 1, 1);
  const filters: OrderFilters = {
    search: resolvedSearchParams.search?.trim() || undefined,
    operationalStatus: getOperationalStatus(resolvedSearchParams.operationalStatus),
    orderStatus: getEnumValue(OrderStatus, resolvedSearchParams.orderStatus) as OrderFilters["orderStatus"],
    paymentStatus: getEnumValue(PaymentStatus, resolvedSearchParams.paymentStatus) as OrderFilters["paymentStatus"],
    paymentMethod: getEnumValue(PaymentMethod, resolvedSearchParams.paymentMethod) as OrderFilters["paymentMethod"],
    syncStatus: getEnumValue(SyncStatus, resolvedSearchParams.syncStatus) as OrderFilters["syncStatus"],
    proofStatus: getProofStatus(resolvedSearchParams.proofStatus),
    dateFrom: parseArgentinaDateParam(resolvedSearchParams.dateFrom ?? null),
    dateTo: parseArgentinaDateParam(resolvedSearchParams.dateTo ?? null, true),
    page,
    pageSize: 20,
  };
  const { orders, total, pageSize, totalPages } = await getOrdersPage(filters);
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);
  const exportHref = `/api/admin/export/orders?${buildQuery(resolvedSearchParams, { page: undefined })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Pedidos</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Listado</h1>
        </div>
        <Link href={exportHref}>
          <Button variant="secondary" className="w-full sm:w-auto">Exportar Excel</Button>
        </Link>
      </div>
      <Card className="p-4 md:p-6">
        <form className="space-y-5">
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
            <label>
              <span className="mb-2 block text-sm font-bold text-brand-ink/75">Buscar</span>
              <input
                type="search"
                name="search"
                defaultValue={resolvedSearchParams.search ?? ""}
                placeholder="Pedido, cliente, email, telefono o DNI"
                className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-brand-ink/75">Operacion</span>
              <select
                name="operationalStatus"
                defaultValue={filters.operationalStatus ?? "ALL"}
                className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm font-bold text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
              >
                {operationalFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-brand-ink/75">Comprobante</span>
              <select
                name="proofStatus"
                defaultValue={filters.proofStatus ?? "ALL"}
                className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm font-bold text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
              >
                <option value="ALL">Todos</option>
                <option value="WITH_PROOF">Con comprobante</option>
                <option value="WITHOUT_PROOF">Sin comprobante</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {operationalFilters.map((filter) => {
              const href = `/admin/pedidos?${buildQuery(resolvedSearchParams, {
                operationalStatus: filter.value,
                page: 1,
              })}`;
              const isActive = (filters.operationalStatus ?? "ALL") === filter.value;

              return (
                <Link
                  key={filter.value}
                  href={href}
                  className={`min-w-[150px] rounded-2xl border px-4 py-3 transition ${
                    isActive
                      ? "border-brand-pink bg-brand-pink text-white"
                      : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-pink/40"
                  }`}
                >
                  <span className="block text-sm font-extrabold">{filter.label}</span>
                  <span className={`mt-1 block text-xs ${isActive ? "text-white/80" : "text-brand-ink/50"}`}>
                    {filter.hint}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="grid gap-4 md:grid-cols-4">
          <label>
            <span className="mb-2 block text-sm font-bold text-brand-ink/75">Fecha desde</span>
            <input
              type="date"
              name="dateFrom"
              defaultValue={resolvedSearchParams.dateFrom ?? ""}
              className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-bold text-brand-ink/75">Fecha hasta</span>
            <input
              type="date"
              name="dateTo"
              defaultValue={resolvedSearchParams.dateTo ?? ""}
              className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-bold text-brand-ink/75">Pago</span>
            <select
              name="paymentStatus"
              defaultValue={filters.paymentStatus ?? "ALL"}
              className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
            >
              <option value="ALL">Todos</option>
              {Object.values(PaymentStatus).map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-bold text-brand-ink/75">Medio</span>
            <select
              name="paymentMethod"
              defaultValue={filters.paymentMethod ?? "ALL"}
              className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
            >
              <option value="ALL">Todos</option>
              <option value={PaymentMethod.BANK_TRANSFER}>Transferencia</option>
              <option value={PaymentMethod.MERCADO_PAGO}>Mercado Pago</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-bold text-brand-ink/75">Sync</span>
            <select
              name="syncStatus"
              defaultValue={filters.syncStatus ?? "ALL"}
              className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
            >
              <option value="ALL">Todos</option>
              {Object.values(SyncStatus).map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" className="w-full sm:w-auto">
              Filtrar
            </Button>
            <Link href="/admin/pedidos" className="w-full sm:w-auto">
              <Button type="button" variant="ghost" className="w-full sm:w-auto">
                Limpiar
              </Button>
            </Link>
          </div>
        </form>
      </Card>
      <Card className="p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-brand-ink/65">
            Mostrando {firstShown}-{lastShown} de {total} pedidos
          </p>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/45">
            Carga inicial optimizada: ultimos 20
          </p>
        </div>
        <div className="space-y-3 md:hidden">
          {orders.map((order) => (
            <Link key={order.id} href={`/admin/pedidos/${order.id}`} className="block rounded-[1.5rem] border border-brand-ink/10 bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-brand-ink">{order.publicOrderNumber}</p>
                  <p className="text-xs font-semibold text-brand-ink/45">{formatArgentinaDateTime(order.createdAt)}</p>
                  <p className="truncate text-sm text-brand-ink/65">
                    {order.customerFirstName} {order.customerLastName}
                  </p>
                </div>
                <p className="text-sm font-bold text-brand-pink">${order.totalArs.toLocaleString("es-AR")}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-ink/50">
                <span>{order.orderStatus}</span>
                <span>{order.paymentStatus}</span>
                <span>{order.paymentMethod}</span>
                <span>{order.paymentProviderStatus ?? "Sin pago"}</span>
                <span>Sync: {order.syncStatus}</span>
                <span>{order.paymentProofs[0] ? "Con comprobante" : "Sin comprobante"}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-brand-ink/50">
                <th className="pb-3">Pedido</th>
                <th className="pb-3">Fecha</th>
                <th className="pb-3">Cliente</th>
                <th className="pb-3">Estado</th>
                <th className="pb-3">Pago</th>
                <th className="pb-3">Medio</th>
                <th className="pb-3">Detalle</th>
                <th className="pb-3">Comprobante</th>
                <th className="pb-3">Sync</th>
                <th className="pb-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/10">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="py-3">
                    <Link href={`/admin/pedidos/${order.id}`} className="font-bold text-brand-ink">
                      {order.publicOrderNumber}
                    </Link>
                  </td>
                  <td className="py-3 text-brand-ink/70">{formatArgentinaDateTime(order.createdAt)}</td>
                  <td className="py-3 text-brand-ink/70">
                    {order.customerFirstName} {order.customerLastName}
                  </td>
                  <td className="py-3 text-brand-ink/70">{order.orderStatus}</td>
                  <td className="py-3 text-brand-ink/70">{order.paymentStatus}</td>
                  <td className="py-3 text-brand-ink/70">{order.paymentMethod}</td>
                  <td className="py-3 text-brand-ink/70">{order.paymentProviderStatus ?? "-"}</td>
                  <td className="py-3 text-brand-ink/70">{order.paymentProofs[0] ? "Cargado" : "Pendiente"}</td>
                  <td className="py-3 text-brand-ink/70">{order.syncStatus}</td>
                  <td className="py-3 text-brand-ink/70">${order.totalArs.toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.length === 0 ? (
          <div className="rounded-[1.5rem] bg-background p-8 text-center">
            <p className="font-bold text-brand-ink">No hay pedidos para esos filtros.</p>
            <p className="mt-1 text-sm text-brand-ink/60">Ajusta busqueda, fechas o estado operativo.</p>
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 border-t border-brand-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/admin/pedidos?${buildQuery(resolvedSearchParams, { page: Math.max(page - 1, 1) })}`}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-40" : ""}
          >
            <Button type="button" variant="secondary" className="w-full sm:w-auto">
              Anteriores
            </Button>
          </Link>
          <p className="text-center text-sm font-bold text-brand-ink/60">
            Pagina {page} de {totalPages}
          </p>
          <Link
            href={`/admin/pedidos?${buildQuery(resolvedSearchParams, { page: Math.min(page + 1, totalPages) })}`}
            aria-disabled={page >= totalPages}
            className={page >= totalPages ? "pointer-events-none opacity-40" : ""}
          >
            <Button type="button" variant="secondary" className="w-full sm:w-auto">
              Siguientes
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
