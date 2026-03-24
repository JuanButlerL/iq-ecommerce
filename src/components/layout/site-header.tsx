"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
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
  const pathname = usePathname();
  const [isCompact, setIsCompact] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      <Container className={cn("relative transition-all duration-300", isCompact ? "py-2 md:py-3" : "py-4 md:py-7")}>
        <div className="relative flex min-h-[72px] items-center justify-between md:block md:min-h-0">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white md:hidden"
            aria-label={isMenuOpen ? "Cerrar menu" : "Abrir menu"}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link
            href="/"
            aria-label="IQ Kids home"
            className="absolute left-1/2 top-1/2 block w-fit -translate-x-1/2 -translate-y-1/2 md:static md:mx-auto md:block md:translate-x-0 md:translate-y-0"
          >
            <IQKidsLogo inverse className={cn("transition-all duration-300", isCompact ? "h-12 md:h-16" : "h-16 md:h-28")} />
          </Link>

          <div className="md:hidden">
            <CartBadge />
          </div>
        </div>

        <nav
          className={cn(
            "mt-3 hidden items-center justify-center gap-8 font-medium text-white/95 transition-all duration-300 md:flex",
            isCompact ? "text-sm" : "text-base",
          )}
        >
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-white/70">
              {item.label}
            </Link>
          ))}
        </nav>

        {isMenuOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-brand-ink/35" onClick={() => setIsMenuOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-[86vw] max-w-[340px] border-r border-brand-ink/10 bg-white p-5 shadow-[0_24px_60px_rgba(44,34,65,0.22)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-3xl leading-none text-brand-pink">IQ Kids</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/45">Menu</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-ink/10 bg-background text-brand-ink"
                  aria-label="Cerrar menu"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="mt-8 grid gap-2">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between px-4 py-4 text-base font-bold transition",
                      pathname === item.href
                        ? "bg-brand-pink text-white shadow-soft"
                        : "text-brand-ink hover:bg-brand-pink/8",
                    )}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span>{item.label}</span>
                    {pathname === item.href ? <ArrowRight className="h-4 w-4" /> : null}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        ) : null}

        <div className={cn("absolute right-4 top-4 hidden transition-all duration-300 md:block md:right-6", isCompact ? "md:top-4" : "md:top-1/2 md:-translate-y-1/2")}>
          <CartBadge />
        </div>
      </Container>
    </header>
  );
}
