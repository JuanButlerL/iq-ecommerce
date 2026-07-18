import { cache } from "react";
import { OrderStatus, PaymentMethod, PaymentStatus, SyncStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  addArgentinaDays,
  formatArgentinaDayLabel,
  formatArgentinaMonthLabel,
  getArgentinaDateKey,
  getArgentinaDateParts,
  getArgentinaMonthKey,
  getArgentinaMonthStart,
  getArgentinaStartOfDay,
  getArgentinaStartOfMonth,
} from "@/lib/utils/datetime";

export type OrderFilters = {
  search?: string;
  orderStatus?: OrderStatus | "ALL";
  paymentStatus?: PaymentStatus | "ALL";
  syncStatus?: SyncStatus | "ALL";
  dateFrom?: Date;
  dateTo?: Date;
};

export const getDashboardMetrics = cache(async () => {
  const [totalOrders, pendingOrders, syncPending, activeProducts] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({
      where: {
        orderStatus: {
          in: [OrderStatus.PENDING_PAYMENT, OrderStatus.PROOF_UPLOADED],
        },
      },
    }),
    prisma.order.count({
      where: {
        syncStatus: {
          in: [SyncStatus.PENDING, SyncStatus.ERROR],
        },
      },
    }),
    prisma.product.count({
      where: {
        active: true,
      },
    }),
  ]);

  return {
    totalOrders,
    pendingOrders,
    syncPending,
    activeProducts,
  };
});

const paidLikePaymentStatuses: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.PROOF_UPLOADED];
const validOrderStatuses: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PROOF_UPLOADED,
  OrderStatus.PAID,
  OrderStatus.PREPARING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

function startOfRollingWindow(days: number) {
  return addArgentinaDays(getArgentinaStartOfDay(), -days + 1);
}

function getNetProductsRevenue(order: {
  subtotalArs: number;
  discountArs: number;
  paymentMethodDiscountArs: number;
}) {
  return Math.max(order.subtotalArs - order.discountArs - order.paymentMethodDiscountArs, 0);
}

function buildWeekLabel(start: Date, end: Date) {
  return `${formatArgentinaDayLabel(start)}-${formatArgentinaDayLabel(end)}`;
}

type DashboardSeriesOrder = {
  createdAt: Date;
  subtotalArs: number;
  discountArs: number;
  paymentMethodDiscountArs: number;
  totalArs: number;
  items: Array<{ quantity: number }>;
};

export type DashboardOrderStatusFilter = "ALL" | "CONFIRMED" | "PENDING";

function buildDashboardTimeSeries(inputOrders: DashboardSeriesOrder[], now: Date) {
  const dailyMap = new Map<string, { label: string; orders: number; revenue: number; units: number }>();
  const todayStart = getArgentinaStartOfDay(now);
  for (let index = 29; index >= 0; index -= 1) {
    const date = addArgentinaDays(todayStart, -index);
    const key = getArgentinaDateKey(date);
    dailyMap.set(key, { label: formatArgentinaDayLabel(date), orders: 0, revenue: 0, units: 0 });
  }

  const monthlyMap = new Map<string, { label: string; orders: number; revenue: number; units: number }>();
  const currentMonthParts = getArgentinaDateParts(now);
  for (let index = 5; index >= 0; index -= 1) {
    const date = getArgentinaMonthStart(currentMonthParts.year, currentMonthParts.month - index);
    const key = getArgentinaMonthKey(date);
    monthlyMap.set(key, { label: formatArgentinaMonthLabel(date), orders: 0, revenue: 0, units: 0 });
  }

  const weeklyRanges = Array.from({ length: 8 }, (_, index) => {
    const start = addArgentinaDays(todayStart, -(7 * (7 - index) + 6));
    const end = addArgentinaDays(start, 7);

    return {
      label: buildWeekLabel(start, addArgentinaDays(end, -1)),
      start,
      end,
      orders: 0,
      revenue: 0,
      units: 0,
    };
  });

  for (const order of inputOrders) {
    const orderRevenue = order.totalArs;
    const orderUnits = order.items.reduce((acc, item) => acc + item.quantity, 0);
    const dayKey = getArgentinaDateKey(order.createdAt);
    const monthKey = getArgentinaMonthKey(order.createdAt);
    const day = dailyMap.get(dayKey);
    const month = monthlyMap.get(monthKey);

    if (day) {
      day.orders += 1;
      day.revenue += orderRevenue;
      day.units += orderUnits;
    }

    if (month) {
      month.orders += 1;
      month.revenue += orderRevenue;
      month.units += orderUnits;
    }

    const week = weeklyRanges.find((range) => order.createdAt >= range.start && order.createdAt < range.end);

    if (week) {
      week.orders += 1;
      week.revenue += orderRevenue;
      week.units += orderUnits;
    }
  }

  return {
    daily: Array.from(dailyMap.values()),
    weekly: weeklyRanges.map(({ label, orders, revenue, units }) => ({ label, orders, revenue, units })),
    monthly: Array.from(monthlyMap.values()),
  };
}

