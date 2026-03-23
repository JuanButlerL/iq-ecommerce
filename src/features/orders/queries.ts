import { cache } from "react";
import { OrderStatus, PaymentStatus, SyncStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

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
