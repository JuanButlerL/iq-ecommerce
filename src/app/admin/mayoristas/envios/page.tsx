import Link from "next/link";

import { ShippingRuleForm } from "@/features/admin/components/shipping-rule-form";
import { getWholesaleSettings, getWholesaleShippingRule } from "@/features/wholesale/settings";
import { requireAdminSection } from "@/lib/auth/admin";
import { formatArs } from "@/lib/utils/currency";

export default async function AdminWholesaleShippingPage() {
  await requireAdminSection("wholesale");
  const [rule, settings] = await Promise.all([getWholesaleShippingRule(), getWholesaleSettings()]);

  return (
    <ShippingRuleForm
      key={rule.updatedAt.toISOString()}
      rule={rule}
      title="Envíos mayoristas"
      endpoint={`/api/admin/wholesale-shipping/${rule.id}`}
      intro={
        <>
          Tabla de envíos de los pedidos de /mayoristas, independiente de la de la tienda. Funciona igual: precio por provincia (o fijo) y descuento parcial
          opcional. Envío gratis mayorista:{" "}
          <strong>{settings.freeShippingThresholdArs ? `desde ${formatArs(settings.freeShippingThresholdArs)}` : "desactivado"}</strong> (
          <Link href="/admin/mayoristas/condiciones" className="font-bold text-brand-pink hover:underline">
            cambiar en Condiciones
          </Link>
          ).
        </>
      }
    />
  );
}