function isCollectedOrder(order: { paymentStatus: PaymentStatus }) {
  return paidLikePaymentStatuses.includes(order.paymentStatus);
}

function buildDashboardOrderWhere(orderStatusFilter: DashboardOrderStatusFilter) {
  if (orderStatusFilter === "CONFIRMED") {
    return {
      orderStatus: {
        notIn: [OrderStatus.CANCELLED, OrderStatus.EXPIRED],
      },
      paymentStatus: {
        in: paidLikePaymentStatuses,
      },
    };
  }

  if (orderStatusFilter === "PENDING") {
    return {
      orderStatus: OrderStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
    };
  }

  return {
    orderStatus: {
      in: validOrderStatuses,
    },
  };
}

function getCustomerKeys(order: {
  customerEmail: string;
  customerPhone: string;
  customerTaxId: string | null;
}) {
  return [
    order.customerEmail.trim().toLowerCase(),
    order.customerPhone.replace(/\D/g, ""),
    order.customerTaxId?.replace(/\D/g, "") ?? "",
  ].filter(Boolean);
}

function getProductFlavor(item: {
  productNameSnapshot: string;
  product?: { homeVarietyLabel: string | null; name: string } | null;
}) {
  const rawLabel = item.product?.homeVarietyLabel || item.product?.name || item.productNameSnapshot;
  const label = rawLabel.toLowerCase();

  if (label.includes("mix")) return "Mix";
  if (label.includes("mani") || label.includes("maní")) return "Mani";
  if (label.includes("cacao") || label.includes("chocolate")) return "Cacao";
  if (label.includes("banana")) return "Banana";

  return rawLabel;
}

function formatArgentinaMonthYearLabel(date: Date) {
  const parts = getArgentinaDateParts(date);

  return `${formatArgentinaMonthLabel(date)} ${parts.year}`;
}

export const getAdminDashboardAnalytics = cache(async () => {
  return getAdminDashboardAnalyticsByStatus("ALL");
});

