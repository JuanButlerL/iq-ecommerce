"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Menu, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { AdminSignOutButton } from "@/features/admin/components/admin-signout-button";
import { cn } from "@/lib/utils/cn";

type NavigationItem = {
  group: string;
  href: string;
  label: string;
  icon: ReactNode;
  prefetch?: boolean;
};

type AdminShellProps = {
  children: ReactNode;
  navigation: NavigationItem[];
};

const COLLAPSED_GROUPS_STORAGE_KEY = "iqkids-admin-collapsed-groups";

function groupNavigation(navigation: NavigationItem[]) {
  const groups: { name: string; items: NavigationItem[] }[] = [];

  for (const item of navigation) {
    const group = groups.find((entry) => entry.name === item.group);

    if (group) {
      group.items.push(item);
    } else {
      groups.push({ name: item.group, items: [item] });
    }
  }

  return groups;
}

export function AdminShell({ children, navigation }: AdminShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const isLoginRoute = pathname === "/admin/login";
  const groups = useMemo(() => groupNavigation(navigation), [navigation]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY) ?? "[]");
      if (Array.isArray(stored)) {
        setCollapsedGroups(stored.filter((name): name is string => typeof name === "string"));
      }
    } catch {
      // Storage unavailable: every group starts expanded.
    }
  }, []);

  function updateCollapsedGroups(update: (current: string[]) => string[]) {
    setCollapsedGroups((current) => {
      const next = update(current);

      if (next === current) {
        return current;
      }

      try {
        window.localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Not persisted; the toggle still works for this visit.
      }

      return next;
    });
  }

  function toggleGroup(name: string) {
    updateCollapsedGroups((current) =>
      current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name],
    );
  }

  // Navigating into a collapsed group opens it, so the current page is always listed.
  useEffect(() => {
    const activeGroup = navigation.find((item) => item.href === pathname)?.group;

    if (activeGroup) {
      updateCollapsedGroups((current) =>
        current.includes(activeGroup) ? current.filter((entry) => entry !== activeGroup) : current,
      );
    }
  }, [navigation, pathname]);

  function renderNavigation(variant: "mobile" | "desktop") {
    const iconsOnly = variant === "desktop" && isDesktopCollapsed;

    return groups.map((group, groupIndex) => {
      const isExpanded = iconsOnly || !collapsedGroups.includes(group.name);
      const listId = `admin-nav-${variant}-${groupIndex}`;

      return (
        <div key={group.name} className={cn(groupIndex > 0 && (iconsOnly ? "mt-3 border-t border-brand-ink/10 pt-3" : "mt-4"))}>
          {iconsOnly ? null : (
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={listId}
              onClick={() => toggleGroup(group.name)}
              className="flex w-full items-center justify-between rounded-xl px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-ink/45 transition hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/40"
            >
              {group.name}
              <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform", !isExpanded && "-rotate-90")} />
            </button>
          )}

          {isExpanded ? (
            <div id={listId} className="mt-1 space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={item.prefetch}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold transition",
                      isActive
                        ? "bg-brand-pink text-white shadow-soft"
                        : variant === "mobile"
                          ? "bg-brand-pink/6 text-brand-ink hover:bg-brand-pink/12"
                          : "text-brand-ink hover:bg-brand-pink/8",
                      iconsOnly && "justify-center px-3",
                    )}
                    title={item.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span aria-hidden="true" className="shrink-0">
                      {item.icon}
                    </span>
                    <span className={cn(iconsOnly && "sr-only")}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    });
  }

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Keep the active section visible when the desktop menu is scrolled.
  useEffect(() => {
    document.querySelector('aside nav [aria-current="page"]')?.scrollIntoView({ block: "nearest" });
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

            <nav className="mt-6">{renderNavigation("mobile")}</nav>

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

            <nav className="-mx-2 mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1 [scrollbar-width:thin]">
              {renderNavigation("desktop")}
            </nav>

            <div className="shrink-0 border-t border-brand-ink/10 pt-5">
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
