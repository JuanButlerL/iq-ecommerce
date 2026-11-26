"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent } from "react";

import { cn } from "@/lib/utils/cn";

import { type SlideButton } from "@/features/home-slides/lib/slide-button";

export { DEFAULT_SLIDE_BUTTON, parseSlideButton, type SlideButton } from "@/features/home-slides/lib/slide-button";

// Tamaño 1..10 → letra en % del ancho de la imagen (cqw). En celular la imagen es más angosta: más grande.
function fontSize(size: number, mobile: boolean) {
  const cqw = mobile ? 2.4 + size * 0.75 : 0.9 + size * 0.32;
  return `max(11px, ${cqw.toFixed(2)}cqw)`;
}

export function BannerButton({
  button,
  mobile,
  interactive = true,
}: {
  button: SlideButton;
  mobile: boolean;
  interactive?: boolean;
}) {
  const x = mobile ? button.mobileX : button.x;
  const y = mobile ? button.mobileY : button.y;
  const style: CSSProperties = {
    left: `${x}%`,
    top: `${y}%`,
    fontSize: fontSize(mobile ? button.mobileSize : button.size, mobile),
    color: button.textColor,
    backgroundColor: button.outline ? "transparent" : button.bgColor,
    borderColor: button.outline ? button.textColor : button.bgColor,
  };
  const className = cn(
    "absolute z-[2] inline-flex -translate-x-1/2 -translate-y-1/2 items-center justify-center whitespace-pre-line border-[0.12em] px-[1.3em] py-[0.45em] text-center font-display font-extrabold leading-[1.05] tracking-wide shadow-[0_0.3em_0.8em_rgba(0,0,0,0.18)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60",
    button.shape === "pill" ? "rounded-full" : "rounded-[0.45em]",
  );

  if (!interactive) {
    return (
      <span className={cn(className, "pointer-events-none")} style={style}>
        {button.label}
      </span>
    );
  }
  return (
    <Link href={button.url} className={className} style={style}>
      {button.label}
    </Link>
  );
}

// La imagen completa (sin recortes) con su botón. El contenedor mide el ancho para escalar el botón.
export function BannerFrame({
  imageUrl,
  alt,
  button,
  href,
  mobile,
  eager,
  interactive = true,
  onPick,
  className,
}: {
  imageUrl: string;
  alt: string;
  button: SlideButton | null;
  href?: string | null;
  mobile: boolean;
  eager?: boolean;
  interactive?: boolean;
  // Admin: clic sobre la imagen para ubicar el botón (devuelve % horizontal y vertical).
  onPick?: (x: number, y: number) => void;
  className?: string;
}) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!onPick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onPick(
      Math.round(((event.clientX - rect.left) / rect.width) * 100),
      Math.round(((event.clientY - rect.top) / rect.height) * 100),
    );
  }

  return (
    <div
      className={cn("relative w-full [container-type:inline-size]", onPick && "cursor-crosshair", className)}
      onClick={onPick ? handleClick : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        className="block h-auto w-full select-none"
        draggable={false}
      />
      {button ? (
        <BannerButton button={button} mobile={mobile} interactive={interactive} />
      ) : href && interactive ? (
        <Link href={href} aria-label={alt || "Ver más"} className="absolute inset-0 z-[1]" />
      ) : null}
    </div>
  );
}