export const getAdminDashboardAnalyticsByStatus = cache(async (
  orderStatusFilter: DashboardOrderStatusFilter = "ALL",
  recoveryMonthFilter = "ALL",
) => {
  const now = new Date();
  const todayStart = getArgentinaStartOfDay(now);
  const monthStart = getArgentinaStartOfMonth(now);
  const rolling90Start = startOfRollingWindow(90);
  const dashboardWhere = buildDashboardOrderWhere(orderStatusFilter);

  const [orders, recentOrders, activeProducts, syncPending, recoveryCandidates, collectedIdentityOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: rolling90Start },
        ...dashboardWhere,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                homeVarietyLabel: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      take: 10,
      where: {
        ...dashboardWhere,
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.count({ where: { active: true } }),
    prisma.order.count({ where: { syncStatus: { in: [SyncStatus.PENDING, SyncStatus.ERROR] } } }),
    orderStatusFilter === "ALL" || orderStatusFilter === "PENDING"
      ? prisma.order.findMany({
          where: {
            paymentStatus: PaymentStatus.PENDING,
            orderStatus: OrderStatus.PENDING_PAYMENT,
          },
          include: {
            items: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.order.findMany({
      where: {
        paymentStatus: { in: paidLikePaymentStatuses },
      },
      select: {
        createdAt: true,
        customerEmail: true,
        customerPhone: true,
        customerTaxId: true,
      },
    }),
  ]);

  const todayOrders = orders.filter((order) => order.createdAt >= todayStart);
  const monthOrders = orders.filter((order) => order.createdAt >= monthStart);
  const paidMonthOrders = monthOrders.filter(isCollectedOrder);
  const collectedOrders = orders.filter(isCollectedOrder);
  const collectedSeries = buildDashboardTimeSeries(collectedOrders, now);

  const buildRevenue = (items: typeof orders) => items.reduce((acc, order) => acc + getNetProductsRevenue(order), 0);
  const buildGrossRevenue = (items: typeof orders) => items.reduce((acc, order) => acc + order.totalArs, 0);
  const buildUnits = (items: typeof orders) =>
    items.reduce((acc, order) => acc + order.items.reduce((itemAcc, item) => itemAcc + item.quantity, 0), 0);
  const buildDiscounts = (items: typeof orders) =>
    items.reduce((acc, order) => acc + order.discountArs + order.paymentMethodDiscountArs, 0);

  const dailyMap = new Map<string, { label: string; orders: number; revenue: number; units: number }>();
  for (let index = 29; index >= 0; index -= 1) {
    const date = addArgentinaDays(todayStart, -index);
    const key = getArgentinaDateKey(date);
    dailyMap.set(key, { label: formatArgentinaDayLabel(date), orders: 0, revenue: 0, units: 0 });
  }

  const monthlyMap = new Map<string, { label: string; orders: number; revenue: number; units: number }>();
  const currentMonthParts = getArgentinaDateParts(now);
  for (let index = 5; index >= 0; index -= 1) {
    const date = getArgentinaMonthStart(currentMonthParts.year, currentMonthParts.month - index);
    const key = getArgentinaMonthKey(date);
    monthlyMap.set(key, { label: formatArgentinaMonthLabel(date), orders: 0, revenue: 0, units: 0 });
  }

  const weeklyRanges = Array.from({ length: 8 }, (_, index) => {
    const start = addArgentinaDays(todayStart, -(7 * (7 - index) + 6));
    const end = addArgentinaDays(start, 7);

    return {
      label: buildWeekLabel(start, addArgentinaDays(end, -1)),
      start,
      end,
      orders: 0,
      revenue: 0,
      units: 0,
    };
  });

  const productMap = new Map<string, { name: string; units: number; revenue: number }>();
  const flavorMap = new Map<string, { name: string; units: number; revenue: number }>();
  const paymentMap = new Map<PaymentMethod, { name: string; orders: number; revenue: number }>();
  const sourceMap = new Map<string, { name: string; orders: number; revenue: number }>();

  for (const order of orders) {
    const orderRevenue = order.totalArs;
    const orderUnits = order.items.reduce((acc, item) => acc + item.quantity, 0);
    const dayKey = getArgentinaDateKey(order.createdAt);
    const monthKey = getArgentinaMonthKey(order.createdAt);
    const day = dailyMap.get(dayKey);
    const month = monthlyMap.get(monthKey);

    if (day) {
      day.orders += 1;
      day.revenue += orderRevenue;
      day.units += orderUnits;
    }

    if (month) {
      month.orders += 1;
      month.revenue += orderRevenue;
      month.units += orderUnits;
    }

    const week = weeklyRanges.find((range) => order.createdAt >= range.start && order.createdAt < range.end);

    if (week) {
      week.orders += 1;
      week.revenue += orderRevenue;
      week.units += orderUnits;
    }

    const payment = paymentMap.get(order.paymentMethod) ?? {
      name: order.paymentMethod === PaymentMethod.MERCADO_PAGO ? "Mercado Pago" : "Transferencia",
      orders: 0,
      revenue: 0,
    };
    payment.orders += 1;
    payment.revenue += orderRevenue;
    paymentMap.set(order.paymentMethod, payment);

    const sourceKey = order.source;
    const source = sourceMap.get(sourceKey) ?? { name: sourceKey, orders: 0, revenue: 0 };
    source.orders += 1;
    source.revenue += orderRevenue;
    sourceMap.set(sourceKey, source);

    for (const item of order.items) {
      const productKey = item.productId ?? item.productNameSnapshot;
      const product = productMap.get(productKey) ?? {
        name: item.productNameSnapshot,
        units: 0,
        revenue: 0,
      };
      product.units += item.quantity;
      product.revenue += item.lineTotalArs;
      productMap.set(productKey, product);

      const flavorName = getProductFlavor(item);
      const flavor = flavorMap.get(flavorName) ?? { name: flavorName, units: 0, revenue: 0 };
      flavor.units += item.quantity;
      flavor.revenue += item.lineTotalArs;
      flavorMap.set(flavorName, flavor);
    }
  }

  const monthRevenue = buildRevenue(monthOrders);
  const monthGrossRevenue = buildGrossRevenue(monthOrders);
  const monthOrderCount = monthOrders.length;
  const monthUnits = buildUnits(monthOrders);
  const monthShipping = monthOrders.reduce((acc, order) => acc + order.shippingArs, 0);
  const actionableRecoveryOrders = recoveryCandidates
    .filter((order) => {
      const keys = getCustomerKeys(order);

      return !collectedIdentityOrders.some(
        (collectedOrder) =>
          collectedOrder.createdAt > order.createdAt &&
          getCustomerKeys(collectedOrder).some((key) => keys.includes(key)),
      );
    })
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map((order) => ({
      ...order,
      productsRevenue: getNetProductsRevenue(order),
    }));
  const recoveryMonthMap = new Map<string, { value: string; label: string }>();

  for (const order of actionableRecoveryOrders) {
    const monthKey = getArgentinaMonthKey(order.createdAt);

    if (!recoveryMonthMap.has(monthKey)) {
      recoveryMonthMap.set(monthKey, {
        value: monthKey,
        label: formatArgentinaMonthYearLabel(order.createdAt),
      });
    }
  }

  const recoveryMonths = Array.from(recoveryMonthMap.values()).sort((left, right) =>
    right.value.localeCompare(left.value),
  );
  const recoveryOrders =
    recoveryMonthFilter === "ALL"
      ? actionableRecoveryOrders
      : actionableRecoveryOrders.filter((order) => getArgentinaMonthKey(order.createdAt) === recoveryMonthFilter);

  return {
    generatedAt: now,
    totals: {
      todayOrders: todayOrders.length,
      todayRevenue: buildRevenue(todayOrders),
      monthOrders: monthOrders.length,
      monthRevenue,
      monthGrossRevenue,
      paidMonthRevenue: buildRevenue(paidMonthOrders),
      monthUnits,
      monthDiscounts: buildDiscounts(monthOrders),
      averagePaidTicket: monthOrderCount ? Math.round(monthGrossRevenue / monthOrderCount) : 0,
      averageShipping: monthOrderCount ? Math.round(monthShipping / monthOrderCount) : 0,
      averageUnits: monthOrderCount ? Number((monthUnits / monthOrderCount).toFixed(1)) : 0,
      activeProducts,
      syncPending,
    },
    daily: Array.from(dailyMap.values()),
    weekly: weeklyRanges.map(({ label, orders, revenue, units }) => ({ label, orders, revenue, units })),
    monthly: Array.from(monthlyMap.values()),
    collectedDaily: collectedSeries.daily,
    collectedWeekly: collectedSeries.weekly,
    collectedMonthly: collectedSeries.monthly,
    recoveryMonths,
    selectedRecoveryMonth: recoveryMonthFilter,
    products: Array.from(productMap.values()).sort((left, right) => right.units - left.units).slice(0, 8),
    flavors: Array.from(flavorMap.values()).sort((left, right) => right.units - left.units),
    payments: Array.from(paymentMap.values()).sort((left, right) => right.revenue - left.revenue),
    sources: Array.from(sourceMap.values()).sort((left, right) => right.orders - left.orders),
    recentOrders: recentOrders.map((order) => ({
      ...order,
      productsRevenue: getNetProductsRevenue(order),
    })),
    recoveryOrders,
  };
});

export async function getOrders(filters: OrderFilters = {}) {
  return prisma.order.findMany({
    where: {
      ...(filters.search
        ? {
            OR: [
              { publicOrderNumber: { contains: filters.search, mode: "insensitive" } },
              { customerFirstName: { contains: filters.search, mode: "insensitive" } },
              { customerLastName: { contains: filters.search, mode: "insensitive" } },
              { customerEmail: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filters.orderStatus && filters.orderStatus !== "ALL"
        ? { orderStatus: filters.orderStatus }
        : {}),
      ...(filters.paymentStatus && filters.paymentStatus !== "ALL"
        ? { paymentStatus: filters.paymentStatus }
        : {}),
      ...(filters.syncStatus && filters.syncStatus !== "ALL" ? { syncStatus: filters.syncStatus } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
    },
    include: {
      items: true,
      paymentProofs: {
        orderBy: {
          uploadedAt: "desc",
        },
        take: 1,
      },
      mercadoPagoPayments: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getOrderDetail(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          },
        },
      },
      paymentProofs: {
        orderBy: {
          uploadedAt: "desc",
        },
      },
      mercadoPagoPreference: true,
      mercadoPagoPayments: {
        orderBy: {
          createdAt: "desc",
        },
      },
      paymentWebhookEvents: {
        orderBy: {
          createdAt: "desc",
        },
      },
      statusHistory: {
        orderBy: {
          createdAt: "desc",
        },
      },
      syncJobs: {
        include: {
          logs: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}
