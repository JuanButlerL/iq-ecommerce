import * as React from "react";

import { cn } from "@/lib/utils/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-28 w-full rounded-3xl border border-brand-ink/10 bg-white px-4 py-3 text-sm text-brand-ink outline-none transition placeholder:text-brand-ink/40 focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
