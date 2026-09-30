"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { WhatsappIcon } from "@/components/icons/whatsapp-icon";

export function NewsletterShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const shareText = `${title} — Newsletter IQ Kids`;

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

  const buttonClass =
    "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 transition hover:-translate-y-0.5 hover:ring-brand-pink/40";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="mr-1 text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">Compartir</span>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5"
      >
        <WhatsappIcon className="h-4 w-4" /> WhatsApp
      </a>
      <button type="button" onClick={copy} className={buttonClass}>
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Link2 className="h-4 w-4" />}
        {copied ? "¡Copiado!" : "Copiar link"}
      </button>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className={buttonClass}>
        Facebook
      </a>
      <a href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className={buttonClass}>
        X
      </a>
      {canNativeShare ? (
        <button type="button" onClick={nativeShare} className={buttonClass} aria-label="Más opciones para compartir">
          <Share2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
