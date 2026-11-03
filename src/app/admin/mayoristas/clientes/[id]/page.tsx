import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { WholesaleCustomerForm } from "@/features/admin/components/wholesale-customer-form";
import { PAYMENT_METHOD_LABELS } from "@/features/orders/labels";
import { getWholesaleCustomer, getWholesaleCustomersByEmail } from "@/features/wholesale/customers";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { requireAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { formatArs } from "@/lib/utils/currency";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

export default async function AdminWholesaleCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSection("wholesale");
  const { id } = await params;
  const customer = await getWholesaleCustomer(id);

  if (!customer) {
    notFound();
  }

  const [content, otherCustomers, orders] = await Promise.all([
    getWholesaleContent(),
    getWholesaleCustomersByEmail(customer.email, customer.id),
    prisma.order.findMany({
      where: { wholesaleCustomerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, publicOrderNumber: true, createdAt: true, totalArs: true, paymentMethod: true, paymentStatus: true, orderStatus: true },
    }),
  ]);
  const title = customer.businessName || customer.legalName || customer.contactName;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Mayorista · Clientes</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">{title}</h1>
        <p className="mt-2 text-sm text-brand-ink/60">
          Alta: {formatArgentinaDateTime(customer.createdAt)}
          {customer.lead ? " · Creado desde una consulta de /mayoristas" : ""} · Última modificación: {formatArgentinaDateTime(customer.updatedAt)}
        </p>
      </div>
      <WholesaleCustomerForm
        key={customer.id}
        customerId={customer.id}
        businessTypes={content.contact.businessTypes}
        otherCuits={otherCustomers.map((other) => ({
          id: other.id,
          cuit: other.cuit,
          label: other.businessName || other.legalName || other.contactName,
        }))}
        initialValues={{
          email: customer.email,
          phone: customer.phone,
          contactName: customer.contactName,
          businessName: customer.businessName ?? "",
          legalName: customer.legalName ?? "",
          businessType: customer.businessType ?? "",
          cuit: customer.cuit,
          taxCondition: customer.taxCondition ?? "",
          street: customer.street,
          floor: customer.floor ?? "",
          city: customer.city,
          province: customer.province,
          postalCode: customer.postalCode,
          reference: customer.reference ?? "",
          allowDeferredPayment: customer.allowDeferredPayment,
          extraDiscountPercentage: String(Number(customer.extraDiscountPercentage)),
          active: customer.active,
          adminNotes: customer.adminNotes ?? "",
        }}
      />
      <Card className="p-6">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Últimos pedidos</p>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-brand-ink/60">Todavía no hizo pedidos desde la tienda mayorista.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-brand-ink/50">
                  <th className="pb-2">Pedido</th>
                  <th className="pb-2">Fecha</th>
                  <th className="pb-2">Medio</th>
                  <th className="pb-2">Estado</th>
                  <th className="pb-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-ink/10">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-2.5">
                      <Link href={`/admin/pedidos/${order.id}`} className="font-bold text-brand-ink hover:text-brand-pink">
                        {order.publicOrderNumber}
                      </Link>
                    </td>
                    <td className="py-2.5 text-brand-ink/70">{formatArgentinaDateTime(order.createdAt)}</td>
                    <td className="py-2.5 text-brand-ink/70">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</td>
                    <td className="py-2.5 text-brand-ink/70">
                      {order.orderStatus} · {order.paymentStatus}
                    </td>
                    <td className="py-2.5 text-brand-ink/70">{formatArs(order.totalArs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
