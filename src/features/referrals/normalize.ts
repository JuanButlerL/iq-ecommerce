import { randomInt } from "node:crypto";

export function normalizeTaxId(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

/** A DNI (7-8 digits) or a CUIL/CUIT (11 digits) of a person. */
export function isValidReferralTaxId(value: string) {
  return /^\d{7,8}$/.test(value) || /^\d{11}$/.test(value);
}

/**
 * The DNI inside a CUIL (20-12345678-3 -> 12345678), so the same person matches whether they typed
 * DNI or CUIL in different purchases.
 */
export function taxIdIdentity(value?: string | null) {
  const digits = normalizeTaxId(value);

  if (digits.length === 11) {
    return digits.slice(2, 10).replace(/^0+/, "");
  }

  return digits.replace(/^0+/, "");
}

/** Last 10 digits: drops +54, 9 and leading zeros so "011 15..." and "+54 9 11..." compare equal. */
export function normalizePhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 ? digits.slice(-10) : "";
}

export function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase() ?? "";
  const [local, domain] = email.split("@");

  if (!local || !domain) {
    return email;
  }

  // Gmail ignores dots and +tags: the same inbox must not count as a new customer.
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
  }

  return `${local.split("+")[0]}@${domain}`;
}

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Street + number + postal code, lowercase and without punctuation. Empty when there is no number. */
export function normalizeAddress(input: { addressLine?: string | null; addressNumber?: string | null; postalCode?: string | null }) {
  const street = stripAccents(input.addressLine ?? "")
    .toLowerCase()
    .replace(/\b(av|avda|avenida|calle|pje|pasaje)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "");
  const number = (input.addressNumber ?? "").replace(/\D/g, "");
  const postalCode = (input.postalCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!street || !number) {
    return "";
  }

  return `${street}|${number}|${postalCode}`;
}

export const REFERRAL_FRIEND_CODE_PATTERN = /^[A-Z0-9]{4,15}$/;

export function normalizeFriendCode(value: string) {
  return stripAccents(value).toUpperCase().replace(/[\s_-]+/g, "");
}

/** Suggestion shown in the portal: first name + 15, e.g. SOFI15. */
export function suggestFriendCode(firstName: string | null | undefined, percentage: number) {
  const base = stripAccents(firstName ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 10);

  return base.length >= 2 ? `${base}${Math.round(percentage)}` : "";
}

// No 0/O, 1/I/L: the credit code is typed by hand at checkout.
const CREDIT_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Personal credit code: 10 random characters (~49 bits), e.g. CRED-7KQ4M-2XP9H. */
export function generateCreditCode() {
  const chars = Array.from({ length: 10 }, () => CREDIT_CODE_ALPHABET[randomInt(CREDIT_CODE_ALPHABET.length)]).join("");
  return `CRED-${chars.slice(0, 5)}-${chars.slice(5)}`;
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");

  if (!local || !domain) {
    return "";
  }

  if (local.length <= 2) {
    return `${local.slice(0, 1)}***@${domain}`;
  }

  return `${local.slice(0, 1)}${"*".repeat(Math.min(Math.max(local.length - 2, 3), 8))}${local.slice(-1)}@${domain.toLowerCase()}`;
}
