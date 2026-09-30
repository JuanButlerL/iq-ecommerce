"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpen, CalendarClock, Check, Eye, Mail, MousePointerClick, Newspaper, Plus, Search, Settings2, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatAdminDateTime, newsletterStatusMeta, type NewsletterStatusValue } from "@/features/newsletter/components/newsletter-admin-labels";
import { NewsletterImportButton } from "@/features/newsletter/components/newsletter-import-dialog";
import { cn } from "@/lib/utils/cn";

type Stats = { total: number; pending: number; reserved: number; sent: number; skipped: number; errors: number; opened: number; clicked: number };

type AdminNewsletterRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  status: NewsletterStatusValue;
  webVisible: boolean;
  scheduledAt: string | null;
  sendingStartedAt: string | null;
  sentAt: string | null;
  publishedAt: string | null;
  reviewReason: string | null;
  archivedAt: string | null;
  updatedAt: string;
  stats: Stats;
};

type Settings = {
  sectionEnabled: boolean;
  eyebrow: string;
  title: string;
  description: string;
  senderName: string;
  fromEmail: string;
  replyToEmail: string;
  testRecipients: string[];
  dailyLimit: number;
};

type ServerFlags = { newsletterSendingEnabled: boolean; canSendEmail: boolean; isProduction: boolean; batchSize: number };

function rate(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "—";
}

