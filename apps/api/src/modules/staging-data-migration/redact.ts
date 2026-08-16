import { createHash } from "node:crypto";

import { AUTH_SECRET_FIELDS } from "./constants.js";

export function maskEmail(email: string | undefined | null): string | null {
  if (!email?.trim()) {
    return null;
  }
  const normalized = email.trim().toLowerCase();
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

export function emailFingerprint(email: string | undefined | null): string | null {
  if (!email?.trim()) {
    return null;
  }
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 12);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Strip secrets from an auth-like document before logging or snapshotting. */
export function redactAuthDocument<T extends Record<string, unknown>>(
  document: T,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document)) {
    if ((AUTH_SECRET_FIELDS as readonly string[]).includes(key)) {
      result[key] = "[REDACTED]";
      continue;
    }
    if (key === "email" && typeof value === "string") {
      result.emailMasked = maskEmail(value);
      result.emailFingerprint = emailFingerprint(value);
      continue;
    }
    result[key] = value;
  }
  return result;
}

export function stripSecretsForMigrationInsert(
  document: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...document };
  for (const field of AUTH_SECRET_FIELDS) {
    delete result[field];
  }
  delete result._id;
  return result;
}

export function assertNoConnectionStringLeak(text: string): void {
  if (/mongodb(\+srv)?:\/\//i.test(text)) {
    throw new Error("Refusing to emit Mongo connection string material.");
  }
}
