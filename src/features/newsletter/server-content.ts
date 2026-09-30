import type { Newsletter } from "@prisma/client";

import type { NewsletterBlock, NewsletterContent, NewsletterProductSummary } from "@/features/newsletter/content";
import { buildNewsletterEmailSnapshot } from "@/features/newsletter/render-email";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

type NewsletterContentRow = Pick<
  Newsletter,
  "slug" | "title" | "subtitle" | "excerpt" | "category" | "headerTag" | "coverImageUrl" | "coverImageAlt" | "blocks" | "emailSubject" | "emailPreviewText"
>;

// Blocks are validated with Zod before every write, so the stored JSON is trusted here.
export function toNewsletterContent(row: NewsletterContentRow): NewsletterContent {
  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    excerpt: row.excerpt,
    category: row.category,
    headerTag: row.headerTag,
    coverImageUrl: row.coverImageUrl,
    coverImageAlt: row.coverImageAlt,
    blocks: Array.isArray(row.blocks) ? (row.blocks as unknown as NewsletterBlock[]) : [],
    emailSubject: row.emailSubject,
    emailPreviewText: row.emailPreviewText,
  };
}

export async function loadNewsletterProducts(productIds?: string[]) {
  const products = await prisma.product.findMany({
    where: productIds ? { id: { in: productIds } } : { active: true },
    include: { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return Object.fromEntries(
    products.map((product) => [
      product.id,
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        priceArs: product.priceArs,
        imageUrl: product.images[0]?.publicUrl ?? null,
        available: product.active && product.visible && !product.manualSoldOut,
      } satisfies NewsletterProductSummary,
    ]),
  );
}

export function getNewsletterProductIds(content: Pick<NewsletterContent, "blocks">) {
  return [...new Set(content.blocks.flatMap((block) => (block.type === "product" && block.productId ? [block.productId] : [])))];
}

export function getNewsletterWebUrl(slug: string) {
  return `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/newsletter/${slug}`;
}

// "Ver en la web" is only linked when the newsletter page is published (visible).
export async function buildSnapshotForNewsletter(row: NewsletterContentRow & Pick<Newsletter, "webVisible">) {
  const content = toNewsletterContent(row);
  const products = await loadNewsletterProducts(getNewsletterProductIds(content));

  return buildNewsletterEmailSnapshot({
    content,
    products,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    webUrl: row.webVisible ? getNewsletterWebUrl(row.slug) : null,
  });
}
