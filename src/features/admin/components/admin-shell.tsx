"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { AdminSignOutButton } from "@/features/admin/components/admin-signout-button";
import { cn } from "@/lib/utils/cn";

type NavigationItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

type AdminShellProps = {
  children: ReactNode;
  navigation: NavigationItem[];
};

export function AdminShell({ children, navigation }: AdminShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const isLoginRoute = pathname === "/admin/login";

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  if (isLoginRoute) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,137,145,0.18),_transparent_42%),linear-gradient(180deg,_#fff8f8_0%,_#ffffff_100%)]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-brand-ink/10 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-display text-2xl leading-none text-brand-pink">IQ Kids</p>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/45">Panel admin</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-11 w-11 rounded-2xl px-0"
            aria-label={isMenuOpen ? "Cerrar menu" : "Abrir menu"}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-brand-ink/35 lg:hidden" onClick={() => setIsMenuOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-[88vw] max-w-[340px] overflow-y-auto border-l border-brand-ink/10 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-3xl text-brand-pink">IQ Kids</p>
                <p className="text-sm text-brand-ink/55">Panel admin</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 w-10 rounded-2xl px-0"
                onClick={() => setIsMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="mt-6 space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition",
                      isActive ? "bg-brand-pink text-white shadow-soft" : "bg-brand-pink/6 text-brand-ink hover:bg-brand-pink/12",
                    )}
                  >
                    <span aria-hidden="true" className="shrink-0">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6">
              <AdminSignOutButton className="w-full justify-center" />
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "mx-auto grid min-h-screen max-w-[1600px]",
          isDesktopCollapsed ? "lg:grid-cols-[92px_minmax(0,1fr)]" : "lg:grid-cols-[280px_minmax(0,1fr)]",
        )}
      >
        <aside className="hidden border-r border-brand-ink/10 bg-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col px-6 py-7">
            <div className="flex items-start justify-between gap-3">
              <div className={cn(isDesktopCollapsed && "sr-only")}>
                <p className="font-display text-4xl leading-none text-brand-pink">IQ Kids</p>
                <p className="mt-2 text-sm font-semibold text-brand-ink/55">Panel admin</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 w-10 rounded-2xl px-0"
                onClick={() => setIsDesktopCollapsed((current) => !current)}
              >
                {isDesktopCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </Button>
            </div>

            <nav className="mt-8 space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition",
                      isActive ? "bg-brand-pink text-white shadow-soft" : "text-brand-ink hover:bg-brand-pink/8",
                      isDesktopCollapsed && "justify-center px-3",
                    )}
                    title={item.label}
                  >
                    <span aria-hidden="true" className="shrink-0">
                      {item.icon}
                    </span>
                    <span className={cn(isDesktopCollapsed && "sr-only")}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto pt-6">
              <AdminSignOutButton className={cn("w-full justify-center", isDesktopCollapsed && "px-0")} title="Cerrar sesión">
                <span className={cn(isDesktopCollapsed && "sr-only")}>Cerrar sesión</span>
                {isDesktopCollapsed ? <LogOut aria-hidden="true" className="h-4 w-4" /> : null}
              </AdminSignOutButton>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
