"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { formatArs } from "@/lib/utils/currency";

type ChartPoint = {
  label: string;
  orders: number;
  revenue: number;
  units: number;
};

type Period = "day" | "week" | "month";

type SalesDataset = {
  daily: ChartPoint[];
  weekly: ChartPoint[];
  monthly: ChartPoint[];
};

type DashboardSalesChartProps = {
  series: SalesDataset;
};

const periodCopy: Record<Period, { label: string; eyebrow: string; title: string; helper: string }> = {
  day: {
    label: "Dia",
    eyebrow: "Pulso diario",
    title: "Como se mueve la venta dia por dia",
    helper: "Ultimos 30 dias. Ideal para entender picos, dias flojos y ritmo operativo.",
  },
  week: {
    label: "Semana",
    eyebrow: "Ritmo semanal",
    title: "La semana como unidad de negocio",
    helper: "Comparacion de 8 semanas para ver si la demanda se acelera o se enfria.",
  },
  month: {
    label: "Mes",
    eyebrow: "Tendencia",
    title: "Evolucion mensual",
    helper: "Ultimos 6 meses. Sirve para mirar crecimiento sin ruido diario.",
  },
};

export function DashboardSalesChart({ series }: DashboardSalesChartProps) {
  const [period, setPeriod] = useState<Period>("day");
  const points = period === "day" ? series.daily : period === "week" ? series.weekly : series.monthly;

  const maxOrders = Math.max(...points.map((point) => point.orders), 1);
  const totalRevenue = useMemo(() => points.reduce((acc, point) => acc + point.revenue, 0), [points]);
  const totalOrders = useMemo(() => points.reduce((acc, point) => acc + point.orders, 0), [points]);
  const copy = periodCopy[period];

  return (
    <Card className="overflow-hidden p-5 md:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">{copy.eyebrow}</p>
          <h2 className="mt-1 max-w-2xl font-display text-3xl leading-none text-brand-ink md:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-brand-ink/55">
            {copy.helper} El alto de cada barra muestra cantidad de pedidos; el detalle incluye facturacion total.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
          <div className="inline-flex rounded-full border border-brand-ink/10 bg-background p-1">
            {(Object.keys(periodCopy) as Period[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className={`rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] transition ${
                  period === item ? "bg-brand-pink text-white shadow-soft" : "text-brand-ink/55 hover:text-brand-pink"
                }`}
              >
                {periodCopy[item].label}
              </button>
            ))}
          </div>
          <div className="rounded-[1.25rem] bg-brand-pink/10 px-4 py-3 text-left lg:text-right">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-pink">Total periodo</p>
            <p className="mt-1 text-lg font-extrabold text-brand-ink">{formatArs(totalRevenue)}</p>
            <p className="text-xs font-bold text-brand-ink/45">{totalOrders} pedidos</p>
          </div>
        </div>
      </div>

      <div className="flex h-[230px] items-end gap-1 overflow-x-auto pb-2 md:gap-2">
        {points.map((point) => (
          <div key={point.label} className="flex min-w-9 flex-1 flex-col items-center gap-2">
            <div className="flex h-40 w-full items-end rounded-full bg-brand-pink/5">
              <div
                className="w-full rounded-full bg-brand-pink shadow-[0_10px_24px_rgba(248,128,140,0.28)] transition-all"
                style={{ height: point.orders ? `${Math.max(7, (point.orders / maxOrders) * 100)}%` : "0%" }}
                title={`${point.label}: ${point.orders} pedidos - ${formatArs(point.revenue)} facturados`}
              />
            </div>
            <span className="max-w-14 text-center text-[0.62rem] font-bold leading-tight text-brand-ink/45">
              {point.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
