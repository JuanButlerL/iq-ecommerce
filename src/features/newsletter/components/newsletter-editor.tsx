"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Eye,
  EyeOff,
  FlaskConical,
  Link2,
  ListChecks,
  Pause,
  Play,
  Plus,
  Save,
  Send,
  Users,
  Wand2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatAdminDateTime, formatArgentinaLongDateTime, newsletterStatusMeta, reviewReasonLabels, type NewsletterStatusValue } from "@/features/newsletter/components/newsletter-admin-labels";
import { NewsletterBlockEditor, duplicateBlock, type NewsletterTestimonialOption } from "@/features/newsletter/components/newsletter-block-editor";
import { NewsletterImageField } from "@/features/newsletter/components/newsletter-image-field";
import { NewsletterPreview } from "@/features/newsletter/components/newsletter-preview";
import { NewsletterSendDialog, type SendDialogMode } from "@/features/newsletter/components/newsletter-send-dialog";
import {
  NEWSLETTER_BLOCK_LABELS,
  computeNewsletterContentHash,
  createEmptyBlock,
  getNewsletterChecklist,
  slugifyNewsletter,
  type NewsletterBlock,
  type NewsletterBlockType,
  type NewsletterContent,
  type NewsletterProductSummary,
} from "@/features/newsletter/content";
import { cn } from "@/lib/utils/cn";

type Stats = { total: number; pending: number; reserved: number; sent: number; skipped: number; errors: number; opened: number; clicked: number };

type EditorNewsletter = {
  id: string;
  content: NewsletterContent;
  internalNotes: string | null;
  status: NewsletterStatusValue;
  webVisible: boolean;
  archived: boolean;
  scheduledAt: string | null;
  sendingStartedAt: string | null;
  sentAt: string | null;
  publishedAt: string | null;
  reviewReason: string | null;
  approvedRecipientCount: number | null;
  contentHash: string;
  lastTestContentHash: string | null;
  lastTestSentAt: string | null;
  updatedAt: string;
  stats: Stats;
};

const blockTypes = Object.keys(NEWSLETTER_BLOCK_LABELS) as NewsletterBlockType[];

async function request(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo completar la acción.");
  }

  return payload.data ?? {};
}

