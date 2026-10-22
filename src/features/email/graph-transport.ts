import { createHash, createSign, randomUUID, X509Certificate } from "node:crypto";

// Microsoft Graph sendMail with an Entra ID app that authenticates with a certificate
// (client credentials). Goes out over HTTPS, so DigitalOcean's SMTP port block doesn't apply.

export type GraphConfig = {
  tenantId: string;
  clientId: string;
  senderEmail: string;
  certificatePem: string;
  privateKeyPem: string;
};

export type GraphEmailInput = {
  senderName: string;
  replyToEmail?: string | null;
  to: string;
  subject: string;
  html: string;
  bccEmail?: string | null;
  headers?: Record<string, string>;
};

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const ASSERTION_LIFETIME_SECONDS = 600;
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

let cachedToken: { cacheKey: string; accessToken: string; expiresAt: number } | null = null;

// .env files keep PEM blocks on one line with literal "\n".
export function normalizePem(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

function base64Url(value: Buffer | string) {
  return (typeof value === "string" ? Buffer.from(value, "utf8") : value).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function getCertificateThumbprint(certificatePem: string) {
  const certificate = new X509Certificate(normalizePem(certificatePem));
  return base64Url(createHash("sha1").update(certificate.raw).digest());
}

export function buildClientAssertion(config: GraphConfig, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const header = { alg: "RS256", typ: "JWT", x5t: getCertificateThumbprint(config.certificatePem) };
  const payload = {
    aud: `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    iss: config.clientId,
    sub: config.clientId,
    jti: randomUUID(),
    nbf: issuedAt,
    iat: issuedAt,
    exp: issuedAt + ASSERTION_LIFETIME_SECONDS,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(normalizePem(config.privateKeyPem));

  return `${unsigned}.${base64Url(signature)}`;
}

export function buildGraphMessage(input: GraphEmailInput, senderEmail: string) {
  const replyTo = input.replyToEmail?.trim();
  const bcc = input.bccEmail?.trim();
  // Graph only accepts custom "X-" headers; anything else (e.g. List-Unsubscribe) is rejected.
  const internetMessageHeaders = Object.entries(input.headers ?? {})
    .filter(([name]) => /^x-/i.test(name))
    .map(([name, value]) => ({ name, value }));

  return {
    message: {
      subject: input.subject,
      body: { contentType: "HTML", content: input.html },
      from: { emailAddress: { address: senderEmail, name: input.senderName } },
      toRecipients: [{ emailAddress: { address: input.to } }],
      ...(bcc ? { bccRecipients: [{ emailAddress: { address: bcc } }] } : {}),
      ...(replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {}),
      ...(internetMessageHeaders.length > 0 ? { internetMessageHeaders } : {}),
    },
    saveToSentItems: false,
  };
}

async function readGraphError(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } | string; error_description?: string }
    | null;

  if (typeof payload?.error === "object") {
    return [payload.error.code, payload.error.message].filter(Boolean).join(": ");
  }

  return payload?.error_description || payload?.error || `HTTP ${response.status}`;
}

async function getAccessToken(config: GraphConfig) {
  const cacheKey = `${config.tenantId}:${config.clientId}`;

  if (cachedToken && cachedToken.cacheKey === cacheKey && cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return cachedToken.accessToken;
  }

  const response = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      scope: GRAPH_SCOPE,
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: buildClientAssertion(config),
    }),
  });

  if (!response.ok) {
    throw new Error(`Microsoft 365 rechazó la autenticación (${await readGraphError(response)}).`);
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { cacheKey, accessToken: payload.access_token, expiresAt: Date.now() + payload.expires_in * 1000 };

  return payload.access_token;
}

export async function sendGraphEmail(config: GraphConfig, input: GraphEmailInput) {
  const accessToken = await getAccessToken(config);
  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.senderEmail)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildGraphMessage(input, config.senderEmail)),
  });

  if (response.status === 401) {
    cachedToken = null;
  }

  if (response.status !== 202) {
    throw new Error(`Microsoft 365 no aceptó el email (${await readGraphError(response)}).`);
  }
}
