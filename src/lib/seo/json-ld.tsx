import { env } from "@/lib/env";

export function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, env.NEXT_PUBLIC_SITE_URL).toString();
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
