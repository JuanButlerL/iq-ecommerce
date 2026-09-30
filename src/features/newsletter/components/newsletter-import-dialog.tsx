"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, FileCode2, FileUp, ImageOff, Link2, Lock, NotebookPen, X } from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { NewsletterBlocksView } from "@/features/newsletter/components/newsletter-blocks";
import { NEWSLETTER_BLOCK_LABELS } from "@/features/newsletter/content";
import { parseNewsletterSequenceHtml, type ImportedNewsletter } from "@/features/newsletter/import-html";
import { cn } from "@/lib/utils/cn";

type ImportResult = { created: Array<{ id: string; title: string }>; failed: Array<{ index: number; title: string; error: string }> };
type Candidate = ImportedNewsletter & { key: string; fileName: string; duplicate: boolean };
type Step = "pick" | "review" | "done";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_ITEMS = 30;

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function warningsFor(item: Candidate) {
  const warnings: Array<{ icon: typeof ImageOff; text: string }> = [];
  warnings.push({ icon: ImageOff, text: "Subir la foto de portada" });
  if (item.internalNotes.includes('era "#"')) warnings.push({ icon: Link2, text: "Revisar el link del botón" });
  if (item.duplicate) warnings.push({ icon: AlertTriangle, text: "Ya existe una newsletter con este título" });
  return warnings;
}

