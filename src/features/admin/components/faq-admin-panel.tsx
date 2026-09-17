"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleHelp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type FaqItem = { id: string; question: string; answer: string; active: boolean; sortOrder: number };
type FaqForm = { question: string; answer: string; active: boolean; sortOrder: string };
type FaqContent = { eyebrow: string; title: string; titleAccent: string; description: string; supportTitle: string; supportText: string };
const emptyForm: FaqForm = { question: "", answer: "", active: true, sortOrder: "0" };

export function FaqAdminPanel({ faqs, enabled, content }: { faqs: FaqItem[]; enabled: boolean; content: FaqContent }) {
  const router = useRouter();
  const [form, setForm] = useState<FaqForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copy, setCopy] = useState(content);
  const activeCount = faqs.filter((faq) => faq.active).length;

  function resetForm() {
    setForm({ ...emptyForm, sortOrder: String(faqs.length * 10) });
    setEditingId(null);
  }

  function edit(faq: FaqItem) {
    setEditingId(faq.id);
    setForm({ question: faq.question, answer: faq.answer, active: faq.active, sortOrder: String(faq.sortOrder) });
    setError(null);
    setMessage(null);
    document.getElementById("faq-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function send(url: string, method: string, action: string, body?: unknown) {
    setPendingAction(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar el cambio.");
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el cambio.");
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await send(editingId ? `/api/admin/faq/${editingId}` : "/api/admin/faq", editingId ? "PATCH" : "POST", "faq", {
      ...form,
      sortOrder: Number(form.sortOrder),
    });
    if (ok) {
      setMessage(editingId ? "Pregunta actualizada." : "Pregunta creada.");
      resetForm();
    }
  }

  async function remove(faq: FaqItem) {
    if (!window.confirm(`¿Eliminar definitivamente “${faq.question}”?`)) return;
    const ok = await send(`/api/admin/faq/${faq.id}`, "DELETE", `delete:${faq.id}`);
    if (ok) {
      setMessage("Pregunta eliminada.");
      if (editingId === faq.id) resetForm();
    }
  }

  async function toggleVisibility() {
    const ok = await send("/api/admin/faq/visibility", "PATCH", "visibility", { enabled: !enabled });
    if (ok) setMessage(enabled ? "Sección desactivada. El menú y la página pública ya no se muestran." : "Sección publicada en el menú y en la web.");
  }

  async function saveContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await send("/api/admin/faq/content", "PATCH", "content", copy);
    if (ok) setMessage("Textos de la página actualizados.");
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Contenido de la tienda</p>
          <h1 className="mt-1 font-display text-3xl text-brand-ink md:text-5xl">Preguntas frecuentes</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/65 md:text-base">Creá respuestas claras, ordenalas y elegí cuándo publicar la sección.</p>
        </div>
        {enabled ? <Link href="/preguntas-frecuentes" target="_blank" className="inline-flex items-center gap-2 text-sm font-bold text-brand-pink hover:underline"><Eye className="h-4 w-4" /> Ver página publicada</Link> : null}
      </div>

      <Card className="overflow-hidden border-brand-pink/20 bg-[linear-gradient(110deg,#fff2f3,#fffdfa)] p-5 md:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-pink shadow-sm">{enabled ? <Eye className="h-6 w-6" /> : <EyeOff className="h-6 w-6" />}</span>
            <div>
              <p className="font-display text-xl text-brand-ink">{enabled ? "Sección publicada" : "Sección oculta"}</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-brand-ink/65">{enabled ? "Aparece antes de Contacto en el menú. Las preguntas activas están disponibles para todos." : "Prepará las preguntas con calma. El menú y la página pública permanecen ocultos."}</p>
              <p className="mt-2 text-xs font-bold text-brand-pink">{activeCount} preguntas activas · {faqs.length} cargadas</p>
            </div>
          </div>
          <Button type="button" disabled={pendingAction !== null || (!enabled && activeCount === 0)} onClick={toggleVisibility} className="w-full shrink-0 sm:w-auto">{pendingAction === "visibility" ? "Guardando..." : enabled ? "Desactivar sección" : "Activar sección"}</Button>
        </div>
      </Card>

      <Card className="border border-brand-ink/8 p-5 md:p-7">
        <div className="max-w-3xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Textos de la página</p>
          <h2 className="mt-1 font-display text-2xl text-brand-ink">Encabezado y ayuda</h2>
          <p className="mt-2 text-sm leading-6 text-brand-ink/60">El título conserva dos partes para mantener el juego visual: la primera se muestra en negro y la segunda en rosa.</p>
        </div>
        <form onSubmit={saveContent} className="mt-6 grid gap-5 lg:grid-cols-2">
          <label className="block lg:col-span-2"><span className="mb-2 block text-sm font-bold">Texto superior</span><Input value={copy.eyebrow} onChange={(event) => setCopy((current) => ({ ...current, eyebrow: event.target.value }))} maxLength={80} required /></label>
          <label className="block"><span className="mb-2 block text-sm font-bold">Título en negro</span><Input value={copy.title} onChange={(event) => setCopy((current) => ({ ...current, title: event.target.value }))} maxLength={100} required /><span className="mt-1 block text-xs text-brand-ink/45">Ejemplo: Las respuestas que</span></label>
          <label className="block"><span className="mb-2 block text-sm font-bold text-brand-pink">Título en rosa</span><Input value={copy.titleAccent} onChange={(event) => setCopy((current) => ({ ...current, titleAccent: event.target.value }))} maxLength={100} required /><span className="mt-1 block text-xs text-brand-ink/45">Ejemplo: necesitás.</span></label>
          <label className="block lg:col-span-2"><span className="mb-2 block text-sm font-bold">Descripción del encabezado</span><Textarea value={copy.description} onChange={(event) => setCopy((current) => ({ ...current, description: event.target.value }))} rows={3} maxLength={500} required /></label>
          <label className="block"><span className="mb-2 block text-sm font-bold">Título de la tarjeta de ayuda</span><Input value={copy.supportTitle} onChange={(event) => setCopy((current) => ({ ...current, supportTitle: event.target.value }))} maxLength={120} required /></label>
          <label className="block"><span className="mb-2 block text-sm font-bold">Texto de la tarjeta de ayuda</span><Textarea value={copy.supportText} onChange={(event) => setCopy((current) => ({ ...current, supportText: event.target.value }))} rows={3} maxLength={300} required /></label>
          <div className="lg:col-span-2"><Button type="submit" disabled={pendingAction !== null} className="w-full sm:w-auto">{pendingAction === "content" ? "Guardando textos..." : "Guardar textos"}</Button></div>
        </form>
      </Card>

      {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
      {message ? <p role="status" className="inline-flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700"><Check className="h-4 w-4" />{message}</p> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div id="faq-editor" className="scroll-mt-24">
        <Card className="p-5 md:p-7">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Editor</p><h2 className="mt-1 font-display text-2xl">{editingId ? "Editar pregunta" : "Nueva pregunta"}</h2></div>
            {editingId ? <Button type="button" variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button> : null}
          </div>
          <form onSubmit={save} className="mt-6 space-y-5">
            <label className="block"><span className="mb-2 block text-sm font-bold">Pregunta</span><Input value={form.question} onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))} placeholder="¿Cuánto tarda en llegar mi pedido?" minLength={5} maxLength={220} required /></label>
            <label className="block"><span className="mb-2 block text-sm font-bold">Respuesta</span><Textarea value={form.answer} onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))} placeholder="Explicá la respuesta con un tono claro y cercano..." rows={8} minLength={10} maxLength={3000} required /><span className="mt-1 block text-xs text-brand-ink/50">Podés usar saltos de línea; se mostrarán tal como los escribas.</span></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-bold">Orden</span><Input type="number" min={0} max={9999} value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} required /></label><div className="flex items-end pb-3"><Checkbox label="Pregunta activa" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /></div></div>
            <Button type="submit" disabled={pendingAction !== null} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />{pendingAction === "faq" ? (editingId ? "Guardando cambios..." : "Creando pregunta...") : editingId ? "Guardar cambios" : "Crear pregunta"}</Button>
          </form>
        </Card>
        </div>

        <Card className="p-5 md:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Listado</p>
          <h2 className="mt-1 font-display text-2xl">Preguntas cargadas</h2>
          <p className="mt-2 text-sm text-brand-ink/60">Se muestran en orden ascendente. Las pausadas se conservan en admin.</p>
          <div className="mt-6 space-y-3">
            {faqs.length === 0 ? <div className="rounded-[1.5rem] border border-dashed border-brand-pink/30 bg-brand-pink/5 p-7 text-center"><CircleHelp className="mx-auto h-9 w-9 text-brand-pink" /><p className="mt-3 font-bold">Todavía no hay preguntas</p><p className="mt-1 text-sm text-brand-ink/60">Creá la primera desde el editor.</p></div> : faqs.map((faq) => <article key={faq.id} className={`rounded-[1.5rem] border p-4 transition ${editingId === faq.id ? "border-brand-pink bg-brand-pink/5" : "border-brand-ink/10 bg-white"}`}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em]"><span className="rounded-full bg-brand-yellow/30 px-2.5 py-1">Orden {faq.sortOrder}</span><span className={`rounded-full px-2.5 py-1 ${faq.active ? "bg-green-100 text-green-700" : "bg-brand-ink/10 text-brand-ink/55"}`}>{faq.active ? "Activa" : "Pausada"}</span></div><h3 className="mt-3 font-bold leading-snug">{faq.question}</h3><p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-brand-ink/60">{faq.answer}</p></div></div>
              <div className="mt-4 flex gap-2"><Button type="button" size="sm" variant="secondary" disabled={pendingAction !== null} onClick={() => edit(faq)}><Pencil className="mr-2 h-4 w-4" />Editar</Button><Button type="button" size="sm" variant="ghost" disabled={pendingAction !== null} onClick={() => remove(faq)}><Trash2 className="mr-2 h-4 w-4" />{pendingAction === `delete:${faq.id}` ? "Eliminando..." : "Eliminar"}</Button></div>
            </article>)}
          </div>
        </Card>
      </div>
    </div>
  );
}
