import { getNewsletterResults } from "@/features/newsletter/results-queries";
import { personStatusMeta, viaLabels, type PersonStatus } from "@/features/newsletter/results";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError } from "@/lib/http/route";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";
import { CSV_SEPARATOR, csvCell } from "@/features/newsletter/results-csv";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    await assertAdminSection("newsletter");
    const { id } = await context.params;
    const estado = new URL(request.url).searchParams.get("estado");
    const status = estado && estado in personStatusMeta ? (estado as PersonStatus) : null;
    const data = await getNewsletterResults(id);

    if (!data.found || !data.results) {
      return new Response("Newsletter sin envíos", { status: 404 });
    }

    const header = ["email", "nombre", "resultado", "recibió el mail", "primera apertura", "aperturas", "primer click", "clicks", "se dio de baja", "pedido", "fecha del pedido", "total", "descuento cupón", "cupón", "cómo se atribuyó", "cliente nuevo", "horas desde el click"];
    const rows: string[] = [];
    for (const person of data.results.people) {
      if (status && person.status !== status) continue;
      const base = [
        person.email,
        person.name,
        personStatusMeta[person.status].label,
        person.received ? "Sí" : "No",
        person.firstOpenedAt ? formatArgentinaDateTime(person.firstOpenedAt) : "",
        person.openCount,
        person.firstClickedAt ? formatArgentinaDateTime(person.firstClickedAt) : "",
        person.clickCount,
        person.unsubscribed ? "Sí" : "No",
      ];
      const orders = person.orders.length > 0 ? person.orders : [null];
      for (const order of orders) {
        rows.push(
          [
            ...base,
            order?.orderNumber,
            order ? formatArgentinaDateTime(order.createdAt) : "",
            order?.totalArs,
            order?.discountArs,
            order?.couponCode,
            order ? order.via.map((via) => viaLabels[via]).join(" y ") : "",
            order ? (order.newCustomer ? "Sí" : "No") : "",
            order?.hoursFromEmail,
          ]
            .map(csvCell)
            .join(CSV_SEPARATOR),
        );
      }
    }
    const suffix = status ? `-${personStatusMeta[status].short.toLowerCase().replace(/\s+/g, "-")}` : "";
    const fileName = `resultados-${data.results.newsletter.slug}${suffix}.csv`;

    return new Response(`﻿${[header.map(csvCell).join(CSV_SEPARATOR), ...rows].join("\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
