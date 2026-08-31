const VISITOR_KEY = "iqkids-marketing-visitor-id";
const SESSION_KEY = "iqkids-marketing-session-id";
const SESSION_TRACKED_KEY = "iqkids-marketing-session-tracked";

export type BrowserMarketingContext = {
  visitorId: string;
  sessionKey: string;
  pagePath: string;
  pageUrl: string;
  referrer: string;
  landingQuery: Record<string, string>;
};

export function getBrowserMarketingContext(): BrowserMarketingContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const visitorId = ensureStorageId(window.localStorage, VISITOR_KEY);
  const sessionKey = ensureStorageId(window.sessionStorage, SESSION_KEY);

  return {
    visitorId,
    sessionKey,
    pagePath: `${window.location.pathname}${window.location.search}`,
    pageUrl: window.location.href,
    referrer: document.referrer || "",
    landingQuery: Object.fromEntries(new URLSearchParams(window.location.search).entries()),
  };
}

export function hasTrackedMarketingSession() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(SESSION_TRACKED_KEY) === "1";
}

export function markMarketingSessionTracked() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(SESSION_TRACKED_KEY, "1");
}

function ensureStorageId(storage: Storage, key: string) {
  const current = storage.getItem(key);

  if (current) {
    return current;
  }

  const next = crypto.randomUUID();
  storage.setItem(key, next);
  return next;
}
