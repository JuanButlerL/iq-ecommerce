import { MarketingEventType, MarketingSourceCategory, MarketingSourcePlatform, Prisma } from "@prisma/client";
import { z } from "zod";

const SEARCH_ENGINES = ["google.", "bing.", "yahoo.", "duckduckgo.", "search.yahoo."];

export const marketingSessionContextSchema = z.object({
  visitorId: z.string().uuid(),
  sessionKey: z.string().uuid(),
  pagePath: z.string().trim().min(1).max(500),
  pageUrl: z.string().trim().url().max(2000),
  referrer: z.string().trim().max(2000).optional().or(z.literal("")),
  landingQuery: z.record(z.string(), z.string().max(500)).optional().default({}),
});

export type MarketingSessionContextInput = z.infer<typeof marketingSessionContextSchema>;

export type ResolvedMarketingAttribution = {
  sourceCategory: MarketingSourceCategory;
  sourcePlatform: MarketingSourcePlatform;
  sourceChannel: string;
  sourceLabel: string;
  isPaid: boolean;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  gclid: string | null;
  fbclid: string | null;
  ttclid: string | null;
  msclkid: string | null;
  landingQuery: Prisma.InputJsonObject | null;
};

export const MARKETING_EVENT_LABELS: Record<MarketingEventType, string> = {
  SESSION_STARTED: "Sesion iniciada",
  POPUP_CAPTURED: "Email captado en popup",
  CART_CAPTURED: "Carrito captado",
  ORDER_CREATED: "Pedido creado",
  ORDER_CONFIRMED: "Compra confirmada",
};

