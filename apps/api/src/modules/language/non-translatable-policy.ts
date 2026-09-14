/**
 * Pack 08J — central NON_TRANSLATABLE policy for automatic content translation.
 *
 * Automatic translation requires explicit exclusion, not enrollment.
 * Identity / private / technical values must never enter the provider payload.
 */

import { TranslationProviderError } from "./translation.config.js";

/** Exact field keys that automatic translation must never alter. */
export const NON_TRANSLATABLE_FIELD_KEYS = [
  // Identity
  "name",
  "displayName",
  "authorDisplayName",
  "participantName",
  "preferredName",
  "uniqueName",
  "username",
  "userName",
  "candidateName",
  "personName",
  "organizationName",
  "stewardId",
  "authorId",
  "authorUserId",
  "participantId",
  "memberId",
  // Technical identifiers
  "id",
  "uuid",
  "slug",
  "initiativeId",
  "petitionId",
  "commentId",
  "analysisId",
  "translationId",
  "sourceRecordId",
  "sourceVersion",
  "eventName",
  "eventId",
  "correlationId",
  "status",
  "statusCode",
  "lifecyclePhase",
  "visibility",
  "policy",
  "locale",
  "language",
  "languageCode",
  "countryCode",
  "contentType",
  "mimeType",
  // Contact / private
  "email",
  "emailAddress",
  "phone",
  "phoneNumber",
  "postalAddress",
  "address",
  "shippingAddress",
  "password",
  "token",
  "secret",
  "apiKey",
  "authCredential",
  "privateNote",
  "adminNote",
  // Machine / structural
  "url",
  "href",
  "path",
  "filePath",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "deletedAt",
  "timestamp",
  "latitude",
  "longitude",
  "coordinates",
  "amount",
  "currency",
  "metric",
] as const;

const NON_TRANSLATABLE_KEY_SET = new Set<string>(
  NON_TRANSLATABLE_FIELD_KEYS.map((key) => key.toLowerCase()),
);

/** Key suffixes that imply identity/technical values (case-insensitive). */
const NON_TRANSLATABLE_KEY_SUFFIXES = [
  "Id",
  "UUID",
  "Slug",
  "Email",
  "Phone",
  "Url",
  "URI",
  "Token",
  "Secret",
  "Password",
  "At", // createdAt, updatedAt, …
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/|mailto:|tel:)/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_RE = /^\+?[\d\s().-]{7,}$/;

export function isNonTranslatableFieldKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) {
    return true;
  }
  if (NON_TRANSLATABLE_KEY_SET.has(trimmed.toLowerCase())) {
    return true;
  }
  for (const suffix of NON_TRANSLATABLE_KEY_SUFFIXES) {
    if (trimmed.length > suffix.length && trimmed.endsWith(suffix)) {
      // Avoid treating prose keys like "whatAtStake" falsely — require Id/Email/etc.
      if (suffix === "At" && !/(created|updated|published|deleted|requested)At$/i.test(trimmed)) {
        continue;
      }
      return true;
    }
  }
  return false;
}

/**
 * Value-shape heuristics for accidental PII/technical leakage in prose bags.
 * Used as a hard stop before provider calls.
 */
export function looksLikeNonTranslatableValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (EMAIL_RE.test(trimmed)) {
    return true;
  }
  if (URL_RE.test(trimmed)) {
    return true;
  }
  if (UUID_RE.test(trimmed)) {
    return true;
  }
  if (PHONE_RE.test(trimmed) && /\d{3,}/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Strip NON_TRANSLATABLE keys from a presentation field bag.
 * Preserves all other string fields (AUTO_TRANSLATABLE by default).
 */
export function stripNonTranslatableKeys(
  fields: Readonly<Record<string, string>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string") {
      continue;
    }
    if (isNonTranslatableFieldKey(key)) {
      continue;
    }
    if (looksLikeNonTranslatableValue(value)) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Fail closed if a NON_TRANSLATABLE key or private-shaped value is about to
 * enter the automatic translation provider.
 */
export function assertSafeForAutomaticTranslation(
  fields: Readonly<Record<string, string>>,
): void {
  for (const [key, value] of Object.entries(fields)) {
    if (isNonTranslatableFieldKey(key)) {
      throw new TranslationProviderError(
        "forbidden",
        `NON_TRANSLATABLE_VIOLATION: field "${key}" must not enter automatic translation.`,
      );
    }
    if (typeof value === "string" && looksLikeNonTranslatableValue(value)) {
      throw new TranslationProviderError(
        "forbidden",
        `PRIVATE_DATA_TRANSLATION_ATTEMPT: field "${key}" value looks like protected data.`,
      );
    }
  }
}

/**
 * Pack 08J — eligible provider keys = projection keys minus NON_TRANSLATABLE.
 * Compatibility allowlist is unioned so existing CURRENT rows remain valid,
 * but new projection keys do not require a central allowlist edit.
 */
export function resolveAutomaticTranslationFieldKeys(input: {
  readonly sourceFields: Readonly<Record<string, string>>;
  readonly compatibilityAllowlist?: readonly string[];
}): readonly string[] {
  const fromProjection = Object.keys(input.sourceFields).filter(
    (key) => !isNonTranslatableFieldKey(key),
  );
  const fromAllowlist = (input.compatibilityAllowlist ?? []).filter(
    (key) => key in input.sourceFields && !isNonTranslatableFieldKey(key),
  );
  return [...new Set([...fromProjection, ...fromAllowlist])];
}
