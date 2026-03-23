import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/components/admin-shell";

const navigation = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/configuracion", label: "Configuracion" },
  { href: "/admin/envios", label: "Envios" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/sync", label: "Sync" },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <AdminShell navigation={navigation}>{children}</AdminShell>;
}
