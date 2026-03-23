"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { IQKidsLogo } from "@/components/brand/logo";
import { CartBadge } from "@/features/cart/components/cart-badge";
import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils/cn";

const navigation = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/contacto", label: "Contacto" },
];

export function SiteHeader() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const compactAt = 96;
    const expandAt = 48;

    const handleScroll = () => {
      const currentScroll = window.scrollY;

      setIsCompact((previous) => {
        if (!previous && currentScroll > compactAt) {
          return true;
        }

        if (previous && currentScroll < expandAt) {
          return false;
        }

        return previous;
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-white/20 bg-brand-pink text-white shadow-soft transition-all duration-300">
      <Container
        className={cn(
          "relative flex flex-col items-center gap-2 transition-all duration-300",
          isCompact ? "py-2 md:gap-2 md:py-3" : "py-4 md:gap-4 md:py-7",
        )}
      >
        <Link href="/" aria-label="IQ Kids home">
          <IQKidsLogo inverse className={cn("transition-all duration-300", isCompact ? "h-12 md:h-16" : "h-16 md:h-28")} />
        </Link>
        <nav
          className={cn(
            "flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-medium text-white/95 transition-all duration-300",
            isCompact ? "text-xs md:gap-8 md:text-sm" : "text-sm md:gap-10 md:text-base",
          )}
        >
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-white/70">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={cn("absolute right-4 transition-all duration-300 md:right-6", isCompact ? "top-3 md:top-4" : "top-4 md:top-1/2 md:-translate-y-1/2")}>
          <CartBadge />
        </div>
      </Container>
    </header>
  );
}
