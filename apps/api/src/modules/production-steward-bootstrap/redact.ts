import { createHash } from "node:crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function maskEmail(email: string | undefined | null): string | null {
  if (!email?.trim()) {
    return null;
  }
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at < 1) {
    return "***";
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain) {
    return "***";
  }
  const localMasked =
    local.length <= 2 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}***`;
  return `${localMasked}@${domain}`;
}

export function emailFingerprintSha256(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function assertNoSecretLeak(text: string): void {
  if (/mongodb(\+srv)?:\/\//i.test(text)) {
    throw new Error("Refusing to emit Mongo connection string material.");
  }
  if (/\$2[aby]\$\d{2}\$/i.test(text)) {
    throw new Error("Refusing to emit bcrypt hash material.");
  }
}
