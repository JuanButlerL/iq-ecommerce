import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand-pink text-white shadow-soft hover:bg-[#ea737d]",
        secondary: "bg-white text-brand-ink ring-1 ring-brand-ink/10 hover:bg-brand-peach",
        ghost: "bg-transparent text-brand-ink hover:bg-brand-pinkSoft/40",
        outline: "border border-brand-ink/10 bg-transparent text-brand-ink hover:bg-white",
      },
      size: {
        sm: "h-10 px-4",
        md: "h-12 px-6",
        lg: "h-14 px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
  ),
);

Button.displayName = "Button";