export function NewsletterAdminDashboard({
  newsletters,
  audience,
  settings,
  server,
}: {
  newsletters: AdminNewsletterRow[];
  audience: { subscribed: number; unsubscribed: number; newLastMonth: number; unsubscribedLastMonth: number };
  settings: Settings;
  server: ServerFlags;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | NewsletterStatusValue | "ARCHIVED">("ALL");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(settings.testRecipients.length === 0);
  const [form, setForm] = useState({ ...settings, testRecipientsText: settings.testRecipients.join("\n") });
  const [savingSettings, setSavingSettings] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return newsletters.filter((newsletter) => {
      if (statusFilter === "ARCHIVED" ? !newsletter.archivedAt : newsletter.archivedAt) return false;
      if (statusFilter !== "ALL" && statusFilter !== "ARCHIVED" && newsletter.status !== statusFilter) return false;
      return !needle || newsletter.title.toLowerCase().includes(needle) || newsletter.slug.includes(needle);
    });
  }, [newsletters, query, statusFilter]);

  const attention = newsletters.filter((newsletter) => !newsletter.archivedAt && (newsletter.status === "NEEDS_REVIEW" || newsletter.stats.errors > 0 || newsletter.stats.reserved > 0));

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/newsletters", { method: "POST" });
      const payload = (await response.json()) as { data?: { id: string }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "No se pudo crear la newsletter.");
      router.push(`/admin/newsletter/${payload.data.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la newsletter.");
      setCreating(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSettings(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/newsletters/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionEnabled: form.sectionEnabled,
          eyebrow: form.eyebrow,
          title: form.title,
          description: form.description,
          senderName: form.senderName,
          fromEmail: form.fromEmail,
          replyToEmail: form.replyToEmail,
          testRecipients: form.testRecipientsText.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean),
          dailyLimit: Number(form.dailyLimit),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar la configuración.");
      setMessage("Configuración guardada.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la configuración.");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Comunicación</p>
          <h1 className="mt-1 font-display text-3xl text-brand-ink md:text-5xl">Newsletter</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/65 md:text-base">Armá cada edición con bloques, probala en tu casilla, programala y publicala en la web.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {settings.sectionEnabled ? (
            <Link href="/newsletter" target="_blank" className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-extrabold text-brand-pink ring-1 ring-brand-pink/25 hover:bg-brand-pink/5">
              <Eye className="h-4 w-4" /> Ver sección
            </Link>
          ) : null}
          <Link href="/admin/newsletter/guia" className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:bg-white">
            <BookOpen className="h-4 w-4" /> Cómo funciona
          </Link>
          <NewsletterImportButton existingTitles={newsletters.filter((item) => !item.archivedAt).map((item) => item.title)} />
          <Button type="button" onClick={create} disabled={creating}>
            <Plus className="mr-2 h-4 w-4" />
            {creating ? "Creando..." : "Nueva newsletter"}
          </Button>
        </div>
      </div>

      <Card className={cn("p-5 md:p-6", server.newsletterSendingEnabled ? "bg-green-50/60 ring-1 ring-green-200" : "bg-[linear-gradient(110deg,#fff2f3,#fffdfa)] ring-1 ring-brand-pink/20")}>
        <div className="flex items-start gap-4">
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm", server.newsletterSendingEnabled ? "text-green-700" : "text-brand-pink")}>
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div className="space-y-1 text-sm leading-6 text-brand-ink/70">
            <p className="font-display text-xl text-brand-ink">{server.newsletterSendingEnabled ? "Envíos reales habilitados" : "Envíos reales apagados"}</p>
            {server.newsletterSendingEnabled ? (
              <p>
                Las newsletters salen solo después de una prueba y tu confirmación. Se envían en tandas de hasta {server.batchSize} mails, con un máximo de {settings.dailyLimit} por día contando los mails automáticos.
              </p>
            ) : (
              <p>
                Podés crear, previsualizar y {server.canSendEmail ? "mandar pruebas a las casillas internas" : "revisar las newsletters"}, pero no programar envíos a suscriptos. Se habilita desde el servidor con <code className="rounded bg-white px-1.5 py-0.5 text-xs">NEWSLETTER_SENDING_ENABLED=true</code>.
              </p>
            )}
            {!server.isProduction ? <p className="font-bold text-brand-pink">Entorno de prueba: aunque se programe un envío, solo lo reciben las casillas de prueba.</p> : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Users, label: "Suscriptos activos", value: audience.subscribed, hint: `+${audience.newLastMonth} en los últimos 30 días` },
          { icon: Mail, label: "Bajas", value: audience.unsubscribed, hint: `${audience.unsubscribedLastMonth} en los últimos 30 días` },
          { icon: Newspaper, label: "Newsletters enviadas", value: newsletters.filter((item) => item.sendingStartedAt).length, hint: `${newsletters.filter((item) => item.webVisible && !item.archivedAt).length} visibles en la web` },
          { icon: CalendarClock, label: "Programadas", value: newsletters.filter((item) => item.status === "SCHEDULED").length, hint: "Salen solas en su fecha" },
        ].map((tile) => (
          <Card key={tile.label} className="p-5">
            <tile.icon className="h-5 w-5 text-brand-pink" />
            <p className="mt-3 text-3xl font-extrabold text-brand-ink">{tile.value}</p>
            <p className="text-sm font-bold text-brand-ink/70">{tile.label}</p>
            <p className="mt-1 text-xs text-brand-ink/45">{tile.hint}</p>
          </Card>
        ))}
      </div>

      {attention.length > 0 ? (
        <Card className="border border-red-200 bg-red-50/70 p-5">
          <p className="flex items-center gap-2 font-bold text-red-700">
            <AlertTriangle className="h-5 w-5" /> Necesitan tu atención
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {attention.map((newsletter) => (
              <li key={newsletter.id}>
                <Link href={`/admin/newsletter/${newsletter.id}`} className="font-bold text-brand-ink underline-offset-4 hover:underline">
                  {newsletter.title}
                </Link>
                <span className="text-brand-ink/60">
                  {" — "}
                  {newsletter.status === "NEEDS_REVIEW" ? "envío frenado para revisión" : null}
                  {newsletter.stats.errors > 0 ? ` ${newsletter.stats.errors} con error` : null}
                  {newsletter.stats.reserved > 0 ? ` ${newsletter.stats.reserved} a conciliar` : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
      {message ? <p role="status" className="inline-flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700"><Check className="h-4 w-4" />{message}</p> : null}

      <Card className="p-5 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Ediciones</p>
            <h2 className="mt-1 font-display text-2xl">Todas las newsletters</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink/35" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título" className="pl-10" />
            </label>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filtrar por estado">
              <option value="ALL">Todas las activas</option>
              {(Object.keys(newsletterStatusMeta) as NewsletterStatusValue[]).map((status) => (
                <option key={status} value={status}>
                  {newsletterStatusMeta[status].label}
                </option>
              ))}
              <option value="ARCHIVED">Archivadas</option>
            </Select>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-brand-pink/30 bg-brand-pink/5 p-8 text-center">
              <Newspaper className="mx-auto h-9 w-9 text-brand-pink" />
              <p className="mt-3 font-bold">{newsletters.length === 0 ? "Todavía no hay newsletters" : "No hay resultados con ese filtro"}</p>
              {newsletters.length === 0 ? <p className="mt-1 text-sm text-brand-ink/60">Creá la primera con el botón “Nueva newsletter”.</p> : null}
            </div>
          ) : (
            filtered.map((newsletter) => {
              const meta = newsletterStatusMeta[newsletter.status];
              const dateLabel =
                newsletter.status === "SCHEDULED"
                  ? `Programada: ${formatAdminDateTime(newsletter.scheduledAt)}`
                  : newsletter.sentAt
                    ? `Enviada: ${formatAdminDateTime(newsletter.sentAt)}`
                    : `Editada: ${formatAdminDateTime(newsletter.updatedAt)}`;

              return (
                <Link
                  key={newsletter.id}
                  href={`/admin/newsletter/${newsletter.id}`}
                  className="grid gap-4 rounded-[1.5rem] border border-brand-ink/10 bg-white p-4 transition hover:border-brand-pink/40 hover:shadow-card sm:grid-cols-[120px_1fr] lg:grid-cols-[120px_1fr_auto]"
                >
                  {newsletter.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={newsletter.coverImageUrl} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover" />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-brand-pinkSoft/35">
                      <Newspaper className="h-6 w-6 text-brand-pink" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em]">
                      <span className={cn("rounded-full px-2.5 py-1", newsletter.archivedAt ? "bg-brand-ink/10 text-brand-ink/55" : meta.className)}>{newsletter.archivedAt ? "Archivada" : meta.label}</span>
                      <span className={cn("rounded-full px-2.5 py-1", newsletter.webVisible ? "bg-brand-pink/12 text-brand-pink" : "bg-brand-ink/5 text-brand-ink/45")}>{newsletter.webVisible ? "En la web" : "Oculta en la web"}</span>
                    </div>
                    <p className="mt-2 truncate font-bold text-brand-ink">{newsletter.title}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-brand-ink/55">{newsletter.excerpt || "Sin resumen todavía"}</p>
                    <p className="mt-2 text-xs font-bold text-brand-ink/45">{dateLabel}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs sm:col-span-2 lg:col-span-1 lg:w-[340px]">
                    {[
                      { label: "Enviados", value: newsletter.stats.sent },
                      { label: "Aperturas", value: rate(newsletter.stats.opened, newsletter.stats.sent) },
                      { label: "Clicks", value: rate(newsletter.stats.clicked, newsletter.stats.sent) },
                      { label: "Errores", value: newsletter.stats.errors + newsletter.stats.reserved },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-2xl bg-brand-ink/[0.03] px-2 py-2.5">
                        <p className="text-base font-extrabold text-brand-ink">{metric.value}</p>
                        <p className="text-brand-ink/50">{metric.label}</p>
                      </div>
                    ))}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </Card>

      <Card className="p-5 md:p-7">
        <button type="button" onClick={() => setShowSettings((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
          <span>
            <span className="block text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Configuración</span>
            <span className="mt-1 flex items-center gap-2 font-display text-2xl">
              <Settings2 className="h-5 w-5" /> Remitente, pruebas y sección web
            </span>
          </span>
          <span className="text-sm font-bold text-brand-pink">{showSettings ? "Ocultar" : "Editar"}</span>
        </button>

        {showSettings ? (
          <form onSubmit={saveSettings} className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="rounded-[1.5rem] bg-brand-ink/[0.03] p-5 lg:col-span-2">
              <Checkbox
                label="Mostrar la sección Newsletter en el menú y en la web"
                checked={form.sectionEnabled}
                onChange={(event) => setForm((current) => ({ ...current, sectionEnabled: event.target.checked }))}
              />
              <p className="mt-2 pl-7 text-xs leading-5 text-brand-ink/55">Necesita al menos una newsletter marcada como visible. Apagada, la página /newsletter no existe para el público.</p>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Nombre del remitente</span>
              <Input value={form.senderName} onChange={(event) => setForm((current) => ({ ...current, senderName: event.target.value }))} maxLength={60} required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Casilla del remitente</span>
              <Input type="email" value={form.fromEmail} onChange={(event) => setForm((current) => ({ ...current, fromEmail: event.target.value }))} required />
              <span className="mt-1 block text-xs text-brand-ink/50">Tiene que ser del dominio verificado en el proveedor de mails.</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Responder a (opcional)</span>
              <Input type="email" value={form.replyToEmail} onChange={(event) => setForm((current) => ({ ...current, replyToEmail: event.target.value }))} placeholder="Si alguien responde el mail, llega acá" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Máximo de mails por día</span>
              <Input type="number" min={1} max={5000} value={form.dailyLimit} onChange={(event) => setForm((current) => ({ ...current, dailyLimit: Number(event.target.value) }))} required />
              <span className="mt-1 block text-xs text-brand-ink/50">Incluye los mails automáticos. El plan gratuito de Resend permite 100 por día: dejá margen para los mails de pedidos.</span>
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-2 block text-sm font-bold">Casillas de prueba (hasta 5)</span>
              <Textarea rows={3} value={form.testRecipientsText} onChange={(event) => setForm((current) => ({ ...current, testRecipientsText: event.target.value }))} placeholder={"vos@iqkids.com.ar\notra@iqkids.com.ar"} />
              <span className="mt-1 block text-xs text-brand-ink/50">Una por línea. Reciben las pruebas antes de cada envío y, fuera de producción, son las únicas que reciben envíos reales.</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Texto superior de la página</span>
              <Input value={form.eyebrow} onChange={(event) => setForm((current) => ({ ...current, eyebrow: event.target.value }))} maxLength={80} placeholder="Newsletter IQ Kids" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Título de la página</span>
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={120} placeholder="Ideas simples para la semana" />
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-2 block text-sm font-bold">Descripción de la página</span>
              <Textarea rows={2} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={400} />
            </label>
            <div className="lg:col-span-2">
              <Button type="submit" disabled={savingSettings} className="w-full sm:w-auto">
                {savingSettings ? "Guardando..." : "Guardar configuración"}
              </Button>
            </div>
          </form>
        ) : null}
      </Card>

      <p className="flex items-center gap-2 text-xs text-brand-ink/45">
        <MousePointerClick className="h-3.5 w-3.5" /> Aperturas y clicks son aproximados: algunos clientes de mail bloquean imágenes o abren los links automáticamente.
      </p>
    </div>
  );
}