export function NewsletterEditor({
  newsletter,
  products,
  testimonials,
  settings,
  eligibleRecipients,
  server,
}: {
  newsletter: EditorNewsletter;
  products: NewsletterProductSummary[];
  testimonials: NewsletterTestimonialOption[];
  settings: { testRecipients: string[]; senderName: string; sectionEnabled: boolean };
  eligibleRecipients: number;
  server: { newsletterSendingEnabled: boolean; canSendEmail: boolean; isProduction: boolean; siteUrl: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState<NewsletterContent>(newsletter.content);
  const [savedHash, setSavedHash] = useState(newsletter.contentHash);
  const [notes, setNotes] = useState(newsletter.internalNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(newsletter.internalNotes ?? "");
  const [updatedAt, setUpdatedAt] = useState(newsletter.updatedAt);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<SendDialogMode | null>(null);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [addOpen, setAddOpen] = useState(false);

  // Server state changes (actions, cron) arrive through router.refresh().
  useEffect(() => setUpdatedAt(newsletter.updatedAt), [newsletter.updatedAt]);
  useEffect(() => setSavedHash(newsletter.contentHash), [newsletter.contentHash]);

  const currentHash = useMemo(() => computeNewsletterContentHash(form), [form]);
  // Internal notes are admin-only: they count as unsaved changes but never invalidate a test send.
  const dirty = currentHash !== savedHash || notes.trim() !== savedNotes.trim();
  const productMap = useMemo(() => Object.fromEntries(products.map((product) => [product.id, product])), [products]);
  const checklist = getNewsletterChecklist(form, {
    contentHash: currentHash,
    lastTestContentHash: newsletter.lastTestContentHash,
    testRecipientsCount: settings.testRecipients.length,
  });
  const checklistReady = checklist.every((item) => item.ok || item.optional);
  const emailLocked = newsletter.sendingStartedAt !== null;
  const status = newsletter.status;
  const meta = newsletterStatusMeta[status];
  const locked = newsletter.archived;
  const publicUrl = newsletter.webVisible && newsletter.publishedAt ? `/newsletter/${newsletter.content.slug}` : null;
  const [linkCopied, setLinkCopied] = useState(false);

  async function copyPublicLink() {
    if (!publicUrl) return;
    const absolute = `${server.siteUrl}${publicUrl}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2200);
    } catch {
      window.prompt("Copiá el link:", absolute);
    }
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = useCallback(<K extends keyof NewsletterContent>(key: K, value: NewsletterContent[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  function setBlocks(transform: (blocks: NewsletterBlock[]) => NewsletterBlock[]) {
    setForm((current) => ({ ...current, blocks: transform(current.blocks) }));
  }

  async function run(label: string, action: () => Promise<string | void>) {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      const success = await action();
      if (success) setMessage(success);
      router.refresh();
      return null;
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "No se pudo completar la acción.";
      setError(text);
      return text;
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    await run("save", async () => {
      const data = await request(`/api/admin/newsletters/${newsletter.id}`, "PATCH", { content: form, internalNotes: notes, expectedUpdatedAt: updatedAt });
      setSavedHash(String(data.contentHash));
      setSavedNotes(notes);
      setUpdatedAt(String(data.updatedAt));
      return data.scheduleCancelled ? "Guardado. Como cambiaste el contenido, se canceló la programación: mandá una prueba nueva y volvé a programar." : "Cambios guardados.";
    });
  }

  async function sendTest() {
    await run("test", async () => {
      const data = await request(`/api/admin/newsletters/${newsletter.id}/test`, "POST", {});
      const recipients = (data.recipients as string[] | undefined) ?? [];
      const failures = (data.failures as string[] | undefined) ?? [];
      return `Prueba enviada a ${recipients.join(", ")}.${failures.length ? ` Fallaron: ${failures.join("; ")}` : ""}`;
    });
  }

  async function confirmDialog(input: { scheduledAt?: string; sendNow?: boolean; confirmation: string }) {
    if (!dialog) return null;
    const endpoints: Record<SendDialogMode, string> = {
      schedule: "schedule",
      complementary: "complementary",
      "approve-review": "approve-review",
      resume: "resume",
      "cancel-remaining": "cancel-remaining",
      "retry-errors": "retry-errors",
      reconcile: "",
    };
    const successMessages: Record<SendDialogMode, string> = {
      schedule: "Envío programado. Podés cancelarlo hasta la fecha elegida.",
      complementary: "Envío a nuevos suscriptos programado.",
      "approve-review": "Envío aprobado. Sale en la próxima ejecución.",
      resume: "Envío reanudado.",
      "cancel-remaining": "Se cancelaron los envíos pendientes.",
      "retry-errors": "Los envíos con error vuelven a salir en la próxima ejecución.",
      reconcile: "",
    };
    const failure = await run(dialog, async () => {
      await request(`/api/admin/newsletters/${newsletter.id}/${endpoints[dialog]}`, "POST", input);
      return successMessages[dialog];
    });
    if (!failure) setDialog(null);
    return failure;
  }

  async function simpleAction(action: "cancel-schedule" | "pause" | "duplicate" | "visibility", success: string, body?: unknown) {
    await run(action, async () => {
      const data = await request(`/api/admin/newsletters/${newsletter.id}/${action}`, "POST", body ?? {});
      if (action === "duplicate" && data.id) router.push(`/admin/newsletter/${String(data.id)}`);
      return success;
    });
  }

  async function remove() {
    const neverSent = !newsletter.sendingStartedAt;
    const question = neverSent
      ? "¿Eliminar este borrador? No se puede deshacer."
      : "¿Archivar esta newsletter? Se oculta de la web y del listado, pero se conserva todo el historial de envíos.";
    if (!window.confirm(question)) return;
    await run("remove", async () => {
      await request(`/api/admin/newsletters/${newsletter.id}`, "DELETE");
      router.push("/admin/newsletter");
      return neverSent ? "Borrador eliminado." : "Newsletter archivada.";
    });
  }

  const needsSaveHint = dirty ? "Guardá los cambios primero" : undefined;
  const canSchedule = status === "DRAFT" && !emailLocked && !locked;

  const editorColumn = (
    <div className="space-y-6">
      <Card className="space-y-5 p-5 md:p-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Portada</p>
          <h2 className="mt-1 font-display text-2xl">Título, resumen e imagen</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Categoría (opcional)</span>
            <Input value={form.category ?? ""} onChange={(event) => update("category", event.target.value)} maxLength={60} disabled={locked} placeholder="Ej: Nutrición e infancia" />
            <span className="mt-1 block text-xs text-brand-ink/45">Aparece arriba del título, en la web y en el mail.</span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Frase del encabezado del mail (opcional)</span>
            <Input value={form.headerTag ?? ""} onChange={(event) => update("headerTag", event.target.value)} maxLength={80} disabled={locked || emailLocked} placeholder="Ej: Lo que vale la pena saber" />
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Título</span>
          <Input value={form.title} onChange={(event) => update("title", event.target.value)} maxLength={140} disabled={locked} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Subtítulo (opcional)</span>
          <Input value={form.subtitle ?? ""} onChange={(event) => update("subtitle", event.target.value)} maxLength={220} disabled={locked} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Resumen</span>
          <Textarea value={form.excerpt} onChange={(event) => update("excerpt", event.target.value)} rows={3} maxLength={400} disabled={locked} />
          <span className="mt-1 block text-xs text-brand-ink/45">Se muestra en la tarjeta del listado, al compartir el link y en Google. {form.excerpt.length}/400</span>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">URL</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center overflow-hidden rounded-2xl border border-brand-ink/10 bg-white focus-within:border-brand-pink/40 focus-within:ring-2 focus-within:ring-brand-pink/20">
              <span className="pl-4 text-sm text-brand-ink/40">/newsletter/</span>
              <input
                value={form.slug}
                onChange={(event) => update("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                maxLength={80}
                disabled={locked}
                className="h-12 min-w-0 flex-1 bg-transparent pr-4 text-base text-brand-ink outline-none md:text-sm"
              />
            </div>
            <Button type="button" variant="secondary" size="sm" className="h-12" onClick={() => update("slug", slugifyNewsletter(form.title))} disabled={locked}>
              <Wand2 className="mr-2 h-4 w-4" /> Desde el título
            </Button>
          </div>
          {newsletter.publishedAt && form.slug !== newsletter.content.slug ? (
            <span className="mt-1 block text-xs font-bold text-amber-700">La URL anterior va a redirigir a la nueva automáticamente.</span>
          ) : null}
        </label>
        <NewsletterImageField
          label="Imagen de portada"
          url={form.coverImageUrl ?? ""}
          alt={form.coverImageAlt ?? ""}
          folder={newsletter.id}
          onChange={(value) => setForm((current) => ({ ...current, coverImageUrl: value.url || null, coverImageAlt: value.alt }))}
        />
      </Card>

      <Card className="space-y-5 p-5 md:p-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Mail</p>
          <h2 className="mt-1 font-display text-2xl">Asunto y vista previa</h2>
          {emailLocked ? <p className="mt-2 text-sm font-bold text-brand-ink/55">Bloqueado: la newsletter ya se envió. Los cambios de contenido solo afectan la versión web.</p> : null}
        </div>
        <label className="block">
          <span className="mb-2 flex items-center justify-between text-sm font-bold">
            Asunto <span className={cn("text-xs", form.emailSubject.length > 60 ? "text-amber-700" : "text-brand-ink/40")}>{form.emailSubject.length} · ideal hasta 60</span>
          </span>
          <Input value={form.emailSubject} onChange={(event) => update("emailSubject", event.target.value)} maxLength={120} disabled={locked || emailLocked} />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center justify-between text-sm font-bold">
            Texto de vista previa <span className={cn("text-xs", (form.emailPreviewText?.length ?? 0) > 110 ? "text-amber-700" : "text-brand-ink/40")}>{form.emailPreviewText?.length ?? 0} · ideal 40 a 110</span>
          </span>
          <Input value={form.emailPreviewText ?? ""} onChange={(event) => update("emailPreviewText", event.target.value)} maxLength={180} disabled={locked || emailLocked} placeholder="La frase que se ve al lado del asunto en la bandeja de entrada" />
        </label>
      </Card>

      <Card className="space-y-4 p-5 md:p-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Contenido</p>
          <h2 className="mt-1 font-display text-2xl">Bloques</h2>
          <p className="mt-1 text-sm text-brand-ink/55">Combiná textos, imágenes, productos y tips. El orden de acá es el orden de la web y del mail.</p>
        </div>

        {form.blocks.map((block, index) => (
          <NewsletterBlockEditor
            key={block.id}
            block={block}
            index={index}
            total={form.blocks.length}
            folder={newsletter.id}
            products={products}
            testimonials={testimonials}
            onChange={(next) => setBlocks((blocks) => blocks.map((item) => (item.id === block.id ? next : item)))}
            onMove={(direction) =>
              setBlocks((blocks) => {
                const next = [...blocks];
                const target = index + direction;
                [next[index], next[target]] = [next[target], next[index]];
                return next;
              })
            }
            onDuplicate={() => setBlocks((blocks) => [...blocks.slice(0, index + 1), duplicateBlock(block), ...blocks.slice(index + 1)])}
            onRemove={() => {
              if (window.confirm(`¿Eliminar el bloque "${NEWSLETTER_BLOCK_LABELS[block.type]}"?`)) setBlocks((blocks) => blocks.filter((item) => item.id !== block.id));
            }}
          />
        ))}

        {locked ? null : addOpen ? (
          <div className="rounded-[1.5rem] border border-dashed border-brand-pink/40 bg-brand-pink/5 p-4">
            <p className="mb-3 text-sm font-bold">¿Qué bloque querés agregar?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {blockTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setBlocks((blocks) => [...blocks, createEmptyBlock(type)]);
                    setAddOpen(false);
                  }}
                  className="rounded-2xl bg-white px-3 py-3 text-left text-sm font-bold text-brand-ink ring-1 ring-brand-ink/10 transition hover:ring-brand-pink/50"
                >
                  {NEWSLETTER_BLOCK_LABELS[type]}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setAddOpen(false)} className="mt-3 text-xs font-bold text-brand-ink/50 hover:underline">
              Cancelar
            </button>
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setAddOpen(true)} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Agregar bloque
          </Button>
        )}
      </Card>
    </div>
  );

  const notesCard = (
    <Card className="space-y-3 border border-brand-yellow/60 bg-[#FFFCEF] p-5">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-amber-700">Solo para el equipo</p>
        <h2 className="mt-1 font-display text-xl">Notas internas</h2>
        <p className="mt-1 text-xs leading-5 text-brand-ink/55">Fotos sugeridas, asuntos alternativos, datos a verificar. Nunca se publican ni se envían.</p>
      </div>
      <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={6} maxLength={5000} disabled={locked} className="bg-white" />
    </Card>
  );

  const previewColumn = (
    <div className="space-y-5 xl:sticky xl:top-6">
      <NewsletterPreview content={form} products={productMap} siteUrl={server.siteUrl} senderName={settings.senderName} publishedAt={newsletter.publishedAt} />
      <Card className="p-5">
        <p className="flex items-center gap-2 font-display text-xl">
          <ListChecks className="h-5 w-5 text-brand-pink" /> Antes de enviar
        </p>
        <ul className="mt-3 space-y-2">
          {checklist.map((item) => (
            <li key={item.id} className={cn("flex items-start gap-2 text-sm", item.ok ? "text-brand-ink/70" : "text-brand-ink")}>
              {item.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <Circle className={cn("mt-0.5 h-4 w-4 shrink-0", item.optional ? "text-brand-ink/15" : "text-brand-ink/30")} />
              )}
              {item.label}
            </li>
          ))}
        </ul>
        {newsletter.lastTestSentAt ? <p className="mt-3 text-xs text-brand-ink/45">Última prueba: {formatAdminDateTime(newsletter.lastTestSentAt)}</p> : null}
      </Card>
      {notesCard}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link href="/admin/newsletter" className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-pink">
            <ArrowLeft className="h-4 w-4" /> Newsletters
          </Link>
          <h1 className="mt-2 truncate font-display text-3xl text-brand-ink md:text-4xl">{form.title || "Sin título"}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em]">
            <span className={cn("rounded-full px-2.5 py-1", locked ? "bg-brand-ink/10 text-brand-ink/55" : meta.className)}>{locked ? "Archivada" : meta.label}</span>
            <span className={cn("rounded-full px-2.5 py-1", newsletter.webVisible ? "bg-brand-pink/12 text-brand-pink" : "bg-brand-ink/5 text-brand-ink/45")}>{newsletter.webVisible ? "Visible en la web" : "Oculta en la web"}</span>
            {dirty ? <span className="rounded-full bg-brand-yellow/40 px-2.5 py-1 text-amber-800">Cambios sin guardar</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {publicUrl ? (
            <>
              <Link href={publicUrl} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-brand-pink ring-1 ring-brand-pink/25 hover:bg-brand-pink/5">
                <Eye className="h-4 w-4" /> Ver en la web
              </Link>
              <button type="button" onClick={copyPublicLink} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:bg-white">
                {linkCopied ? <Check className="h-4 w-4 text-green-600" /> : <Link2 className="h-4 w-4" />}
                {linkCopied ? "¡Link copiado!" : "Copiar link"}
              </button>
            </>
          ) : null}
          {newsletter.stats.total > 0 ? (
            <Link href={`/admin/newsletter/${newsletter.id}/envios`} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:bg-white">
              <Users className="h-4 w-4" /> Envíos y auditoría
            </Link>
          ) : null}
          <Button type="button" size="sm" variant="secondary" disabled={busy !== null || dirty} title={needsSaveHint} onClick={() => simpleAction("duplicate", "Copia creada.")}>
            <Copy className="mr-2 h-4 w-4" /> Duplicar
          </Button>
          {!locked ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={remove}>
              <Archive className="mr-2 h-4 w-4" /> {newsletter.sendingStartedAt ? "Archivar" : "Eliminar"}
            </Button>
          ) : null}
        </div>
      </div>

      {!locked ? (
        <Card className="p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1 text-sm leading-6 text-brand-ink/70">
              <p className="font-display text-xl text-brand-ink">{meta.label}</p>
              <p>{meta.description}</p>
              {status === "SCHEDULED" ? (
                <p className="font-bold text-brand-ink">
                  Sale el {newsletter.scheduledAt ? formatArgentinaLongDateTime(newsletter.scheduledAt) : "—"} (hora de Buenos Aires) a {newsletter.approvedRecipientCount ?? "—"} destinatarios aprobados.
                </p>
              ) : null}
              {status === "NEEDS_REVIEW" && newsletter.reviewReason ? <p className="font-bold text-red-700">{reviewReasonLabels[newsletter.reviewReason] ?? newsletter.reviewReason}</p> : null}
              {status === "SENDING" || status === "PAUSED" || status === "SENT" ? (
                <p className="font-bold text-brand-ink">
                  {newsletter.stats.sent} enviados de {newsletter.stats.total}
                  {newsletter.stats.pending ? ` · ${newsletter.stats.pending} pendientes` : ""}
                  {newsletter.stats.skipped ? ` · ${newsletter.stats.skipped} omitidos` : ""}
                  {newsletter.stats.errors ? ` · ${newsletter.stats.errors} con error` : ""}
                  {newsletter.stats.reserved ? ` · ${newsletter.stats.reserved} a conciliar` : ""}
                </p>
              ) : null}
              {!server.newsletterSendingEnabled && canSchedule ? <p className="text-xs font-bold text-brand-pink">Los envíos reales están apagados en el servidor: podés mandar pruebas, pero no programar.</p> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => simpleAction("visibility", newsletter.webVisible ? "Ya no se muestra en la web." : "Ahora se muestra en la web.", { webVisible: !newsletter.webVisible })}
                disabled={busy !== null || dirty}
                title={needsSaveHint}
              >
                {newsletter.webVisible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {newsletter.webVisible ? "Ocultar de la web" : "Mostrar en la web"}
              </Button>

              {canSchedule || status === "NEEDS_REVIEW" ? (
                <Button type="button" variant="secondary" onClick={sendTest} disabled={busy !== null || dirty || !server.canSendEmail || settings.testRecipients.length === 0} title={needsSaveHint}>
                  <FlaskConical className="mr-2 h-4 w-4" /> {busy === "test" ? "Enviando prueba..." : "Enviar prueba"}
                </Button>
              ) : null}

              {canSchedule ? (
                <Button type="button" onClick={() => setDialog("schedule")} disabled={busy !== null || dirty || !checklistReady || !server.newsletterSendingEnabled || eligibleRecipients === 0}>
                  <Send className="mr-2 h-4 w-4" /> Programar envío
                </Button>
              ) : null}

              {status === "SCHEDULED" || status === "NEEDS_REVIEW" ? (
                <Button type="button" variant="ghost" onClick={() => window.confirm("¿Cancelar el envío programado?") && simpleAction("cancel-schedule", "Programación cancelada.")} disabled={busy !== null}>
                  <XCircle className="mr-2 h-4 w-4" /> Cancelar envío
                </Button>
              ) : null}

              {status === "NEEDS_REVIEW" ? (
                <Button type="button" onClick={() => setDialog("approve-review")} disabled={busy !== null || !server.newsletterSendingEnabled}>
                  <Send className="mr-2 h-4 w-4" /> Enviar igual
                </Button>
              ) : null}

              {status === "SENDING" ? (
                <Button type="button" onClick={() => simpleAction("pause", "Envío pausado. No sale ningún mail más hasta que lo reanudes.")} disabled={busy !== null} className="bg-orange-500 hover:bg-orange-600">
                  <Pause className="mr-2 h-4 w-4" /> Pausar envío
                </Button>
              ) : null}

              {status === "PAUSED" ? (
                <>
                  <Button type="button" onClick={() => setDialog("resume")} disabled={busy !== null}>
                    <Play className="mr-2 h-4 w-4" /> Reanudar
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setDialog("cancel-remaining")} disabled={busy !== null}>
                    <XCircle className="mr-2 h-4 w-4" /> Cancelar pendientes
                  </Button>
                </>
              ) : null}

              {status === "SENT" ? (
                <Button type="button" onClick={() => setDialog("complementary")} disabled={busy !== null || eligibleRecipients === 0 || !server.newsletterSendingEnabled} title={eligibleRecipients === 0 ? "Todos los suscriptos ya la recibieron" : undefined}>
                  <Send className="mr-2 h-4 w-4" /> {eligibleRecipients === 0 ? "Todos la recibieron" : `Enviar a ${eligibleRecipients} nuevos`}
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="bg-brand-ink/[0.03] p-5 text-sm font-bold text-brand-ink/60">Newsletter archivada: no se puede editar ni enviar. El historial de envíos se conserva.</Card>
      )}

      {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
      {message ? (
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </p>
      ) : null}

      <div className="flex gap-1 rounded-full bg-brand-ink/5 p-1 xl:hidden">
        {(["edit", "preview"] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setMobileTab(tab)} className={cn("h-10 flex-1 rounded-full text-sm font-extrabold transition", mobileTab === tab ? "bg-white text-brand-ink shadow-sm" : "text-brand-ink/55")}>
            {tab === "edit" ? "Editar" : "Vista previa"}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cn(mobileTab === "preview" && "hidden xl:block")}>{editorColumn}</div>
        <div className={cn(mobileTab === "edit" && "hidden xl:block")}>{previewColumn}</div>
      </div>

      {!locked && dirty ? (
        <div className="sticky bottom-4 z-30 rounded-[1.5rem] border border-brand-ink/10 bg-white/95 px-4 py-3 shadow-card backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-brand-ink/65">Tenés cambios sin guardar</p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => { if (window.confirm("¿Descartar los cambios sin guardar?")) { setForm(newsletter.content); setNotes(savedNotes); } }}>
                Descartar
              </Button>
              <Button type="button" size="sm" disabled={busy !== null} onClick={save}>
                <Save className="mr-2 h-4 w-4" /> {busy === "save" ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {dialog ? (
        <NewsletterSendDialog
          mode={dialog}
          recipients={dialog === "schedule" || dialog === "complementary" || dialog === "approve-review" ? eligibleRecipients : null}
          subject={dialog === "schedule" || dialog === "complementary" ? newsletter.content.emailSubject : undefined}
          onClose={() => setDialog(null)}
          onConfirm={confirmDialog}
        />
      ) : null}
    </div>
  );
}
