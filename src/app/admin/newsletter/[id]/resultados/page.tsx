import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { NewsletterResultsDetail } from "@/features/newsletter/components/newsletter-results-detail";
import { serializeResults } from "@/features/newsletter/results";
import { getNewsletterResults } from "@/features/newsletter/results-queries";
import { requireAdminSection } from "@/lib/auth/admin";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminNewsletterResultsPage({ params }: PageProps) {
  await requireAdminSection("newsletter");
  const { id } = await params;
  const data = await getNewsletterResults(id);

  if (!data.found) {
    notFound();
  }

  if (!data.results) {
    return (
      <Card className="p-8 text-center">
        <p className="font-display text-2xl text-brand-ink">{data.title}</p>
        <p className="mt-2 text-sm text-brand-ink/60">Esta newsletter todavía no se envió. Los resultados aparecen cuando sale la primera tanda.</p>
        <Link href={`/admin/newsletter/${id}`} className="mt-4 inline-flex font-extrabold text-brand-pink hover:underline">
          Volver al editor
        </Link>
      </Card>
    );
  }

  return <NewsletterResultsDetail results={serializeResults(data.results)} />;
}
