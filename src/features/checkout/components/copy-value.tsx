"use client";

import { Copy } from "lucide-react";

type CopyValueProps = {
  label: string;
  value: string;
  copyable?: boolean;
};

export function CopyValue({ label, value, copyable = false }: CopyValueProps) {
  return (
    <div className="rounded-[1.5rem] bg-white p-4 shadow-card">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/50">{label}</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="min-w-0 break-all font-bold text-brand-ink sm:break-normal">{value}</p>
        {copyable ? (
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-pink/15 bg-white text-brand-pink"
            onClick={() => navigator.clipboard.writeText(value)}
          >
            <Copy className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
