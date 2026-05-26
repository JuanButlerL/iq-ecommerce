import { createHash } from "node:crypto";

import { env } from "@/lib/env";

type MetaConversionsApiRequest = {
  eventName: string;
  eventId?: string;
  eventSourceUrl: string;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  userData?: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  };
  customData?: Record<string, unknown>;
};

function normalizeValue(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

function normalizePhone(value?: string | null) {
  return value?.replace(/\D+/g, "") || "";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildUserData(request: MetaConversionsApiRequest) {
  const userData: Record<string, unknown> = {};
  const email = normalizeValue(request.userData?.email);
  const phone = normalizePhone(request.userData?.phone);
  const firstName = normalizeValue(request.userData?.firstName);
  const lastName = normalizeValue(request.userData?.lastName);
  const city = normalizeValue(request.userData?.city);
  const state = normalizeValue(request.userData?.state);
  const zip = normalizeValue(request.userData?.zip);
  const country = normalizeValue(request.userData?.country);

  if (email) userData.em = sha256(email);
  if (phone) userData.ph = sha256(phone);
  if (firstName) userData.fn = sha256(firstName);
  if (lastName) userData.ln = sha256(lastName);
  if (city) userData.ct = sha256(city);
  if (state) userData.st = sha256(state);
  if (zip) userData.zp = sha256(zip);
  if (country) userData.country = sha256(country);
  if (request.clientIpAddress) userData.client_ip_address = request.clientIpAddress;
  if (request.clientUserAgent) userData.client_user_agent = request.clientUserAgent;

  return userData;
}

export async function sendMetaConversionsApiEvent(request: MetaConversionsApiRequest) {
  if (!env.hasMetaConversionsApi || !env.NEXT_PUBLIC_FB_PIXEL_ID || !env.META_CONVERSIONS_API_ACCESS_TOKEN) {
    return;
  }

  const userData = buildUserData(request);

  if (Object.keys(userData).length === 0) {
    return;
  }

  const payload = {
    data: [
      {
        event_name: request.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: request.eventId,
        action_source: "website",
        event_source_url: request.eventSourceUrl,
        user_data: userData,
        custom_data: request.customData,
      },
    ],
    test_event_code: env.META_CONVERSIONS_API_TEST_EVENT_CODE || undefined,
  };

  const response = await fetch(
    `https://graph.facebook.com/v23.0/${env.NEXT_PUBLIC_FB_PIXEL_ID}/events?access_token=${env.META_CONVERSIONS_API_ACCESS_TOKEN}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Meta Conversions API error: ${response.status} ${errorText}`);
  }
}
