"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  WELCOME_POPUP_DELAY_MS,
  WELCOME_POPUP_EMAIL_STORAGE_KEY,
  WELCOME_POPUP_RESHOW_DAYS,
  WELCOME_POPUP_STORAGE_KEY,
  welcomePopupCopy,
} from "@/lib/marketing/welcome-popup-copy";

type PopupCoupon = {
  id: string;
  code: string;
  description?: string | null;
  discountType?: "PERCENTAGE" | "FIXED_AMOUNT";
  discountPercentage?: number | null;
  fixedDiscountArs?: number | null;
  discountLabel: string;
};

type PopupConfigResponse = {
  enabled: boolean;
  coupon?: PopupCoupon;
};

type PopupCaptureResponse = {
  leadId: string;
  emailSent: boolean;
  coupon: PopupCoupon;
};

const RESHOW_MS = WELCOME_POPUP_RESHOW_DAYS * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatBenefitHeadline(coupon: PopupCoupon) {
  const normalizedLabel = coupon.discountLabel
    .replace(/\u00a0/g, " ")
    .replace(/\$\s+/g, "$")
    .replace(/\s+OFF$/i, " off")
    .trim();

  return `${normalizedLabel} en tu primera caja.`;
}

export function WelcomePopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<PopupConfigResponse | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PopupCaptureResponse | null>(null);
  const isHome = pathname === "/";

  useEffect(() => {
    if (!isHome) {
      setOpen(false);
      setSuccess(null);
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    async function load() {
      try {
        const seenAtRaw = window.localStorage.getItem(WELCOME_POPUP_STORAGE_KEY);
        const seenAt = seenAtRaw ? Number(seenAtRaw) : null;

        if (seenAt && Number.isFinite(seenAt) && Date.now() - seenAt < RESHOW_MS) {
          setLoading(false);
          return;
        }

        const storedEmail = window.localStorage.getItem(WELCOME_POPUP_EMAIL_STORAGE_KEY)?.trim() ?? "";
        if (storedEmail) {
          setEmail(storedEmail);
        }

        const response = await fetch("/api/welcome-popup", { cache: "no-store" });
        const payload = (await response.json()) as { data?: PopupConfigResponse; error?: string };

        if (!response.ok || !payload.data?.enabled || !payload.data.coupon) {
          setLoading(false);
          return;
        }

        if (cancelled) {
          return;
        }

        setConfig(payload.data);
        timer = window.setTimeout(() => {
          window.localStorage.setItem(WELCOME_POPUP_STORAGE_KEY, String(Date.now()));
          setOpen(true);
        }, WELCOME_POPUP_DELAY_MS);
      } catch {
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [isHome]);

  useEffect(() => {
    if (!open) {
      document.body.style.removeProperty("overflow");
      return;
    }

    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.removeProperty("overflow");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!isHome || loading || !config?.coupon) {
    return null;
  }

  async function submitEmail() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("IngresÃ¡ un email vÃ¡lido para recibir el beneficio.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/welcome-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = (await response.json()) as { data?: PopupCaptureResponse; error?: string };

      if (!response.ok || !payload.data) {
        setError(payload.error ?? "No pudimos guardar tu email. ProbÃ¡ de nuevo.");
        return;
      }

      window.localStorage.setItem(WELCOME_POPUP_STORAGE_KEY, String(Date.now()));
      window.localStorage.setItem(WELCOME_POPUP_EMAIL_STORAGE_KEY, normalizedEmail);
      setSuccess(payload.data);
    } catch {
      setError("No pudimos guardar tu email. ProbÃ¡ de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  const benefitHeadline = formatBenefitHeadline(success?.coupon ?? config.coupon);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(0,0,0,0.35)] px-4 py-5"
      onClick={() => setOpen(false)}
      aria-hidden={!open}
      style={{ display: open ? "flex" : "none" }}
    >
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.13)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Popup de bienvenida"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-[18px] top-[16px] z-20 inline-flex h-7 w-7 items-center justify-center text-[16px] leading-none text-[#c9c1bc] transition hover:text-[#b1a7a0]"
          aria-label="Cerrar popup"
        >
          âœ•
        </button>

        {success ? (
          <div className="px-8 py-10 text-center sm:px-10 sm:py-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eef9fb] text-brand-cyan">
              <Check className="h-7 w-7 stroke-[2.2] text-brand-ink" />
            </div>
            <h2 className="mt-[18px] font-display text-[22px] leading-[1.2] text-brand-ink sm:text-[24px]">
              {welcomePopupCopy.successTitle}
            </h2>
            <p className="mt-[10px] text-[14px] leading-[1.65] text-[#5a5048]">{welcomePopupCopy.successBody}</p>
            <div className="mt-[18px] inline-flex rounded-[12px] border-2 border-dashed border-brand-cyan bg-[#eef9fb] px-6 py-[14px]">
              <span className="font-display text-[26px] tracking-[0.2em] text-brand-cyan">{success.coupon.code}</span>
            </div>
            <p className="mt-[10px] text-[11px] text-[#9a8a7a]">{welcomePopupCopy.successNote}</p>
            <div className="mt-[22px] flex justify-center">
              <Link
                href="/#productos"
                onClick={() => setOpen(false)}
                className="inline-flex h-[50px] items-center justify-center rounded-[12px] bg-[#e78080] px-9 font-display text-[14px] font-black text-white transition hover:bg-[#d46a6a]"
              >
                {welcomePopupCopy.successPrimaryAction} â†’
              </Link>
            </div>
          </div>
        ) : (
          <div className="px-[22px] pb-5 pt-6 sm:px-10 sm:pb-8 sm:pt-10">
            <h2 className="text-center font-display text-[17px] leading-[1.25] text-brand-ink sm:text-[24px] sm:leading-[1.2]">
              {welcomePopupCopy.titleLineOne}
              <br />
              <span className="text-[#e78080]">{benefitHeadline}</span>
            </h2>

            <p className="mt-3 text-center text-[11.5px] leading-[1.65] text-[#5a5048] sm:hidden">{welcomePopupCopy.mobileBody}</p>
            <p className="mt-[14px] hidden text-center text-[14px] leading-[1.7] text-[#5a5048] sm:block">
              IngresÃ¡ tu email, recibÃ­ el descuento y <strong className="font-bold text-brand-ink">sÃ© la primera en enterarte</strong> de novedades, lanzamientos y contenido para tu familia.
            </p>

            <div className="mb-[14px] mt-4 h-px bg-[#ede8e2] sm:mb-5 sm:mt-[22px]" />


            {error ? <p className="mt-3 text-center text-sm font-bold text-red-600">{error}</p> : null}

            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={welcomePopupCopy.emailPlaceholder}
              className="mt-0 block h-[42px] w-full rounded-[10px] border-[1.5px] border-[#ede8e2] px-3 text-[16px] text-brand-ink outline-none transition placeholder:text-[#ccc] focus:border-[#e78080] sm:mt-5 sm:h-[54px] sm:rounded-[12px] sm:border-2 sm:px-4 sm:text-[14px]"
            />

            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitEmail()}
              className="mt-2 inline-flex h-[48px] w-full items-center justify-center rounded-[10px] bg-[#e78080] px-5 font-display text-[13px] font-black tracking-[0.03em] text-white transition hover:bg-[#d46a6a] disabled:cursor-not-allowed disabled:opacity-70 sm:mt-[10px] sm:h-[56px] sm:rounded-[12px] sm:text-[16px]"
            >
              {submitting ? "Enviando..." : `${welcomePopupCopy.submitLabel} â†’`}
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-[10px] w-full text-center text-[9.5px] text-[#bcb4ae] underline decoration-[#bcb4ae] underline-offset-2 transition hover:text-[#9a8a7a] hover:decoration-[#9a8a7a] sm:mt-[14px] sm:text-[12px]"
            >
              {welcomePopupCopy.dismissLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
