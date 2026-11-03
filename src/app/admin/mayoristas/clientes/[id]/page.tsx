import { notFound } from "next/navigation";

import { WholesaleCustomerForm } from "@/features/admin/components/wholesale-customer-form";
import { getWholesaleCustomer, getWholesaleCustomersByEmail } from "@/features/wholesale/customers";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { requireAdminSection } from "@/lib/auth/admin";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

export default async function AdminWholesaleCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSection("wholesale");
  const { id } = await params;
  const customer = await getWholesaleCustomer(id);

  if (!customer) {
    notFound();
  }

  const [content, otherCustomers] = await Promise.all([getWholesaleContent(), getWholesaleCustomersByEmail(customer.email, customer.id)]);
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
    </div>
  );
}
