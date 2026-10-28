import crypto from "node:crypto";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Phone-like runs of 10+ digits with optional +, spaces, dashes, dots or brackets.
const PHONE_RE = /(?:\+?\d[\d\s().-]{8,}\d)/g;
const URL_RE = /\bhttps?:\/\/[^\s)]+|\b(?:www\.)?(?:linkedin\.com|github\.com)\/[^\s)]+/gi;

// Removes contact details BEFORE text is sent to the AI provider.
// Contacts are kept locally (masked for display, hashed for duplicate detection).
export function redactPII(text) {
  const emails = [...new Set(text.match(EMAIL_RE) || [])];
  const phones = [...new Set((text.match(PHONE_RE) || []).filter((p) => p.replace(/\D/g, "").length >= 10))];
  const links = [...new Set(text.match(URL_RE) || [])];

  let redacted = text.replace(EMAIL_RE, "[REDACTED_EMAIL]");
  for (const p of phones) redacted = redacted.split(p).join("[REDACTED_PHONE]");
  redacted = redacted.replace(URL_RE, "[REDACTED_LINK]");

  return { redacted, contacts: { emails, phones, links } };
}

export function maskEmail(email) {
  if (!email) return null;
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

export function maskPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return `${"*".repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}

export function hashIdentifier(value) {
  if (!value) return null;
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function buildContact({ emails, phones, links }) {
  return {
    email_masked: maskEmail(emails[0]),
    email_hash: hashIdentifier(emails[0]),
    phone_masked: maskPhone(phones[0]),
    links_count: links.length,
  };
}
