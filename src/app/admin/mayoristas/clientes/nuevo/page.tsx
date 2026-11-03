import Link from "next/link";

import { WholesaleCustomerForm } from "@/features/admin/components/wholesale-customer-form";
import { EMPTY_WHOLESALE_CUSTOMER } from "@/features/wholesale/customer-form-values";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { requireAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

// Con ?consulta=<id> se precarga con los datos de una consulta de /mayoristas.
export default async function AdminNewWholesaleCustomerPage({ searchParams }: { searchParams: Promise<{ consulta?: string }> }) {
  await requireAdminSection("wholesale");
  const { consulta } = await searchParams;
  const [content, lead] = await Promise.all([
    getWholesaleContent(),
    consulta && /^[0-9a-f-]{36}$/i.test(consulta) ? prisma.wholesaleLead.findUnique({ where: { id: consulta } }) : null,
  ]);

  const initialValues = lead
    ? {
        ...EMPTY_WHOLESALE_CUSTOMER,
        email: lead.email,
        phone: lead.phone,
        contactName: lead.name,
        businessName: lead.businessName ?? "",
        businessType: lead.businessType,
        cuit: lead.cuit ?? "",
        street: lead.street,
        floor: lead.floor ?? "",
        city: lead.city,
        province: lead.province,
        postalCode: lead.postalCode,
        reference: lead.reference ?? "",
      }
    : EMPTY_WHOLESALE_CUSTOMER;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Mayorista · Clientes</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Nuevo cliente</h1>
        {lead ? (
          <p className="mt-2 text-sm text-brand-ink/70">
            Precargado con la consulta de {lead.businessName || lead.name}.{" "}
            <Link href="/admin/mayoristas/consultas" className="font-bold text-brand-pink hover:underline">
              Ver consultas
            </Link>
            {lead.cuit ? null : " La consulta no tiene CUIT: completalo para poder crear el cliente."}
          </p>
        ) : null}
      </div>
      <WholesaleCustomerForm leadId={lead?.id ?? null} initialValues={initialValues} businessTypes={content.contact.businessTypes} />
    </div>
  );
}
