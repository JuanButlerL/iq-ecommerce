"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";

type ChartPoint = {
  label: string;
  orders: number;
  revenue: number;
  units: number;
  year?: number;
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

const periodCopy: Record<Period, { label: string; eyebrow: string; title: string; helper: string; unit: string }> = {
  day: {
    label: "Dia",
    eyebrow: "Pulso diario",
    title: "Como se mueve la venta dia por dia",
    helper: "Ultimos 30 dias. Ideal para entender picos, dias flojos y ritmo operativo.",
    unit: "dia",
  },
  week: {
    label: "Semana",
    eyebrow: "Ritmo semanal",
    title: "La semana como unidad de negocio",
    helper: "Comparacion de 8 semanas para ver si la demanda se acelera o se enfria.",
    unit: "semana",
  },
  month: {
    label: "Mes",
    eyebrow: "Tendencia",
    title: "Evolucion mensual",
    helper: "Todo el historial, mes a mes. Sirve para mirar crecimiento sin ruido diario.",
    unit: "mes",
  },
};

// Rounds the axis maximum up to a readable value without wasting height
// (e.g. 291 -> 300, 57 -> 60, 12 -> 12).
function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const step = steps.find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

function pointTitle(point: ChartPoint, period: Period) {
  return period === "month" && point.year ? `${point.label} ${point.year}` : point.label;
}

export function DashboardSalesChart({ series }: DashboardSalesChartProps) {
  const [period, setPeriod] = useState<Period>("day");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const points = period === "day" ? series.daily : period === "week" ? series.weekly : series.monthly;

  const axisMax = niceMax(Math.max(...points.map((point) => point.orders), 0));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => Math.round(axisMax * ratio));
  const totalRevenue = useMemo(() => points.reduce((acc, point) => acc + point.revenue, 0), [points]);
  const totalOrders = useMemo(() => points.reduce((acc, point) => acc + point.orders, 0), [points]);
  const copy = periodCopy[period];
  const selectedIndex = activeIndex ?? points.length - 1;
  const selected = points[selectedIndex];
  const showValues = points.length <= 16;
  // Only long histories scroll; 30 daily bars fit in the card width.
  const needsScroll = points.length > 36;
  const labelEvery = period === "day" ? 5 : 1;

  // Always open on the most recent period, even when the history needs scrolling.
  useEffect(() => {
    setActiveIndex(null);
    const element = scrollRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [period, points.length]);

  return (
    <Card className="overflow-hidden p-5 md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">{copy.eyebrow}</p>
          <h2 className="mt-1 max-w-2xl font-display text-3xl leading-none text-brand-ink md:text-4xl">{copy.title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-brand-ink/55">
            {copy.helper} El alto de cada barra muestra cantidad de pedidos; el detalle incluye facturacion total.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          <div className="inline-flex rounded-full border border-brand-ink/10 bg-white p-1" role="tablist" aria-label="Periodo del grafico">
            {(Object.keys(periodCopy) as Period[]).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={period === item}
                onClick={() => setPeriod(item)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] transition",
                  period === item ? "bg-brand-ink text-white shadow-card" : "text-brand-ink/55 hover:text-brand-pink",
                )}
              >
                {periodCopy[item].label}
              </button>
            ))}
          </div>
          <div className="rounded-[1.25rem] bg-brand-pink/10 px-4 py-3 text-left lg:text-right">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-pink">Total periodo</p>
            <p className="mt-1 text-lg font-extrabold text-brand-ink">{formatArs(totalRevenue)}</p>
            <p className="text-xs font-bold text-brand-ink/45">{totalOrders.toLocaleString("es-AR")} pedidos</p>
          </div>
        </div>
      </div>

      {selected ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[1.25rem] border border-brand-ink/8 bg-brand-ink/[0.02] px-4 py-3" aria-live="polite">
          <p className="text-sm font-extrabold capitalize text-brand-ink">
            {pointTitle(selected, period)}
            {activeIndex === null ? <span className="ml-2 text-xs font-bold normal-case text-brand-ink/40">ultimo {copy.unit}</span> : null}
          </p>
          <p className="text-sm text-brand-ink/60">
            <span className="font-extrabold text-brand-ink">{selected.orders.toLocaleString("es-AR")}</span> pedidos
          </p>
          <p className="text-sm text-brand-ink/60">
            <span className="font-extrabold text-brand-pink">{formatArs(selected.revenue)}</span> facturados
          </p>
          <p className="text-sm text-brand-ink/60">
            <span className="font-extrabold text-brand-ink">{selected.units.toLocaleString("es-AR")}</span> unidades
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex gap-3">
        <div className="flex h-[220px] w-9 shrink-0 flex-col justify-between pb-7 pt-5 text-right text-[0.65rem] font-bold text-brand-ink/35" aria-hidden>
          {ticks.map((tick, index) => (
            <span key={index} className="-translate-y-1/2 leading-none">
              {tick}
            </span>
          ))}
        </div>

        <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-x-auto pb-1" onMouseLeave={() => setActiveIndex(null)}>
          <div className="relative h-[220px] pr-4" style={{ minWidth: needsScroll ? `${points.length * 26}px` : undefined }}>
            <div className="pointer-events-none absolute inset-x-0 top-5 bottom-7 flex flex-col justify-between" aria-hidden>
              {ticks.map((tick, index) => (
                <div key={index} className={cn("border-t", index === ticks.length - 1 ? "border-brand-ink/15" : "border-dashed border-brand-ink/8")} />
              ))}
            </div>

            <div className="relative flex h-full items-stretch gap-1 pt-5 md:gap-1.5">
              {points.map((point, index) => {
                const isActive = index === selectedIndex;
                const height = point.orders > 0 ? Math.max(3, (point.orders / axisMax) * 100) : 0;
                const showYear = period === "month" && point.year && (index === 0 || points[index - 1]?.year !== point.year);
                const showLabel = index % labelEvery === 0 || index === points.length - 1;

                return (
                  <button
                    key={`${point.label}-${point.year ?? ""}-${index}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onBlur={() => setActiveIndex(null)}
                    aria-label={`${pointTitle(point, period)}: ${point.orders} pedidos, ${formatArs(point.revenue)} facturados`}
                    className="group relative flex min-w-[18px] flex-1 flex-col items-center outline-none"
                  >
                    <div className="relative flex w-full flex-1 items-end justify-center">
                      {showYear ? (
                        <span className="pointer-events-none absolute left-0 top-0 h-full border-l border-brand-ink/10" aria-hidden>
                          <span className="absolute left-1 top-0 whitespace-nowrap rounded-full bg-brand-ink/5 px-1.5 text-[0.6rem] font-extrabold text-brand-ink/45">{point.year}</span>
                        </span>
                      ) : null}
                      {point.orders > 0 && showValues ? (
                        <span
                          className={cn("absolute text-[0.65rem] font-extrabold transition", isActive ? "text-brand-ink" : "text-brand-ink/35")}
                          style={{ bottom: `calc(${height}% + 4px)` }}
                        >
                          {point.orders}
                        </span>
                      ) : null}
                      <div
                        className={cn(
                          "w-full max-w-[44px] rounded-t-[8px] rounded-b-[2px] transition-all duration-300",
                          point.orders === 0
                            ? "h-[2px] bg-brand-ink/10"
                            : isActive
                              ? "bg-gradient-to-t from-brand-pink to-[#f7a3aa] shadow-[0_8px_20px_rgba(244,137,145,0.35)]"
                              : "bg-gradient-to-t from-brand-pink/55 to-brand-pink/30 group-hover:from-brand-pink/75",
                          "group-focus-visible:ring-2 group-focus-visible:ring-brand-pink/50 group-focus-visible:ring-offset-2",
                        )}
                        style={point.orders > 0 ? { height: `${height}%` } : undefined}
                      />
                    </div>
                    <span
                      className={cn(
                        "mt-2 h-5 whitespace-nowrap text-center text-[0.62rem] font-bold leading-5",
                        isActive ? "text-brand-ink" : "text-brand-ink/45",
                        showLabel ? "" : "invisible",
                      )}
                    >
                      {point.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {totalOrders === 0 ? <p className="mt-3 text-center text-sm text-brand-ink/45">Todavia no hay pedidos en este periodo.</p> : null}
    </Card>
  );
}
