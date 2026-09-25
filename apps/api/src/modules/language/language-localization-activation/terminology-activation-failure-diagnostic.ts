/**
 * Step 15D.12.4.4 — Sanitized durable Terminology activation failure diagnostics.
 *
 * Maps ephemeral soft-fail outcome reasons to allowlisted classification codes.
 * Never persists raw provider text, payloads, prompts, keys, or stack traces.
 */

import type {
  LanguageActivationTerminologyFailureCode,
  LanguageActivationTerminologyFailureCodeCount,
  LanguageActivationTerminologyProviderDiagnostic,
} from "@hu/types";

import type { LanguageOwnerFieldOutcome } from "../../language-preparation/language-owner-preparation.js";

export const LANGUAGE_ACTIVATION_TERMINOLOGY_FAILURE_CODES = [
  "model_not_found",
  "rate_limited",
  "unavailable",
  "timeout",
  "network_failure",
  "malformed_response",
  "validation_parse_failure",
  "not_configured",
  "safety_rejected",
  "unknown",
] as const satisfies readonly LanguageActivationTerminologyFailureCode[];

const ALLOWED_CODES: ReadonlySet<string> = new Set(
  LANGUAGE_ACTIVATION_TERMINOLOGY_FAILURE_CODES,
);

export function isLanguageActivationTerminologyFailureCode(
  value: unknown,
): value is LanguageActivationTerminologyFailureCode {
  return typeof value === "string" && ALLOWED_CODES.has(value);
}

/**
 * Classify a soft-fail / provider error message into an allowlisted code.
 * Unknown or unsafe text becomes `unknown` — the raw string is never returned.
 */
export function classifyTerminologyActivationFailureReason(
  reason: unknown,
): LanguageActivationTerminologyFailureCode {
  if (typeof reason !== "string") {
    return "unknown";
  }
  const text = reason.trim();
  if (!text) {
    return "unknown";
  }
  if (isLanguageActivationTerminologyFailureCode(text)) {
    return text;
  }

  const geminiHttp = /^Gemini HTTP (\d{3})$/i.exec(text);
  if (geminiHttp) {
    const status = Number(geminiHttp[1]);
    if (status === 404) {
      return "model_not_found";
    }
    if (status === 429) {
      return "rate_limited";
    }
    if (status === 401 || status === 403) {
      return "not_configured";
    }
    if (status >= 500 && status <= 599) {
      return "unavailable";
    }
    return "unavailable";
  }

  if (/^Gemini translation timed out$/i.test(text)) {
    return "timeout";
  }
  if (/^Gemini network failure$/i.test(text)) {
    return "network_failure";
  }
  if (/^Gemini response was not JSON$/i.test(text)) {
    return "malformed_response";
  }
  if (/^Gemini returned empty translation$/i.test(text)) {
    return "malformed_response";
  }
  if (/^Gemini rejected credentials$/i.test(text)) {
    return "not_configured";
  }
  if (/^TRANSLATION_PROVIDER=gemini but GEMINI_API_KEY is missing$/i.test(text)) {
    return "not_configured";
  }
  if (/^Gemini blocked the translation request$/i.test(text)) {
    return "safety_rejected";
  }
  if (/^Translation refused: content was not marked safety-cleared\.$/i.test(text)) {
    return "safety_rejected";
  }

  // Known owner-preparation structure/parse failures (exact / prefix allowlist).
  if (text === "Provider response JSON could not be parsed.") {
    return "validation_parse_failure";
  }
  if (text === "Provider response JSON root was not an object.") {
    return "validation_parse_failure";
  }
  if (/^Provider value for .+ must be a non-empty string\.$/.test(text)) {
    return "validation_parse_failure";
  }
  if (/^Provider omitted keys:/.test(text)) {
    return "validation_parse_failure";
  }
  if (/^Provider returned unexpected keys:/.test(text)) {
    return "validation_parse_failure";
  }

  // Hard config refuse strings used by owner preparation (message may include REFUSED: prefix stripped upstream).
  if (/^--execute requires TRANSLATION_PROVIDER=gemini\.$/i.test(text)) {
    return "not_configured";
  }
  if (/^read-only diagnostic cannot call the translation provider\.$/i.test(text)) {
    return "not_configured";
  }

  return "unknown";
}

/**
 * Aggregate failed Terminology outcomes into a durable sanitized diagnostic.
 */
export function aggregateTerminologyFailureDiagnostics(
  outcomes: readonly LanguageOwnerFieldOutcome[],
): LanguageActivationTerminologyProviderDiagnostic | null {
  const counts = new Map<LanguageActivationTerminologyFailureCode, number>();
  for (const row of outcomes) {
    if (row.outcome !== "failed") {
      continue;
    }
    const code = classifyTerminologyActivationFailureReason(row.reason);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  if (counts.size === 0) {
    return null;
  }
  const failureCodes: LanguageActivationTerminologyFailureCodeCount[] = [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.code.localeCompare(right.code);
    });
  return { failureCodes };
}

/**
 * Build a diagnostic from a single hard-fail / config failure message.
 */
export function terminologyProviderDiagnosticFromReason(
  reason: unknown,
  failedCount = 1,
): LanguageActivationTerminologyProviderDiagnostic {
  const code = classifyTerminologyActivationFailureReason(reason);
  return {
    failureCodes: [{ code, count: Math.max(1, failedCount) }],
  };
}

/**
 * Strip any non-allowlisted payload when loading historical / malformed docs.
 */
export function sanitizeTerminologyProviderDiagnostic(
  value: unknown,
): LanguageActivationTerminologyProviderDiagnostic | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const rawCodes = (value as { failureCodes?: unknown }).failureCodes;
  if (!Array.isArray(rawCodes) || rawCodes.length === 0) {
    return null;
  }
  const merged = new Map<LanguageActivationTerminologyFailureCode, number>();
  for (const entry of rawCodes) {
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const codeRaw = (entry as { code?: unknown }).code;
    const countRaw = (entry as { count?: unknown }).count;
    const code = isLanguageActivationTerminologyFailureCode(codeRaw)
      ? codeRaw
      : "unknown";
    const count =
      typeof countRaw === "number" && Number.isFinite(countRaw) && countRaw > 0
        ? Math.floor(countRaw)
        : 0;
    if (count <= 0) {
      continue;
    }
    merged.set(code, (merged.get(code) ?? 0) + count);
  }
  if (merged.size === 0) {
    return null;
  }
  const failureCodes: LanguageActivationTerminologyFailureCodeCount[] = [...merged.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.code.localeCompare(right.code);
    });
  return { failureCodes };
}

/** Operator-facing short summary, e.g. `model_not_found (23)`. */
export function formatTerminologyProviderDiagnosticSummary(
  diagnostic: LanguageActivationTerminologyProviderDiagnostic | null | undefined,
): string | null {
  if (!diagnostic || diagnostic.failureCodes.length === 0) {
    return null;
  }
  return diagnostic.failureCodes.map((row) => `${row.code} (${row.count})`).join(", ");
}