export function NewsletterImportButton({ existingTitles }: { existingTitles: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const existing = useMemo(() => new Set(existingTitles.map(normalize)), [existingTitles]);
  const active = candidates.find((item) => item.key === activeKey) ?? candidates[0] ?? null;

  function open() {
    setStep("pick");
    setCandidates([]);
    setSelected(new Set());
    setResult(null);
    setError(null);
  }

  function close() {
    if (importing) return;
    setStep(null);
  }

  async function readFiles(fileList: FileList | File[]) {
    setError(null);
    const files = Array.from(fileList);
    const rejected = files.filter((file) => !/\.html?$/i.test(file.name) || file.size > MAX_FILE_SIZE);

    if (rejected.length > 0) {
      setError(`Estos archivos no se pueden importar (tienen que ser .html de hasta 2 MB): ${rejected.map((file) => file.name).join(", ")}`);
      return;
    }

    const parsed: Candidate[] = [];
    for (const file of files) {
      const items = parseNewsletterSequenceHtml(await file.text());
      items.forEach((item, index) =>
        parsed.push({ ...item, key: `${file.name}-${index}`, fileName: file.name, duplicate: existing.has(normalize(item.content.title)) }),
      );
    }

    if (parsed.length === 0) {
      setError("No encontramos newsletters en esos archivos. El importador reconoce los HTML de la agencia (un email por bloque, con asunto, encabezado y cuerpo).");
      return;
    }

    if (parsed.length > MAX_ITEMS) {
      setError(`Se pueden importar hasta ${MAX_ITEMS} newsletters por vez. Estos archivos tienen ${parsed.length}.`);
      return;
    }

    setCandidates(parsed);
    // Already-imported editions start unchecked to avoid duplicates.
    setSelected(new Set(parsed.filter((item) => !item.duplicate).map((item) => item.key)));
    setActiveKey(parsed[0]?.key ?? null);
    setStep("review");
    if (fileRef.current) fileRef.current.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) void readFiles(event.dataTransfer.files);
  }

  async function confirm() {
    setImporting(true);
    setError(null);

    try {
      const chosen = candidates.filter((item) => selected.has(item.key));
      const response = await fetch("/api/admin/newsletters/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: chosen.map((item) => ({ content: item.content, internalNotes: item.internalNotes })) }),
      });
      const payload = (await response.json()) as { data?: ImportResult; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "No se pudo importar.");
      setResult(payload.data);
      setStep("done");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo importar.");
    } finally {
      setImporting(false);
    }
  }

  const steps: Array<{ id: Step; label: string }> = [
    { id: "pick", label: "Elegir archivos" },
    { id: "review", label: "Revisar" },
    { id: "done", label: "Listo" },
  ];

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".html,.htm,text/html"
        className="hidden"
        onChange={(event) => event.target.files && event.target.files.length > 0 && readFiles(event.target.files)}
      />
      <Button type="button" variant="secondary" onClick={open}>
        <FileUp className="mr-2 h-4 w-4" /> Importar HTML
      </Button>

      {step ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-ink/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="import-title">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]">
            <div className="flex items-start justify-between gap-4 border-b border-brand-ink/8 px-6 py-5 sm:px-8">
              <div>
                <h2 id="import-title" className="font-display text-2xl text-brand-ink">
                  Importar newsletters desde HTML
                </h2>
                <ol className="mt-3 flex flex-wrap items-center gap-2 text-xs font-extrabold">
                  {steps.map((item, index) => {
                    const current = steps.findIndex((entry) => entry.id === step);
                    return (
                      <li key={item.id} className="flex items-center gap-2">
                        <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", index <= current ? "bg-brand-pink text-white" : "bg-brand-ink/8 text-brand-ink/45")}>{index + 1}</span>
                        <span className={index === current ? "text-brand-ink" : "text-brand-ink/45"}>{item.label}</span>
                        {index < steps.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-brand-ink/25" /> : null}
                      </li>
                    );
                  })}
                </ol>
              </div>
              <button type="button" onClick={close} disabled={importing} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-brand-ink/50 hover:bg-brand-ink/5" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              {step === "pick" ? (
                <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={cn(
                      "flex min-h-[280px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed p-8 text-center transition",
                      dragging ? "border-brand-pink bg-brand-pink/5" : "border-brand-ink/15 bg-brand-ink/[0.02]",
                    )}
                  >
                    <FileCode2 className="h-12 w-12 text-brand-pink" />
                    <p className="mt-4 font-display text-2xl">Arrastrá acá los archivos HTML</p>
                    <p className="mt-2 text-sm text-brand-ink/55">Podés subir uno o varios. Cada archivo puede tener una o muchas newsletters.</p>
                    <Button type="button" className="mt-6" onClick={() => fileRef.current?.click()}>
                      <FileUp className="mr-2 h-4 w-4" /> Elegir archivos
                    </Button>
                  </div>
                  <div className="space-y-4 rounded-[2rem] bg-brand-pinkSoft/20 p-6 text-sm leading-6 text-brand-ink/75">
                    <p className="font-display text-xl text-brand-ink">Qué hace el importador</p>
                    <p>
                      <strong>Precarga todo:</strong> título, asunto, texto de vista previa, categoría, frase del encabezado, resumen y cada bloque del contenido (párrafos, datos, pasos, citas, testimonios, fuentes y botones).
                    </p>
                    <p>
                      <strong>Crea borradores:</strong> no publica nada en la web y <strong>no envía ningún mail</strong>. Después cada texto se puede editar en el editor.
                    </p>
                    <p>
                      <strong>Guarda las notas:</strong> la foto sugerida, los asuntos alternativos y los datos a verificar quedan en las notas internas de cada newsletter.
                    </p>
                    <p className="flex items-start gap-2 rounded-2xl bg-white p-3 text-xs text-brand-ink/60">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand-pink" /> El HTML no se guarda tal cual: se convierte en bloques de la marca, así se ve bien en todos los clientes de mail y no puede romper la página.
                    </p>
                  </div>
                </div>
              ) : null}

              {step === "review" ? (
                <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-brand-ink/55">
                      <span>
                        {selected.size} de {candidates.length} seleccionadas
                      </span>
                      <span className="flex gap-3">
                        <button type="button" className="text-brand-pink hover:underline" onClick={() => setSelected(new Set(candidates.map((item) => item.key)))}>
                          Todas
                        </button>
                        <button type="button" className="text-brand-ink/55 hover:underline" onClick={() => setSelected(new Set())}>
                          Ninguna
                        </button>
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {candidates.map((item) => (
                        <li key={item.key}>
                          <div
                            className={cn(
                              "flex items-start gap-3 rounded-[1.25rem] border p-3.5 transition",
                              active?.key === item.key ? "border-brand-pink bg-brand-pink/5" : "border-brand-ink/10 hover:border-brand-pink/40",
                            )}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Importar ${item.content.title}`}
                              checked={selected.has(item.key)}
                              onChange={(event) =>
                                setSelected((current) => {
                                  const next = new Set(current);
                                  if (event.target.checked) next.add(item.key);
                                  else next.delete(item.key);
                                  return next;
                                })
                              }
                              className="mt-1 h-4 w-4 shrink-0 accent-brand-pink"
                            />
                            <button type="button" onClick={() => setActiveKey(item.key)} className="min-w-0 text-left">
                              <span className="block truncate text-[11px] font-extrabold uppercase tracking-[0.1em] text-brand-pink">{item.sourceLabel}</span>
                              <span className="mt-1 block text-sm font-bold leading-snug text-brand-ink">{item.content.title}</span>
                              {item.duplicate ? <span className="mt-1 block text-xs font-bold text-amber-700">Ya importada: se crearía una copia</span> : null}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {active ? (
                    <div className="space-y-5">
                      <div className="rounded-[1.5rem] border border-brand-ink/10 p-5">
                        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-pink">Campos que se precargan</p>
                        <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                          {[
                            ["Título", active.content.title],
                            ["Asunto del mail", active.content.emailSubject],
                            ["Vista previa del mail", active.content.emailPreviewText ?? "—"],
                            ["Categoría", active.content.category ?? "—"],
                            ["Frase del encabezado", active.content.headerTag ?? "—"],
                            ["Resumen", active.content.excerpt],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <dt className="text-xs font-bold text-brand-ink/45">{label}</dt>
                              <dd className="mt-0.5 text-brand-ink">{value}</dd>
                            </div>
                          ))}
                        </dl>
                        <p className="mt-4 text-xs text-brand-ink/50">
                          {active.content.blocks.length} bloques:{" "}
                          {Object.entries(
                            active.content.blocks.reduce<Record<string, number>>((acc, block) => ({ ...acc, [block.type]: (acc[block.type] ?? 0) + 1 }), {}),
                          )
                            .map(([type, count]) => `${count} ${NEWSLETTER_BLOCK_LABELS[type as keyof typeof NEWSLETTER_BLOCK_LABELS].toLowerCase()}`)
                            .join(" · ")}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {warningsFor(active).map((warning) => (
                          <span key={warning.text} className="inline-flex items-center gap-1.5 rounded-full bg-brand-yellow/25 px-3 py-1.5 text-xs font-bold text-amber-800">
                            <warning.icon className="h-3.5 w-3.5" /> {warning.text}
                          </span>
                        ))}
                      </div>

                      <details className="rounded-[1.5rem] border border-brand-yellow/60 bg-[#FFFCEF] p-4 text-sm">
                        <summary className="flex cursor-pointer items-center gap-2 font-bold text-brand-ink">
                          <NotebookPen className="h-4 w-4 text-amber-700" /> Notas internas que se guardan
                        </summary>
                        <p className="mt-3 whitespace-pre-line text-xs leading-5 text-brand-ink/70">{active.internalNotes}</p>
                      </details>

                      <div className="rounded-[1.5rem] bg-brand-ink/[0.03] p-5 sm:p-7">
                        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">Vista previa del contenido</p>
                        {active.content.category ? <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-pink">{active.content.category}</p> : null}
                        <h3 className="mt-1 font-display text-[2rem] leading-[1.05] text-brand-ink">{active.content.title}</h3>
                        <div className="mt-4 rounded-[1.5rem] bg-white px-5 py-2 sm:px-7">
                          <NewsletterBlocksView blocks={active.content.blocks} products={{}} />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === "done" && result ? (
                <div className="mx-auto max-w-2xl space-y-5 py-4">
                  <p className="flex items-center gap-2 font-display text-2xl text-green-700">
                    <CheckCircle2 className="h-7 w-7" /> {result.created.length} {result.created.length === 1 ? "borrador creado" : "borradores creados"}
                  </p>
                  {result.failed.length > 0 ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <p className="font-bold">No se pudieron importar:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {result.failed.map((item) => (
                          <li key={item.index}>
                            {item.title}: {item.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="rounded-[1.5rem] bg-brand-ink/[0.03] p-5 text-sm leading-6 text-brand-ink/75">
                    <p className="font-bold text-brand-ink">Próximos pasos en cada borrador</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      <li>Subir la foto de portada (la sugerida figura en las notas internas).</li>
                      <li>Revisar los textos, los links de los botones y los datos marcados para verificar.</li>
                      <li>Mandar la prueba a tu casilla y, recién ahí, programar el envío.</li>
                    </ol>
                  </div>
                  <ul className="divide-y divide-brand-ink/8 rounded-[1.5rem] border border-brand-ink/10">
                    {result.created.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="min-w-0 truncate text-sm font-bold text-brand-ink">{item.title}</span>
                        <Link href={`/admin/newsletter/${item.id}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-extrabold text-brand-pink hover:underline">
                          Abrir <ArrowRight className="h-4 w-4" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {error ? (
                <p role="alert" className="mt-5 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-brand-ink/8 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <p className="text-xs text-brand-ink/50">Importar no publica ni envía nada. Siempre se crean borradores.</p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                {step === "review" ? (
                  <>
                    <Button type="button" variant="secondary" onClick={() => setStep("pick")} disabled={importing}>
                      Elegir otros archivos
                    </Button>
                    <Button type="button" onClick={confirm} disabled={importing || selected.size === 0}>
                      {importing ? "Creando borradores..." : `Crear ${selected.size} ${selected.size === 1 ? "borrador" : "borradores"}`}
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant={step === "done" ? "primary" : "secondary"} onClick={close}>
                    {step === "done" ? "Listo" : "Cancelar"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
