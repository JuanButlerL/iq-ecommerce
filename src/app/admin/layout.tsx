import type { ReactNode } from "react";
import { BadgePercent, BarChart3, CircleHelp, ClipboardList, GalleryHorizontalEnd, Inbox, LayoutDashboard, LayoutTemplate, Link2, Mail, MessageCircle, MessageSquareQuote, Newspaper, Package, Receipt, RefreshCcw, Settings, ShoppingBag, Store, Tag, Truck, Users } from "lucide-react";

import { AdminShell } from "@/features/admin/components/admin-shell";
import { canAccessAdminSection, isPrincipalAdminEmail, type AdminSectionId } from "@/lib/auth/admin-permissions";
import { getAdminSession } from "@/lib/auth/admin";
import { env } from "@/lib/env";

const navigation = [
  { group: "Ventas", section: "dashboard", href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, prefetch: false },
  { group: "Ventas", section: "orders", href: "/admin/pedidos", label: "Pedidos", icon: <ShoppingBag className="h-4 w-4" />, prefetch: false },
  { group: "Tienda", section: "products", href: "/admin/productos", label: "Productos", icon: <Package className="h-4 w-4" /> },
  { group: "Tienda", section: "discounts", href: "/admin/descuentos", label: "Descuentos", icon: <Tag className="h-4 w-4" /> },
  { group: "Tienda", section: "coupons", href: "/admin/cupones", label: "Cupones", icon: <BadgePercent className="h-4 w-4" /> },
  { group: "Tienda", section: "shipping", href: "/admin/envios", label: "Envios", icon: <Truck className="h-4 w-4" /> },
  { group: "Home y contenido", section: "home-carousel", href: "/admin/home-carrusel", label: "Home carrusel", icon: <GalleryHorizontalEnd className="h-4 w-4" /> },
  { group: "Home y contenido", section: "home-products", href: "/admin/home-productos", label: "Home productos", icon: <LayoutTemplate className="h-4 w-4" /> },
  { group: "Home y contenido", section: "testimonials", href: "/admin/testimonios", label: "Testimonios", icon: <MessageSquareQuote className="h-4 w-4" /> },
  { group: "Home y contenido", section: "faq", href: "/admin/preguntas-frecuentes", label: "Preguntas frecuentes", icon: <CircleHelp className="h-4 w-4" /> },
  { group: "Mayoristas", section: "wholesale", href: "/admin/mayoristas/consultas", label: "Consultas", icon: <Inbox className="h-4 w-4" />, prefetch: false },
  { group: "Mayoristas", section: "wholesale", href: "/admin/mayoristas", label: "General", icon: <Store className="h-4 w-4" /> },
  { group: "Mayoristas", section: "wholesale", href: "/admin/mayoristas/productos", label: "Productos", icon: <Package className="h-4 w-4" /> },
  { group: "Mayoristas", section: "wholesale", href: "/admin/mayoristas/contenido", label: "Contenido", icon: <LayoutTemplate className="h-4 w-4" /> },
  { group: "Mayoristas", section: "wholesale", href: "/admin/mayoristas/condiciones", label: "Condiciones y precios", icon: <Receipt className="h-4 w-4" /> },
  { group: "Mayoristas", section: "wholesale", href: "/admin/mayoristas/pedido", label: "Formulario y pedido", icon: <ClipboardList className="h-4 w-4" /> },
  { group: "Mayoristas", section: "wholesale", href: "/admin/mayoristas/testimonios", label: "Testimonios", icon: <MessageSquareQuote className="h-4 w-4" /> },
  { group: "Mayoristas", section: "wholesale", href: "/admin/mayoristas/preguntas-frecuentes", label: "Preguntas frecuentes", icon: <CircleHelp className="h-4 w-4" /> },
  { group: "Marketing", section: "marketing", href: "/admin/marketing", label: "Marketing", icon: <BarChart3 className="h-4 w-4" />, prefetch: false },
  { group: "Marketing", section: "emails", href: "/admin/emails", label: "Emails", icon: <Mail className="h-4 w-4" />, prefetch: false },
  { group: "Marketing", section: "newsletter", href: "/admin/newsletter", label: "Newsletter", icon: <Newspaper className="h-4 w-4" />, prefetch: false },
  { group: "Marketing", section: "links", href: "/admin/links", label: "Links", icon: <Link2 className="h-4 w-4" /> },
  { group: "Sistema", section: "settings", href: "/admin/configuracion", label: "Configuracion", icon: <Settings className="h-4 w-4" /> },
  { group: "Sistema", section: "users", href: "/admin/usuarios", label: "Usuarios", icon: <Users className="h-4 w-4" /> },
  { group: "Sistema", section: "whatsapp", href: "/admin/whatsapp", label: "WhatsApp", icon: <MessageCircle className="h-4 w-4" />, prefetch: false },
  { group: "Sistema", section: "sync", href: "/admin/sync", label: "Sync", icon: <RefreshCcw className="h-4 w-4" /> },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await getAdminSession();
  const visibleNavigation = session
    ? navigation.filter((item) => {
        if (item.section === "users" || item.section === "whatsapp") {
          return isPrincipalAdminEmail(session.adminUser.email, env.ADMIN_LOCAL_EMAIL);
        }

        return canAccessAdminSection(session.adminUser, item.section as AdminSectionId, env.ADMIN_LOCAL_EMAIL);
      })
    : navigation;

  return <AdminShell navigation={visibleNavigation}>{children}</AdminShell>;
}
