"use client";

import { Bold, Italic, Link2 } from "lucide-react";
import { useRef } from "react";

import { Textarea } from "@/components/ui/textarea";

// Minimal formatting without HTML: **bold**, *italic* and [text](link).
export function NewsletterFormattedTextarea({
  value,
  onChange,
  rows = 5,
  maxLength,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after: string, fallback: string) {
    const textarea = ref.current;

    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  const toolClass = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-ink/60 transition hover:bg-brand-pinkSoft/40 hover:text-brand-ink";

  return (
    <div className="overflow-hidden rounded-3xl border border-brand-ink/10 bg-white focus-within:border-brand-pink/40 focus-within:ring-2 focus-within:ring-brand-pink/20">
      <div className="flex items-center gap-1 border-b border-brand-ink/8 px-3 py-1.5">
        <button type="button" className={toolClass} onClick={() => wrap("**", "**", "texto en negrita")} aria-label="Negrita" title="Negrita">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" className={toolClass} onClick={() => wrap("*", "*", "texto en cursiva")} aria-label="Cursiva" title="Cursiva">
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" className={toolClass} onClick={() => wrap("[", "](https://)", "texto del link")} aria-label="Link" title="Link">
          <Link2 className="h-4 w-4" />
        </button>
        <span className="ml-auto text-[11px] text-brand-ink/40">Dejá una línea en blanco para separar párrafos</span>
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className="rounded-none border-0 focus:ring-0"
      />
    </div>
  );
}
