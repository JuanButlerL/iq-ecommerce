import Image from "next/image";

import { cn } from "@/lib/utils/cn";

type LogoProps = {
  className?: string;
  inverse?: boolean;
};

export function IQKidsLogo({ className, inverse = false }: LogoProps) {
  return (
    <span
      className={cn("relative inline-block aspect-[1127/1290] h-24", !inverse && "brightness-0 saturate-100", className)}
      aria-label="IQ Kids"
    >
      <Image src="/brand/iq-kids-logo-cropped.png" alt="IQ Kids" fill priority className="object-contain" sizes="220px" />
    </span>
  );
}
