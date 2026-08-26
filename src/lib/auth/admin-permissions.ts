import type { AdminUser } from "@prisma/client";

export const ADMIN_SECTIONS = [
  { id: "dashboard", label: "Dashboard", href: "/admin" },
  { id: "products", label: "Productos", href: "/admin/productos" },
  { id: "home-products", label: "Home productos", href: "/admin/home-productos" },
  { id: "settings", label: "Configuracion", href: "/admin/configuracion" },
  { id: "coupons", label: "Cupones", href: "/admin/cupones" },
  { id: "testimonials", label: "Testimonios", href: "/admin/testimonios" },
  { id: "shipping", label: "Envios", href: "/admin/envios" },
  { id: "orders", label: "Pedidos", href: "/admin/pedidos" },
  { id: "emails", label: "Emails", href: "/admin/emails" },
  { id: "links", label: "Links", href: "/admin/links" },
  { id: "sync", label: "Sync", href: "/admin/sync" },
  { id: "users", label: "Usuarios", href: "/admin/usuarios" },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];

const sectionIds = new Set<string>(ADMIN_SECTIONS.map((section) => section.id));

export function normalizeAdminSections(value: unknown): AdminSectionId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((section): section is AdminSectionId => typeof section === "string" && sectionIds.has(section));
}

export function isPrincipalAdminEmail(email?: string | null, principalEmail?: string | null) {
  return Boolean(email && principalEmail && email.toLowerCase() === principalEmail.toLowerCase());
}

export function canAccessAdminSection(
  adminUser: Pick<AdminUser, "email" | "role" | "allowedSections">,
  section: AdminSectionId,
  principalEmail?: string | null,
) {
  if (isPrincipalAdminEmail(adminUser.email, principalEmail)) {
    return true;
  }

  if (adminUser.role === "SUPER_ADMIN") {
    return true;
  }

  return normalizeAdminSections(adminUser.allowedSections).includes(section);
}

export function getFirstAccessibleAdminHref(
  adminUser: Pick<AdminUser, "email" | "role" | "allowedSections">,
  principalEmail?: string | null,
) {
  return ADMIN_SECTIONS.find((section) => canAccessAdminSection(adminUser, section.id, principalEmail))?.href ?? "/admin/login";
}
