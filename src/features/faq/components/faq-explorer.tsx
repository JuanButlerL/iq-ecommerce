"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

type FaqItem = { id: string; question: string; answer: string };
const PAGE_SIZE = 8;

function searchable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function FaqExplorer({ faqs }: { faqs: FaqItem[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const filtered = useMemo(() => {
    const term = searchable(query.trim());
    if (!term) return faqs;
    return faqs.filter((faq) => searchable(`${faq.question} ${faq.answer}`).includes(term));
  }, [faqs, query]);
  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visible.length;

  function updateQuery(value: string) {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
    setOpenId(null);
  }

  return (
    <div>
      <div className="relative mb-5">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-pink" />
        <input
          type="search"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="Buscar por producto, envío, pago..."
          aria-label="Buscar en preguntas frecuentes"
          className="h-14 w-full rounded-2xl border border-brand-ink/10 bg-white pl-12 pr-12 text-base font-semibold text-brand-ink shadow-[0_8px_28px_rgba(44,34,65,0.05)] outline-none transition placeholder:font-normal placeholder:text-brand-ink/40 focus:border-brand-pink/50 focus:ring-4 focus:ring-brand-pink/10"
        />
        {query ? (
          <button type="button" onClick={() => updateQuery("")} aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-brand-ink/45 transition hover:bg-brand-pink/10 hover:text-brand-pink">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 text-xs font-bold text-brand-ink/50">
        <span>{query ? `${filtered.length} resultados` : `${faqs.length} preguntas`}</span>
        {faqs.length > PAGE_SIZE && !query ? <span>Mostrando {visible.length} de {faqs.length}</span> : null}
      </div>

      {visible.length ? (
        <div className="space-y-3">
          {visible.map((faq, index) => {
            const isOpen = openId === faq.id;
            const answerId = `faq-answer-${faq.id}`;
            const questionId = `faq-question-${faq.id}`;
            return (
              <article key={faq.id} className={`overflow-hidden rounded-[1.35rem] border bg-white transition duration-200 ${isOpen ? "border-brand-pink/50 shadow-[0_14px_38px_rgba(244,137,145,0.13)]" : "border-brand-ink/10 shadow-[0_7px_24px_rgba(44,34,65,0.045)] hover:border-brand-pink/35"}`}>
                <h3>
                  <button id={questionId} type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenId(isOpen ? null : faq.id)} className="flex w-full items-center gap-3 px-4 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-brand-pink sm:gap-5 sm:px-6 sm:py-5">
                    <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-extrabold transition sm:h-10 sm:w-10 sm:text-xs ${isOpen ? "bg-brand-pink text-white" : "bg-brand-pink/10 text-brand-pink"}`}>{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1 font-bold leading-snug sm:text-lg">{faq.question}</span>
                    <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-pink/20 text-brand-pink transition duration-200 ${isOpen ? "rotate-180 bg-brand-pink text-white" : ""}`}><ChevronDown className="h-5 w-5" /></span>
                  </button>
                </h3>
                <div id={answerId} role="region" aria-labelledby={questionId} aria-hidden={!isOpen} className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden"><div className="border-t border-brand-ink/10 px-5 pb-6 pt-5 sm:px-6 sm:pb-7"><p className="whitespace-pre-line text-sm leading-7 text-brand-ink/75 sm:pl-[3.75rem] sm:text-base sm:leading-8">{faq.answer}</p></div></div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-brand-pink/30 bg-white p-8 text-center">
          <Search className="mx-auto h-8 w-8 text-brand-pink" />
          <p className="mt-3 font-bold">No encontramos esa respuesta</p>
          <p className="mt-1 text-sm text-brand-ink/55">Probá con otra palabra o escribinos y te ayudamos.</p>
          <button type="button" onClick={() => updateQuery("")} className="mt-4 text-sm font-extrabold text-brand-pink hover:underline">Ver todas las preguntas</button>
        </div>
      )}

      {remaining > 0 ? (
        <button type="button" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl border border-brand-pink/25 bg-white px-5 py-3 text-sm font-extrabold text-brand-pink transition hover:border-brand-pink/50 hover:bg-brand-pink/5">
          Ver {Math.min(PAGE_SIZE, remaining)} preguntas más <span className="ml-2 text-brand-ink/40">({remaining} restantes)</span>
        </button>
      ) : null}
    </div>
  );
}
