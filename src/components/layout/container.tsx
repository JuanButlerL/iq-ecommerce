import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

export function Container({ children, className }: ContainerProps) {
  return <div className={cn("mx-auto w-full max-w-[1600px] px-4 md:px-6 xl:px-10", className)}>{children}</div>;
}
