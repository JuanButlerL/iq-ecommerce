import type { ReactNode } from "react";
import { BadgePercent, LayoutDashboard, LayoutTemplate, MessageSquareQuote, Package, RefreshCcw, Settings, ShoppingBag, Truck, Users } from "lucide-react";

import { AdminShell } from "@/features/admin/components/admin-shell";
import { canAccessAdminSection, isPrincipalAdminEmail, type AdminSectionId } from "@/lib/auth/admin-permissions";
import { getAdminSession } from "@/lib/auth/admin";
import { env } from "@/lib/env";

const navigation = [
  { section: "dashboard", href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { section: "products", href: "/admin/productos", label: "Productos", icon: <Package className="h-4 w-4" /> },
  { section: "home-products", href: "/admin/home-productos", label: "Home productos", icon: <LayoutTemplate className="h-4 w-4" /> },
  { section: "settings", href: "/admin/configuracion", label: "Configuracion", icon: <Settings className="h-4 w-4" /> },
  { section: "coupons", href: "/admin/cupones", label: "Cupones", icon: <BadgePercent className="h-4 w-4" /> },
  { section: "testimonials", href: "/admin/testimonios", label: "Testimonios", icon: <MessageSquareQuote className="h-4 w-4" /> },
  { section: "shipping", href: "/admin/envios", label: "Envios", icon: <Truck className="h-4 w-4" /> },
  { section: "orders", href: "/admin/pedidos", label: "Pedidos", icon: <ShoppingBag className="h-4 w-4" /> },
  { section: "sync", href: "/admin/sync", label: "Sync", icon: <RefreshCcw className="h-4 w-4" /> },
  { section: "users", href: "/admin/usuarios", label: "Usuarios", icon: <Users className="h-4 w-4" /> },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await getAdminSession();
  const visibleNavigation = session
    ? navigation.filter((item) => {
        if (item.section === "users") {
          return isPrincipalAdminEmail(session.adminUser.email, env.ADMIN_LOCAL_EMAIL);
        }

        return canAccessAdminSection(session.adminUser, item.section as AdminSectionId, env.ADMIN_LOCAL_EMAIL);
      })
    : navigation;

  return <AdminShell navigation={visibleNavigation}>{children}</AdminShell>;
}
