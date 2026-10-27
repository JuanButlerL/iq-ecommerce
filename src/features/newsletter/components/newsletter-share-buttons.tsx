"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { cn } from "@/lib/utils/cn";

export function NewsletterShareButtons({ url, title, layout = "row" }: { url: string; title: string; layout?: "row" | "stack" }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const shareText = `${title} — Newsletter IQ Kids`;
  const stack = layout === "stack";

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copiá el link:", url);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: shareText, url });
    } catch {
      // Cancelled by the user.
    }
  }

  const buttonClass = cn(
    "inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-brand-ink ring-1 ring-brand-ink/12 transition hover:ring-brand-ink/30",
    stack ? "w-full justify-start" : "justify-center",
  );

  return (
    <div className={cn("flex gap-2", stack ? "flex-col" : "flex-wrap items-center")}>
      {!stack ? <span className="mr-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">Compartir</span> : null}
      <a href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`} target="_blank" rel="noopener noreferrer" className={buttonClass}>
        <WhatsappIcon className="h-4 w-4 text-[#1FAF55]" /> WhatsApp
      </a>
      <button type="button" onClick={copy} className={buttonClass}>
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Link2 className="h-4 w-4" />}
        {copied ? "¡Link copiado!" : "Copiar link"}
      </button>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className={buttonClass}>
        Facebook
      </a>
      <a href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className={buttonClass}>
        X
      </a>
      {canNativeShare && !stack ? (
        <button type="button" onClick={nativeShare} className={buttonClass} aria-label="Más opciones para compartir">
          <Share2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
