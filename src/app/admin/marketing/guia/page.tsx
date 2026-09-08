import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

import { MarketingGuide, MarketingGuideNotice } from "@/features/marketing/components/marketing-guide";
import { requireAdminSection } from "@/lib/auth/admin";

export default async function AdminMarketingGuidePage() {
  await requireAdminSection("marketing");

  return (
    <div className="mx-auto max-w-5xl space-y-6 md:space-y-8">
      <section className="rounded-[2rem] bg-brand-ink px-5 py-6 text-white shadow-card md:px-8 md:py-8">
        <Link href="/admin/marketing" className="inline-flex items-center gap-2 text-sm font-bold text-white/75 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Volver al panel
        </Link>
        <div className="mt-7 flex items-start gap-4">
          <span className="rounded-2xl bg-brand-pink p-3 text-white"><BookOpen className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-pink">Centro de ayuda</p>
            <h1 className="mt-2 font-display text-4xl leading-none md:text-5xl">Guía de marketing</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 md:text-base">Cómo leer la atribución, preparar campañas y usar las exportaciones de IQ Kids.</p>
          </div>
        </div>
      </section>
      <MarketingGuideNotice />
      <section className="rounded-[2rem] bg-white p-5 shadow-card md:p-8"><MarketingGuide /></section>
    </div>
  );
}
