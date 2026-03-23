import * as React from "react";

import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition placeholder:text-brand-ink/40 focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
