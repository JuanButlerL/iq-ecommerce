export type NewsletterStatusValue = "DRAFT" | "SCHEDULED" | "SENDING" | "PAUSED" | "SENT" | "NEEDS_REVIEW";
export type NewsletterDeliveryStatusValue = "PENDING" | "RESERVED" | "SENT" | "SKIPPED" | "ERROR";

export const newsletterStatusMeta: Record<NewsletterStatusValue, { label: string; className: string; description: string }> = {
  DRAFT: { label: "Borrador", className: "bg-brand-ink/8 text-brand-ink/65", description: "Todavía no se programó ningún envío." },
  SCHEDULED: { label: "Programada", className: "bg-brand-cyan/25 text-sky-800", description: "Sale sola en la fecha elegida. Podés cancelarla hasta ese momento." },
  SENDING: { label: "Enviando", className: "bg-brand-yellow/40 text-amber-800", description: "Se está enviando por tandas. Podés pausarla en cualquier momento." },
  PAUSED: { label: "Pausada", className: "bg-orange-100 text-orange-800", description: "El envío está frenado. Nada sale hasta que la reanudes." },
  SENT: { label: "Enviada", className: "bg-green-100 text-green-800", description: "El envío terminó." },
  NEEDS_REVIEW: { label: "Requiere revisión", className: "bg-red-100 text-red-700", description: "El sistema frenó el envío por seguridad. Revisá y decidí." },
};

export const deliveryStatusMeta: Record<NewsletterDeliveryStatusValue, { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "bg-brand-ink/8 text-brand-ink/65" },
  RESERVED: { label: "A conciliar", className: "bg-orange-100 text-orange-800" },
  SENT: { label: "Enviado", className: "bg-green-100 text-green-800" },
  SKIPPED: { label: "Omitido", className: "bg-brand-ink/8 text-brand-ink/55" },
  ERROR: { label: "Error", className: "bg-red-100 text-red-700" },
};

export const reviewReasonLabels: Record<string, string> = {
  late: "El envío se atrasó más de lo permitido (por ejemplo, el servidor o la tarea programada estuvieron caídos). Revisá si todavía tiene sentido mandarla.",
  audience_grew: "La cantidad de suscriptos creció mucho desde que aprobaste el envío. Confirmá de nuevo con el número actual.",
  no_recipients: "Al momento del envío no había suscriptos pendientes.",
  invalid_snapshot: "No se pudo leer la versión congelada del mail. No se envió nada más; revisá la auditoría.",
  provider_errors: "Se pausó sola porque el proveedor de mails rechazó 3 envíos seguidos (por ejemplo, se alcanzó el cupo diario). Revisá los errores en Envíos y reanudá cuando esté resuelto.",
};

export const skipReasonLabels: Record<string, string> = {
  unsubscribed: "Se dio de baja",
  non_production: "Entorno de prueba: solo reciben las casillas internas",
  cancelled_by_admin: "Cancelado desde el admin",
};

export const auditActionLabels: Record<string, string> = {
  created: "Creó la newsletter",
  updated: "Editó el contenido",
  duplicated: "Creada como copia",
  archived: "Archivó la newsletter",
  deleted: "Eliminó la newsletter",
  visibility_changed: "Cambió la visibilidad en la web",
  test_sent: "Envió una prueba",
  scheduled: "Aprobó y programó el envío",
  schedule_cancelled: "Canceló la programación",
  moved_to_review: "El sistema frenó el envío para revisión",
  dispatch_started: "Empezó el envío",
  dispatch_finished: "Terminó el envío",
  paused: "Pausó el envío",
  resumed: "Reanudó el envío",
  remaining_cancelled: "Canceló los envíos pendientes",
  complementary_scheduled: "Programó envío a nuevos suscriptos",
  delivery_reconciled: "Concilió un envío",
};

export const ARGENTINA_UTC_OFFSET = "-03:00";

// <input type="datetime-local"> value interpreted in Argentina time.
export function argentinaLocalInputToIso(value: string) {
  // Strict format first: JS date parsing is lenient and would accept garbage.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}:00${ARGENTINA_UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isoToArgentinaLocalInput(value: Date | string) {
  const date = new Date(new Date(value).getTime() - 3 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

// "miércoles 1 de octubre de 2026, 09:00" in Buenos Aires time, whatever the browser zone.
export function formatArgentinaLongDateTime(value: Date | string) {
  return new Date(value).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    // Explicit 24h: server (Node ICU) and browsers disagree on the es-AR default.
    hourCycle: "h23",
  });
}

export function formatAdminDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    // Explicit 24h: server (Node ICU) and browsers disagree on the es-AR default.
    hourCycle: "h23",
  });
}
