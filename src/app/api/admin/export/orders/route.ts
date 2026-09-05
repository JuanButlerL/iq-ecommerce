import { OrderStatus, PaymentMethod, PaymentStatus, SyncStatus } from "@prisma/client";

import { getOrders, type OrderFilters } from "@/features/orders/queries";
import { assertAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { formatArgentinaDate, formatArgentinaDateTime, parseArgentinaDateParam } from "@/lib/utils/datetime";

function getEnumValue<T extends Record<string, string>>(enumObject: T, value: string | null) {
  if (!value || value === "ALL") {
    return "ALL";
  }

  return Object.values(enumObject).includes(value) ? value : "ALL";
}

function getOperationalStatus(value: string | null) {
  const valid = ["ALL", "TO_COLLECT", "PROOF_REVIEW", "TO_PREPARE", "SYNC_ISSUES", "CANCELLED"];

  return valid.includes(value ?? "") ? value : "ALL";
}

function getProofStatus(value: string | null) {
  return value === "WITH_PROOF" || value === "WITHOUT_PROOF" ? value : "ALL";
}

function escapeHtml(value: string | number | boolean | null | undefined) {
  const stringValue = value == null ? "" : String(value);

  return stringValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type MarketingSessionLite = {
  email: string | null;
  sourceCategory: string;
  sourcePlatform: string;
  sourceChannel: string;
  sourceLabel: string;
  utmCampaign: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrerHost: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

export async function GET(request: Request) {
  await assertAdminSection("orders");

  const { searchParams } = new URL(request.url);
  const dateFrom = parseArgentinaDateParam(searchParams.get("dateFrom"));
  const dateTo = parseArgentinaDateParam(searchParams.get("dateTo"), true);
  const orders = await getOrders({
    search: searchParams.get("search")?.trim() || undefined,
    operationalStatus: getOperationalStatus(searchParams.get("operationalStatus")) as OrderFilters["operationalStatus"],
    orderStatus: getEnumValue(OrderStatus, searchParams.get("orderStatus")) as OrderFilters["orderStatus"],
    paymentStatus: getEnumValue(PaymentStatus, searchParams.get("paymentStatus")) as OrderFilters["paymentStatus"],
    paymentMethod: getEnumValue(PaymentMethod, searchParams.get("paymentMethod")) as OrderFilters["paymentMethod"],
    syncStatus: getEnumValue(SyncStatus, searchParams.get("syncStatus")) as OrderFilters["syncStatus"],
    proofStatus: getProofStatus(searchParams.get("proofStatus")) as OrderFilters["proofStatus"],
    dateFrom,
    dateTo,
  });

  const emails = Array.from(new Set(orders.map((order) => order.customerEmail.trim().toLowerCase()).filter(Boolean)));
  const marketingSessions = emails.length > 0
    ? await prisma.marketingSession.findMany({
        where: {
          email: { in: emails },
        },
        select: {
          email: true,
          sourceCategory: true,
          sourcePlatform: true,
          sourceChannel: true,
          sourceLabel: true,
          utmCampaign: true,
          utmSource: true,
          utmMedium: true,
          utmContent: true,
          utmTerm: true,
          referrerHost: true,
          firstSeenAt: true,
          lastSeenAt: true,
        },
        orderBy: {
          firstSeenAt: "asc",
        },
      })
    : [];

  const sessionsByEmail = new Map<string, MarketingSessionLite[]>();
  for (const session of marketingSessions) {
    const email = session.email?.trim().toLowerCase();
    if (!email) continue;
    const current = sessionsByEmail.get(email) ?? [];
    current.push(session);
    sessionsByEmail.set(email, current);
  }

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
    "Calle",
    "Altura",
    "Calle sin altura",
    "Piso / Depto",
    "Observaciones",
    "Cupon",
    "Tipo cupon",
    "Porcentaje descuento",
    "Monto fijo cupon",
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
    "Marketing origen ultimo",
    "Marketing categoria ultima",
    "Marketing plataforma ultima",
    "UTM Campaign ultima",
    "UTM Source ultima",
    "UTM Medium ultima",
    "UTM Content ultima",
    "UTM Term ultima",
    "Referrer ultimo",
    "Primer touch origen",
    "Primer touch campana",
    "Ultimo touch origen",
    "Ultimo touch campana",
    "Primer touch pago",
    "Ultimo touch pago",
    "Campanas asistidas",
    "Plataformas asistidas",
    "Orgenes asistidos",
    "Touchpoints marketing",
    "Primer ingreso marketing",
    "Ultimo ingreso marketing",
    "Journey marketing",
  ];

  const rows = orders.map((order) => {
    const lastProof = order.paymentProofs[0];
    const items = order.items
      .map((item) => `${item.productNameSnapshot} x${item.quantity} (${item.unitPriceArs})`)
      .join(" | ");

    const journey = buildOrderJourney(order.createdAt, sessionsByEmail.get(order.customerEmail.trim().toLowerCase()) ?? []);
    const currentTouch = order.marketingSession ?? journey.lastTouch ?? journey.firstTouch;

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
      [order.addressLine, order.addressNumber].filter(Boolean).join(" "),
      order.addressLine,
      order.addressNumber ?? "",
      order.addressWithoutNumber === true ? "Si" : "No",
      order.addressExtra,
      order.notes,
      order.couponCode,
      order.coupon?.discountType ?? "",
      order.discountPercentage ? Number(order.discountPercentage) : "",
      order.coupon?.fixedDiscountArs ?? "",
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
      currentTouch?.sourceLabel ?? "",
      currentTouch?.sourceCategory ?? "",
      currentTouch?.sourcePlatform ?? "",
      currentTouch?.utmCampaign ?? "",
      currentTouch?.utmSource ?? "",
      currentTouch?.utmMedium ?? "",
      currentTouch?.utmContent ?? "",
      currentTouch?.utmTerm ?? "",
      currentTouch?.referrerHost ?? "",
      journey.firstTouch?.sourceLabel ?? "",
      journey.firstTouch?.utmCampaign ?? "",
      journey.lastTouch?.sourceLabel ?? "",
      journey.lastTouch?.utmCampaign ?? "",
      journey.firstPaidTouch?.sourceLabel ?? "",
      journey.lastPaidTouch?.sourceLabel ?? "",
      journey.assistedCampaigns.join(" | "),
      journey.assistedPlatforms.join(" | "),
      journey.assistedSources.join(" | "),
      journey.touchpoints,
      journey.firstTouch?.firstSeenAt ? formatArgentinaDateTime(journey.firstTouch.firstSeenAt) : "",
      journey.lastTouch?.lastSeenAt ? formatArgentinaDateTime(journey.lastTouch.lastSeenAt) : "",
      journey.journeySummary,
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

function buildOrderJourney(orderCreatedAt: Date, sessions: MarketingSessionLite[]) {
  const scopedSessions = sessions
    .filter((session) => session.firstSeenAt <= orderCreatedAt)
    .sort((left, right) => left.firstSeenAt.getTime() - right.firstSeenAt.getTime());
  const meaningfulSessions = scopedSessions.filter((session) => session.sourceCategory !== "DIRECT" || Boolean(session.utmCampaign || session.utmSource || session.referrerHost));
  const firstTouch = meaningfulSessions[0] ?? scopedSessions[0] ?? null;
  const lastTouch = meaningfulSessions[meaningfulSessions.length - 1] ?? scopedSessions[scopedSessions.length - 1] ?? null;
  const paidSessions = meaningfulSessions.filter((session) => ["META", "GOOGLE", "TIKTOK"].includes(session.sourceCategory) || session.utmMedium === "paid_social" || session.utmMedium === "cpc");

  return {
    firstTouch,
    lastTouch,
    firstPaidTouch: paidSessions[0] ?? null,
    lastPaidTouch: paidSessions[paidSessions.length - 1] ?? null,
    assistedCampaigns: uniqueStrings(meaningfulSessions.map((session) => session.utmCampaign)),
    assistedPlatforms: uniqueStrings(meaningfulSessions.map((session) => session.sourcePlatform)),
    assistedSources: uniqueStrings(meaningfulSessions.map((session) => session.sourceLabel)),
    touchpoints: scopedSessions.length,
    journeySummary: scopedSessions.map((session) => `${session.sourceLabel}${session.utmCampaign ? ` / ${session.utmCampaign}` : ""}`).join(" -> "),
  };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}
