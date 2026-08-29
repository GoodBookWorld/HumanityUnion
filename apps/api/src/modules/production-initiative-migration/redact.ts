import { createHash } from "node:crypto";

export function maskEmail(email: string | undefined | null): string | null {
  if (!email?.trim()) return null;
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at < 1) return "***";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain) return "***";
  const localMasked =
    local.length <= 2 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}***`;
  return `${localMasked}@${domain}`;
}

export function fingerprintSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Irreversible fingerprint for Stripe operational IDs — never log raw IDs. */
export function fingerprintStripeId(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return `sha256:${fingerprintSha256(value.trim()).slice(0, 16)}`;
}

export function assertNoSecretLeak(text: string): void {
  if (/mongodb(\+srv)?:\/\//i.test(text)) {
    throw new Error("Refusing to emit Mongo connection string material.");
  }
  if (/\$2[aby]\$\d{2}\$/i.test(text)) {
    throw new Error("Refusing to emit bcrypt hash material.");
  }
  if (/\bsk_(live|test)_/i.test(text) || /\bwhsec_/i.test(text)) {
    throw new Error("Refusing to emit Stripe secret material.");
  }
  if (/\bcs_(test|live)_/i.test(text) || /\bpi_(test|live)_/i.test(text)) {
    throw new Error("Refusing to emit raw Stripe operational IDs.");
  }
  if (/"shippingAddress"\s*:/i.test(text) || /"addressLine1"\s*:/i.test(text)) {
    throw new Error("Refusing to emit shipping address material.");
  }
}
