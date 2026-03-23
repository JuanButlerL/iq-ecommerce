import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type BadgeProps = {
  children: ReactNode;
  className?: string;
};

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/70 ring-1 ring-brand-ink/10",
        className,
      )}
    >
      {children}
    </span>
  );
}
