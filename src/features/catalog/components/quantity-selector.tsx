"use client";

type QuantitySelectorProps = {
  value: number;
  onChange: (value: number) => void;
};

export function QuantitySelector({ value, onChange }: QuantitySelectorProps) {
  return (
    <div className="inline-flex items-center gap-4 rounded-full border border-brand-ink/10 bg-white px-3 py-2 shadow-card">
      <button type="button" className="h-10 w-10 rounded-full border border-brand-pink/15 bg-white text-xl font-bold text-brand-ink" onClick={() => onChange(Math.max(value - 1, 1))}>
        -
      </button>
      <span className="min-w-8 text-center text-lg font-bold text-brand-ink">{value}</span>
      <button type="button" className="h-10 w-10 rounded-full border border-brand-pink/15 bg-white text-xl font-bold text-brand-ink" onClick={() => onChange(Math.min(value + 1, 99))}>
        +
      </button>
    </div>
  );
}