export function classifyMarketingAttribution(input: MarketingSessionContextInput): ResolvedMarketingAttribution {
  const landingQuery = Object.fromEntries(
    Object.entries(input.landingQuery ?? {}).filter(([, value]) => typeof value === "string" && value.trim().length > 0),
  ) as Record<string, string>;

  const utmSource = normalizeValue(landingQuery.utm_source);
  const utmMedium = normalizeValue(landingQuery.utm_medium);
  const utmCampaign = normalizeValue(landingQuery.utm_campaign);
  const utmContent = normalizeValue(landingQuery.utm_content);
  const utmTerm = normalizeValue(landingQuery.utm_term);
  const gclid = normalizeValue(landingQuery.gclid);
  const fbclid = normalizeValue(landingQuery.fbclid);
  const ttclid = normalizeValue(landingQuery.ttclid);
  const msclkid = normalizeValue(landingQuery.msclkid);
  const referrerHost = getHost(input.referrer);

  const sourceHint = [utmSource, referrerHost].filter(Boolean).join(" ");
  const mediumHint = utmMedium ?? "";
  const isPaid = Boolean(
    gclid || fbclid || ttclid || msclkid || /(^|[^a-z])(cpc|ppc|paid|ads|adset|remarketing|retargeting|display|social_paid|paid_social)([^a-z]|$)/i.test(mediumHint),
  );

  if (matchesAny(sourceHint, ["instagram", "ig", "facebook", "fb", "meta", "threads", "m.me"])) {
    const platform = sourceHint.includes("threads") ? MarketingSourcePlatform.THREADS : sourceHint.includes("instagram") || sourceHint.includes("ig") ? MarketingSourcePlatform.INSTAGRAM : MarketingSourcePlatform.FACEBOOK;
    return buildAttribution({
      sourceCategory: isPaid ? MarketingSourceCategory.META : MarketingSourceCategory.ORGANIC,
      sourcePlatform: platform,
      sourceChannel: isPaid ? "Paid Social" : "Organic Social",
      sourceLabel: isPaid ? `${platformLabel(platform)} Ads` : `${platformLabel(platform)} Organico`,
      isPaid,
      referrerHost,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      gclid,
      fbclid,
      ttclid,
      msclkid,
      landingQuery,
    });
  }

  if (matchesAny(sourceHint, ["tiktok", "tt"])) {
    return buildAttribution({
      sourceCategory: isPaid ? MarketingSourceCategory.TIKTOK : MarketingSourceCategory.ORGANIC,
      sourcePlatform: MarketingSourcePlatform.TIKTOK,
      sourceChannel: isPaid ? "Paid Social" : "Organic Social",
      sourceLabel: isPaid ? "TikTok Ads" : "TikTok Organico",
      isPaid,
      referrerHost,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      gclid,
      fbclid,
      ttclid,
      msclkid,
      landingQuery,
    });
  }

  if (matchesAny(sourceHint, ["google", "adwords", "youtube", "gmail"]) || Boolean(gclid || msclkid)) {
    const platform = sourceHint.includes("youtube") ? MarketingSourcePlatform.YOUTUBE : MarketingSourcePlatform.GOOGLE;
    return buildAttribution({
      sourceCategory: isPaid ? MarketingSourceCategory.GOOGLE : MarketingSourceCategory.ORGANIC,
      sourcePlatform: platform,
      sourceChannel: isPaid ? "Paid Search" : platform === MarketingSourcePlatform.YOUTUBE ? "Organic Video" : "Organic Search",
      sourceLabel: isPaid ? `${platformLabel(platform)} Ads` : platform === MarketingSourcePlatform.YOUTUBE ? "YouTube Organico" : "Google Organico",
      isPaid,
      referrerHost,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      gclid,
      fbclid,
      ttclid,
      msclkid,
      landingQuery,
    });
  }

  if (matchesAny(`${utmSource ?? ""} ${utmMedium ?? ""} ${referrerHost ?? ""}`, ["email", "newsletter", "mailchi", "klaviyo", "resend"])) {
    return buildAttribution({
      sourceCategory: MarketingSourceCategory.EMAIL,
      sourcePlatform: MarketingSourcePlatform.EMAIL,
      sourceChannel: "Email CRM",
      sourceLabel: "Email",
      isPaid: false,
      referrerHost,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      gclid,
      fbclid,
      ttclid,
      msclkid,
      landingQuery,
    });
  }

  if (matchesAny(`${utmSource ?? ""} ${referrerHost ?? ""}`, ["whatsapp", "wa.me"])) {
    return buildAttribution({
      sourceCategory: MarketingSourceCategory.WHATSAPP,
      sourcePlatform: MarketingSourcePlatform.WHATSAPP,
      sourceChannel: "Mensajeria",
      sourceLabel: "WhatsApp",
      isPaid: false,
      referrerHost,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      gclid,
      fbclid,
      ttclid,
      msclkid,
      landingQuery,
    });
  }

  if (!utmSource && !utmMedium && !referrerHost) {
    return buildAttribution({
      sourceCategory: MarketingSourceCategory.DIRECT,
      sourcePlatform: MarketingSourcePlatform.DIRECT,
      sourceChannel: "Direct",
      sourceLabel: "Directo",
      isPaid: false,
      referrerHost,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      gclid,
      fbclid,
      ttclid,
      msclkid,
      landingQuery,
    });
  }

  if (referrerHost && SEARCH_ENGINES.some((entry) => referrerHost.includes(entry))) {
    return buildAttribution({
      sourceCategory: MarketingSourceCategory.ORGANIC,
      sourcePlatform: MarketingSourcePlatform.GOOGLE,
      sourceChannel: "Organic Search",
      sourceLabel: "Buscador Organico",
      isPaid: false,
      referrerHost,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      gclid,
      fbclid,
      ttclid,
      msclkid,
      landingQuery,
    });
  }

  return buildAttribution({
    sourceCategory: MarketingSourceCategory.REFERRAL,
    sourcePlatform: MarketingSourcePlatform.REFERRAL,
    sourceChannel: "Referral",
    sourceLabel: referrerHost ? `Referral ${referrerHost}` : "Referral",
    isPaid: false,
    referrerHost,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    gclid,
    fbclid,
    ttclid,
    msclkid,
    landingQuery,
  });
}

function buildAttribution(input: ResolvedMarketingAttribution): ResolvedMarketingAttribution {
  return input;
}

function normalizeValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function matchesAny(value: string, matches: string[]) {
  const haystack = value.toLowerCase();
  return matches.some((entry) => haystack.includes(entry));
}

function getHost(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function platformLabel(platform: MarketingSourcePlatform) {
  switch (platform) {
    case MarketingSourcePlatform.INSTAGRAM:
      return "Instagram";
    case MarketingSourcePlatform.FACEBOOK:
      return "Facebook";
    case MarketingSourcePlatform.THREADS:
      return "Threads";
    case MarketingSourcePlatform.GOOGLE:
      return "Google";
    case MarketingSourcePlatform.YOUTUBE:
      return "YouTube";
    case MarketingSourcePlatform.TIKTOK:
      return "TikTok";
    case MarketingSourcePlatform.WHATSAPP:
      return "WhatsApp";
    case MarketingSourcePlatform.EMAIL:
      return "Email";
    case MarketingSourcePlatform.REFERRAL:
      return "Referral";
    default:
      return "Direct";
  }
}
