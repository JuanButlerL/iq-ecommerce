import { getOrders } from "@/features/orders/queries";
import { assertAdminSection } from "@/lib/auth/admin";
import { formatArgentinaDate, formatArgentinaDateTime, parseArgentinaDateParam } from "@/lib/utils/datetime";

function escapeHtml(value: string | number | null | undefined) {
  const stringValue = value == null ? "" : String(value);

  return stringValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  await assertAdminSection("orders");

  const { searchParams } = new URL(request.url);
  const dateFrom = parseArgentinaDateParam(searchParams.get("dateFrom"));
  const dateTo = parseArgentinaDateParam(searchParams.get("dateTo"), true);
  const orders = await getOrders({ dateFrom, dateTo });

  const columns = [
    "Numero de pedido",
    "Fecha de creacion",
    "Nombre",
    "Apellido",
    "Email",
    "Telefono",
    "DNI / CUIT",
    "Provincia",
    "Localidad",
    "Codigo postal",
    "Direccion",
    "Piso / Depto",
    "Observaciones",
    "Cupon",
    "Porcentaje descuento",
    "Descuento",
    "Porcentaje descuento medio de pago",
    "Descuento medio de pago",
    "Subtotal",
    "Envio",
    "Total",
    "Moneda",
    "Metodo de pago",
    "Payment provider",
    "Payment provider status",
    "Payment provider detail",
    "Payment provider reference",
    "Paid at",
    "Estado de pago",
    "Estado de pedido",
    "Estado de sync",
    "Ultimo error de sync",
    "Fuente",
    "Comprobante",
    "Items",
  ];

  const rows = orders.map((order) => {
    const lastProof = order.paymentProofs[0];
    const items = order.items
      .map((item) => `${item.productNameSnapshot} x${item.quantity} (${item.unitPriceArs})`)
      .join(" | ");

    return [
      order.publicOrderNumber,
      formatArgentinaDateTime(order.createdAt),
      order.customerFirstName,
      order.customerLastName,
      order.customerEmail,
      order.customerPhone,
      order.customerTaxId,
      order.province,
      order.locality,
      order.postalCode,
      order.addressLine,
      order.addressExtra,
      order.notes,
      order.couponCode,
      order.discountPercentage ? Number(order.discountPercentage) : "",
      order.discountArs,
      order.paymentMethodDiscountPercentage ? Number(order.paymentMethodDiscountPercentage) : "",
      order.paymentMethodDiscountArs,
      order.subtotalArs,
      order.shippingArs,
      order.totalArs,
      order.currency,
      order.paymentMethod,
      order.paymentProvider,
      order.paymentProviderStatus,
      order.paymentProviderStatusDetail,
      order.paymentProviderReference,
      order.paidAt ? formatArgentinaDateTime(order.paidAt) : "",
      order.paymentStatus,
      order.orderStatus,
      order.syncStatus,
      order.syncLastError,
      order.source,
      lastProof?.publicUrl ?? "",
      items,
    ];
  });

  const tableHead = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const tableRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <table>
          <thead>
            <tr>${tableHead}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `;

  return new Response(`\uFEFF${html}`, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-${formatArgentinaDate(new Date()).replace(/\//g, "-")}.xls"`,
    },
  });
}
