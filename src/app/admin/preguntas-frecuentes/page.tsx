import { FaqAdminPanel } from "@/features/admin/components/faq-admin-panel";
import { getAdminFaqs } from "@/features/faq/queries";
import { getStoreSettings } from "@/features/settings/queries";
import { requireAdminSection } from "@/lib/auth/admin";

export default async function AdminFaqPage() {
  await requireAdminSection("faq");
  const [faqs, settings] = await Promise.all([getAdminFaqs(), getStoreSettings()]);
  return (
    <FaqAdminPanel
      faqs={faqs}
      enabled={Boolean(settings?.faqSectionEnabled)}
      content={{
        eyebrow: settings?.faqEyebrow ?? "Estamos para ayudarte",
        title: settings?.faqTitle ?? "Las respuestas que",
        titleAccent: settings?.faqTitleAccent ?? "necesitás.",
        description: settings?.faqDescription ?? "Comprar algo rico y simple debería ser fácil. Acá reunimos las dudas más comunes para que puedas elegir con tranquilidad.",
        supportTitle: settings?.faqSupportTitle ?? "¿Te quedó alguna duda?",
        supportText: settings?.faqSupportText ?? "Estamos del otro lado para ayudarte con tu compra.",
      }}
    />
  );
}
