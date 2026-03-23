import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Checkbox({ className, label, ...props }: CheckboxProps) {
  return (
    <label className={cn("flex items-start gap-3 text-sm text-brand-ink", className)}>
      <input type="checkbox" className="mt-1 h-4 w-4 rounded border-brand-ink/20 accent-brand-pink" {...props} />
      <span>{label}</span>
    </label>
  );
}
