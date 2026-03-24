import type { ReactNode } from "react";
import { LayoutDashboard, Package, RefreshCcw, Settings, ShoppingBag, Truck } from "lucide-react";

import { AdminShell } from "@/features/admin/components/admin-shell";

const navigation = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/productos", label: "Productos", icon: <Package className="h-4 w-4" /> },
  { href: "/admin/configuracion", label: "Configuracion", icon: <Settings className="h-4 w-4" /> },
  { href: "/admin/envios", label: "Envios", icon: <Truck className="h-4 w-4" /> },
  { href: "/admin/pedidos", label: "Pedidos", icon: <ShoppingBag className="h-4 w-4" /> },
  { href: "/admin/sync", label: "Sync", icon: <RefreshCcw className="h-4 w-4" /> },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <AdminShell navigation={navigation}>{children}</AdminShell>;
}
