import type { ReactNode } from "react";

type FieldShellProps = {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

export function FieldShell({ label, error, className, children }: FieldShellProps) {
  return (
    <label
      className={`block space-y-2 ${
        error ? "[&_input]:border-red-400 [&_input]:bg-red-50/30 [&_select]:border-red-400 [&_select]:bg-red-50/30" : ""
      } ${className ?? ""}`}
    >
      <span className={`text-xs font-extrabold uppercase tracking-[0.16em] ${error ? "text-red-600" : "text-brand-ink/55"}`}>
        {label}
      </span>
      {children}
      <p className={`min-h-4 text-[11px] font-semibold leading-4 ${error ? "text-red-600" : "text-transparent"}`}>
        {error}
      </p>
    </label>
  );
}
