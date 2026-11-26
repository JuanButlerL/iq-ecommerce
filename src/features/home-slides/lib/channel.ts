import type { SalesChannel } from "@prisma/client";

import type { AdminSectionId } from "@/lib/auth/admin-permissions";

// El mismo admin de slides sirve para la home de la tienda y para la portada de /mayoristas.
// El navegador elige el carrusel con ?canal=mayorista; sin parámetro es el de la tienda.
export const WHOLESALE_SLIDES_QUERY = "canal=mayorista";

export function slideChannelFromRequest(request: Request): SalesChannel {
  return new URL(request.url).searchParams.get("canal") === "mayorista" ? "WHOLESALE" : "RETAIL";
}

// Quien edita la landing mayorista puede editar su carrusel aunque no tenga permiso sobre la home de la tienda.
export function slideAdminSection(channel: SalesChannel): AdminSectionId {
  return channel === "WHOLESALE" ? "wholesale" : "home-carousel";
}

export function slideApiQuery(channel: SalesChannel) {
  return channel === "WHOLESALE" ? `?${WHOLESALE_SLIDES_QUERY}` : "";
}
