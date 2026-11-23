"use client";

import { Check, Copy, Download, LogOut, MessageCircle } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";
import { formatArgentinaDate } from "@/lib/utils/datetime";

type HistoryItem = { id: string; date: Date | string; amountArs: number; status: string; expiresAt: Date | string | null };

type Props = {
  firstName: string | null;
  friendCode: string;
  creditCode: string;
  balanceArs: number;
  nextExpiry: Date | string | null;
  friendsCount: number;
  history: HistoryItem[];
  shareMessage: string;
  shareImageUrl: string | null;
  terms: string[];
  friendDiscountPercentage: number;
  creditAmountArs: number;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiá el texto:", value);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 transition hover:bg-brand-pinkSoft/30"
    >
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      {copied ? "¡Copiado!" : label}
    </button>
  );
}

export function ReferralDashboard(props: Props) {
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(props.shareMessage)}`;

  async function handleLogout() {
    await fetch("/api/referidos/sesion", { method: "DELETE" });
    window.location.assign("/referidos");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Club de Familias iQ</p>
          <h1 className="font-display text-3xl leading-tight text-brand-ink md:text-5xl">
            {props.firstName ? `¡Hola ${props.firstName}!` : "¡Hola!"}
          </h1>
          <p className="mt-1 text-sm leading-6 text-brand-ink/70">
            Tus amigas tienen {props.friendDiscountPercentage}% en su primera compra y vos sumás {formatArs(props.creditAmountArs)} por cada una, sin tope.
          </p>
        </div>
        <button type="button" onClick={handleLogout} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-ink/55 hover:text-brand-ink">
          <LogOut className="h-4 w-4" /> Salir
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-4 p-5 md:p-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/50">Tu código para compartir</p>
            <p className="font-display text-4xl tracking-wider text-brand-pink md:text-5xl">{props.friendCode}</p>
          </div>
          <div className="rounded-2xl bg-brand-pinkSoft/25 p-4 text-sm leading-6 text-brand-ink/80">{props.shareMessage}</div>
          <div className="flex flex-wrap gap-2">
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-extrabold text-white transition hover:brightness-95"
            >
              <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
            </a>
            <CopyButton value={props.shareMessage} label="Copiar mensaje" />
            {props.shareImageUrl ? (
              <a
                href={props.shareImageUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 transition hover:bg-brand-pinkSoft/30"
              >
                <Download className="h-4 w-4" /> Bajar imagen
              </a>
            ) : null}
          </div>
          {props.shareImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.shareImageUrl} alt="Imagen para compartir" className="w-full max-w-xs rounded-2xl" />
          ) : null}
        </Card>

        <Card className="space-y-4 p-5 md:p-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/50">Tu crédito disponible</p>
            <p className="font-display text-4xl text-brand-ink md:text-5xl">{formatArs(props.balanceArs)}</p>
            <p className="text-sm text-brand-ink/60">
              {props.friendsCount === 1 ? "1 amiga compró con tu código" : `${props.friendsCount} amigas compraron con tu código`}
              {props.nextExpiry ? ` · vence el ${formatArgentinaDate(new Date(props.nextExpiry))}` : ""}
            </p>
          </div>
          <div className="rounded-2xl bg-brand-mint/60 p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/50">Tu código de crédito (no lo compartas)</p>
            <p className="font-mono text-xl font-bold tracking-wider text-brand-ink">{props.creditCode}</p>
            <p className="mt-1 text-xs leading-5 text-brand-ink/65">
              Cargalo en el checkout de iqkids.com.ar como cupón, con tu DNI. Si tu compra es menor que el saldo, el resto te queda.
            </p>
            <div className="mt-3">
              <CopyButton value={props.creditCode} label="Copiar código" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5 md:p-6">
        <h2 className="mb-3 font-display text-2xl text-brand-ink">Tus amigas</h2>
        {props.history.length ? (
          <ul className="divide-y divide-brand-ink/5">
            {props.history.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="text-brand-ink/70">Compra del {formatArgentinaDate(new Date(item.date))}</span>
                <span className="flex items-center gap-3">
                  <span className="font-bold text-brand-ink">{formatArs(item.amountArs)}</span>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-extrabold",
                      item.status === "Acreditado" ? "bg-brand-mint text-green-800" : "bg-brand-ink/5 text-brand-ink/70",
                    )}
                  >
                    {item.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-brand-ink/65">Todavía nadie compró con tu código. ¡Compartilo y empezá a sumar!</p>
        )}
      </Card>

      <details className="rounded-[2rem] bg-white p-5 shadow-card md:p-6">
        <summary className="cursor-pointer font-display text-xl text-brand-ink">Las reglas</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-brand-ink/75">
          {props.terms.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
