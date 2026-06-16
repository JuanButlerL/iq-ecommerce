"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { IQKidsLogo } from "@/components/brand/logo";
import { CartBadge } from "@/features/cart/components/cart-badge";
import { cn } from "@/lib/utils/cn";

const navigation = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/contacto", label: "Contacto" },
];

type SiteHeaderProps = {
  announcementBarEnabled?: boolean | null;
  announcementBarText?: string | null;
  subscriptionSectionEnabled?: boolean | null;
};

export function SiteHeader({
  announcementBarEnabled,
  announcementBarText,
  subscriptionSectionEnabled,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [isCompact, setIsCompact] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isHomeRoute = pathname === "/";
  const homeNavigation = [
    { id: "inicio", label: "Inicio" },
    { id: "productos", label: "Productos" },
    { id: "quienes-somos", label: "Quiénes somos" },
    ...(subscriptionSectionEnabled ? [{ id: "suscripcion", label: "Suscripción" }] : []),
    { id: "contacto", label: "Contacto" },
  ];

  useEffect(() => {
    const compactAt = 96;
    const expandAt = 8;

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

  const scrollToSection = (sectionId: string) => {
    const section = window.document.getElementById(sectionId);

    if (!section) {
      return;
    }

    section.scrollIntoView({ behavior: "smooth", block: "start" });
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 transition-all duration-300">
      {announcementBarEnabled && announcementBarText && isHomeRoute ? (
        <div className="overflow-hidden bg-brand-pink py-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-white md:py-2 md:text-[11px] md:tracking-[0.16em]">
          <div className="flex w-max min-w-full animate-[marquee_26s_linear_infinite] whitespace-nowrap">
            {Array.from({ length: 10 }).map((_, index) => (
              <span key={index} className="inline-flex items-center px-6 md:px-10">
                {announcementBarText}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="w-full border-b border-brand-pink/12 bg-white">
        <div
          className={cn(
            "grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 px-4 transition-all duration-300 md:flex md:gap-8 md:px-8 xl:px-10",
            isCompact ? "min-h-[68px] md:min-h-[72px]" : "min-h-[86px] md:min-h-[78px]",
          )}
        >
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-pink/15 bg-white text-brand-pink md:hidden"
            aria-label={isMenuOpen ? "Cerrar menu" : "Abrir menu"}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link
            href="/"
            aria-label="IQ Kids home"
            className="mx-auto block w-fit self-center justify-self-center md:mr-auto md:ml-0 md:shrink-0"
          >
            <IQKidsLogo
              pink
              className={cn("transition-all duration-300", isCompact ? "h-10 md:h-10" : "h-[3.05rem] md:h-11", "md:-ml-1")}
            />
          </Link>

          <div className="justify-self-end md:hidden">
            <CartBadge
              className="h-10 w-10 border border-brand-pink/15 bg-white text-brand-pink shadow-none ring-0"
              countClassName="bg-brand-pink text-white"
            />
          </div>

          <div className="hidden min-w-0 flex-none items-center justify-end gap-10 md:flex">
            <nav
              className={cn(
                "flex items-center gap-10 font-semibold text-brand-ink/60 transition-all duration-300",
                isCompact ? "text-sm" : "text-[15px]",
              )}
            >
              {isHomeRoute
                ? homeNavigation.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="whitespace-nowrap transition hover:text-brand-pink"
                      onClick={() => scrollToSection(item.id)}
                    >
                      {item.label}
                    </button>
                  ))
                : navigation.map((item) => (
                    <Link key={item.href} href={item.href} className="whitespace-nowrap transition hover:text-brand-pink">
                      {item.label}
                    </Link>
                  ))}
            </nav>

            <CartBadge
              className="h-11 w-11 border border-brand-pink/15 bg-white text-brand-pink shadow-none ring-0"
              countClassName="bg-brand-pink text-white"
            />
          </div>
        </div>
      </div>

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
              {isHomeRoute
                ? homeNavigation.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="flex items-center justify-between px-4 py-4 text-left text-base font-bold text-brand-ink transition hover:bg-brand-pink/8"
                      onClick={() => scrollToSection(item.id)}
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ))
                : navigation.map((item) => (
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
    </header>
  );
}
