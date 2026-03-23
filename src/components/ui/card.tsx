import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return <div className={cn("rounded-[2rem] bg-white shadow-card", className)}>{children}</div>;
}
