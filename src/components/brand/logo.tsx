import Image from "next/image";

import { cn } from "@/lib/utils/cn";

type LogoProps = {
  className?: string;
  inverse?: boolean;
  pink?: boolean;
};

export function IQKidsLogo({ className, inverse = false, pink = false }: LogoProps) {
  return (
    <span
      className={cn(
        "relative inline-block aspect-[1127/1290] h-24",
        !inverse && !pink && "brightness-0 saturate-100",
        pink &&
          "[filter:brightness(0)_saturate(100%)_invert(72%)_sepia(33%)_saturate(1280%)_hue-rotate(307deg)_brightness(100%)_contrast(93%)]",
        className,
      )}
      aria-label="IQ Kids"
    >
      <Image
        src="/brand/iq-kids-logo-cropped.png"
        alt="IQ Kids"
        fill
        priority
        className="object-contain object-left"
        sizes="220px"
      />
    </span>
  );
}
