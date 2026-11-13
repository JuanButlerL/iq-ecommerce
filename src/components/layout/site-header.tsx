"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { IQKidsLogo } from "@/components/brand/logo";
import { AnnouncementMarquee } from "@/components/layout/announcement-marquee";
import { CartBadge } from "@/features/cart/components/cart-badge";
import { CartFeedback } from "@/features/cart/components/cart-feedback";
import { cn } from "@/lib/utils/cn";

// Qué secciones de /mayoristas están visibles, para no linkear a una que se apagó desde el admin.
export type WholesaleNavVisibility = { products: boolean; faq: boolean; contact: boolean };

type SiteHeaderProps = {
  announcementBarEnabled?: boolean | null;
  announcementBarText?: string | null;
  subscriptionSectionEnabled?: boolean | null;
  faqSectionEnabled?: boolean | null;
  newsletterSectionEnabled?: boolean | null;
  // Con la sección mayorista habilitada, la tienda muestra el acceso a /mayoristas.
  wholesaleEnabled?: boolean;
  wholesaleNav?: WholesaleNavVisibility;
};

export function SiteHeader({
  announcementBarEnabled,
  announcementBarText,
  subscriptionSectionEnabled,
  faqSectionEnabled,
  newsletterSectionEnabled,
  wholesaleEnabled = false,
  wholesaleNav = { products: true, faq: true, contact: true },
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [isCompact, setIsCompact] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isHomeRoute = pathname === "/";
  const isWholesaleRoute = pathname.startsWith("/mayoristas");
  // El canal mayorista tiene su propio carrito (barra inferior): el de la tienda no aplica ahí.
  const showRetailCart = !isWholesaleRoute;
  // Cada canal tiene su menú y un acceso directo al otro.
  const homeHref = isWholesaleRoute ? "/mayoristas" : "/";
  const channelLink = isWholesaleRoute
    ? { href: "/", label: "Minoristas" }
    : wholesaleEnabled
      ? { href: "/mayoristas", label: "Mayoristas" }
      : null;
  const wholesaleNavigation = [
    { href: "/mayoristas", label: "Inicio" },
    ...(wholesaleNav.products ? [{ href: "/mayoristas#productos", label: "Productos" }] : []),
    ...(wholesaleNav.faq ? [{ href: "/mayoristas#faq", label: "Preguntas frecuentes" }] : []),
    // Sin el bloque de contacto, el acceso directo es el registro.
    wholesaleNav.contact ? { href: "/mayoristas#contacto", label: "Contacto" } : { href: "/mayoristas/registro", label: "Registrá tu negocio" },
  ];
  const retailNavigation = [
    { href: "/", label: "Inicio" },
    { href: "/productos", label: "Productos" },
    ...(faqSectionEnabled ? [{ href: "/preguntas-frecuentes", label: "Preguntas frecuentes" }] : []),
    ...(newsletterSectionEnabled ? [{ href: "/newsletter", label: "Newsletter" }] : []),
    { href: "/contacto", label: "Contacto" },
  ];
  const navigation = isWholesaleRoute ? wholesaleNavigation : retailNavigation;
  const homeNavigation = [
    { id: "inicio", label: "Inicio" },
    { id: "productos", label: "Productos" },
    { id: "quienes-somos", label: "Quiénes somos" },
    ...(subscriptionSectionEnabled ? [{ id: "suscripcion", label: "Suscripción" }] : []),
    ...(faqSectionEnabled ? [{ id: "faq", label: "Preguntas frecuentes", href: "/preguntas-frecuentes" }] : []),
    ...(newsletterSectionEnabled ? [{ id: "newsletter", label: "Newsletter", href: "/newsletter" }] : []),
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
      <CartFeedback />
      {announcementBarEnabled && announcementBarText && isHomeRoute ? (
        <AnnouncementMarquee text={announcementBarText} className="bg-brand-pink py-1.5 md:py-2" />
      ) : null}

      <div className="w-full border-b border-brand-pink/12 bg-white">
        <div
          className={cn(
            "grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 px-4 transition-all duration-300 lg:flex lg:gap-8 lg:px-8 xl:px-10",
            isCompact ? "min-h-[68px] md:min-h-[72px]" : "min-h-[86px] md:min-h-[78px]",
          )}
        >
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-pink/15 bg-white text-brand-pink lg:hidden"
            aria-label={isMenuOpen ? "Cerrar menu" : "Abrir menu"}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link
            href={homeHref}
            aria-label="IQ Kids home"
            className="mx-auto block w-fit self-center justify-self-center lg:mr-auto lg:ml-0 lg:shrink-0"
          >
            <IQKidsLogo
              pink
              className={cn("transition-all duration-300", isCompact ? "h-10 md:h-10" : "h-[3.05rem] md:h-11", "md:-ml-1")}
            />
          </Link>

          <div className="justify-self-end lg:hidden">
            {showRetailCart ? (
              <CartBadge
                className="h-10 w-10 border border-brand-pink/15 bg-white text-brand-pink shadow-none ring-0"
                countClassName="bg-brand-pink text-white"
              />
            ) : null}
          </div>

          <div className="hidden min-w-0 flex-none items-center justify-end gap-8 lg:flex xl:gap-10">
            <nav
              className={cn(
                "flex items-center gap-10 font-semibold text-brand-ink/60 transition-all duration-300",
                isCompact ? "text-sm" : "text-[15px]",
              )}
            >
              {isHomeRoute
                ? homeNavigation.map((item) => (
                    "href" in item ? (
                      <Link key={item.id} href={item.href!} className="whitespace-nowrap transition hover:text-brand-pink">{item.label}</Link>
                    ) : (
                      <button key={item.id} type="button" className="whitespace-nowrap transition hover:text-brand-pink" onClick={() => scrollToSection(item.id)}>{item.label}</button>
                    )
                  ))
                : navigation.map((item) => (
                    <Link key={item.href} href={item.href} className="whitespace-nowrap transition hover:text-brand-pink">
                      {item.label}
                    </Link>
                  ))}
            </nav>

            {channelLink ? (
              <Link
                href={channelLink.href}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-full border border-brand-pink/40 px-4 font-extrabold text-brand-pink transition hover:bg-brand-pink hover:text-white",
                  isCompact ? "h-9 text-sm" : "h-10 text-[15px]",
                )}
              >
                {channelLink.label}
              </Link>
            ) : null}

            {showRetailCart ? (
              <CartBadge
                className="h-11 w-11 border border-brand-pink/15 bg-white text-brand-pink shadow-none ring-0"
                countClassName="bg-brand-pink text-white"
              />
            ) : null}
          </div>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
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
                    "href" in item ? (
                      <Link key={item.id} href={item.href!} className="flex items-center justify-between px-4 py-4 text-left text-base font-bold text-brand-ink transition hover:bg-brand-pink/8" onClick={() => setIsMenuOpen(false)}><span>{item.label}</span><ArrowRight className="h-4 w-4" /></Link>
                    ) : (
                      <button key={item.id} type="button" className="flex items-center justify-between px-4 py-4 text-left text-base font-bold text-brand-ink transition hover:bg-brand-pink/8" onClick={() => scrollToSection(item.id)}><span>{item.label}</span><ArrowRight className="h-4 w-4" /></button>
                    )
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

            {channelLink ? (
              <Link
                href={channelLink.href}
                className="mt-6 flex items-center justify-between rounded-full border border-brand-pink/40 px-5 py-3.5 text-base font-extrabold text-brand-pink transition hover:bg-brand-pink hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                <span>Ir a {channelLink.label.toLowerCase()}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
