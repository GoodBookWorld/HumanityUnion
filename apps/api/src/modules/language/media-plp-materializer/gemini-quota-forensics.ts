/**
 * RESET 05E.3 — safe Gemini 429 / RESOURCE_EXHAUSTED quota forensics.
 *
 * Parses ONLY structural error.details fields. Never persists prose, keys,
 * project identity, raw bodies, or content.
 */

import { sanitizeGeminiErrorToken } from "./provider-response-contract.js";

export const PLP_PROVIDER_QUOTA_CLASS = {
  RATE_WINDOW: "RATE_WINDOW",
  TOKEN_RATE: "TOKEN_RATE",
  DAILY_QUOTA: "DAILY_QUOTA",
  MODEL_QUOTA: "MODEL_QUOTA",
  PROJECT_QUOTA: "PROJECT_QUOTA",
  UNKNOWN_QUOTA: "UNKNOWN_QUOTA",
} as const;

export type PlpProviderQuotaClass =
  (typeof PLP_PROVIDER_QUOTA_CLASS)[keyof typeof PLP_PROVIDER_QUOTA_CLASS];

export type GeminiQuotaForensics = {
  readonly quotaClass: PlpProviderQuotaClass;
  readonly quotaMetric: string | null;
  readonly quotaLimitId: string | null;
  /** Prefer RetryInfo; else header Retry-After. */
  readonly quotaRetryDelaySeconds: number | null;
  readonly geminiErrorReason: string | null;
};

const TYPE_QUOTA_FAILURE = "type.googleapis.com/google.rpc.QuotaFailure";
const TYPE_RETRY_INFO = "type.googleapis.com/google.rpc.RetryInfo";
const TYPE_ERROR_INFO = "type.googleapis.com/google.rpc.ErrorInfo";

/** Short rate-window cooldown caps (seconds). */
const RATE_WINDOW_DEFAULT_S = 60;
const RATE_WINDOW_MAX_S = 900;
/** Long quota cooldown caps (seconds). */
const LONG_QUOTA_DEFAULT_S = 3_600;
const LONG_QUOTA_MAX_S = 86_400;
/** Unknown / insufficient metadata. */
const UNKNOWN_QUOTA_DEFAULT_S = 120;
const UNKNOWN_QUOTA_MAX_S = 1_800;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function detailType(detail: Record<string, unknown>): string {
  const raw = detail["@type"];
  return typeof raw === "string" ? raw : "";
}

/**
 * Parse google.protobuf.Duration-ish retryDelay: "34s", "1.5s", or {seconds,nanos}.
 * Caps at 24h. Never returns negative.
 */
export function parseGeminiRetryDelaySeconds(value: unknown): number | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)s$/i);
    if (!match?.[1]) {
      return null;
    }
    const seconds = Number.parseFloat(match[1]);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return null;
    }
    return Math.min(Math.ceil(seconds), LONG_QUOTA_MAX_S);
  }
  if (isRecord(value)) {
    const secondsRaw = value.seconds;
    const nanosRaw = value.nanos;
    const seconds =
      typeof secondsRaw === "number"
        ? secondsRaw
        : typeof secondsRaw === "string"
          ? Number.parseFloat(secondsRaw)
          : NaN;
    const nanos =
      typeof nanosRaw === "number"
        ? nanosRaw
        : typeof nanosRaw === "string"
          ? Number.parseFloat(nanosRaw)
          : 0;
    if (!Number.isFinite(seconds) || seconds < 0) {
      return null;
    }
    const total = seconds + (Number.isFinite(nanos) && nanos > 0 ? nanos / 1e9 : 0);
    return Math.min(Math.ceil(total), LONG_QUOTA_MAX_S);
  }
  return null;
}

/** Sanitize quota metric / limit id — tokens only, strip project-ish fragments. */
export function sanitizeQuotaIdentifier(
  value: unknown,
  maxLen = 128,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  let token = value
    .trim()
    .replace(/projects\/[a-z0-9_-]+/gi, "projects/[redacted]")
    .replace(/[^=A-Za-z0-9_./:-]/g, "");
  if (!token) {
    return null;
  }
  if (token.length > maxLen) {
    token = token.slice(0, maxLen);
  }
  return token;
}

function classifyQuotaIdAndMetric(
  quotaId: string | null,
  quotaMetric: string | null,
): PlpProviderQuotaClass {
  const hay = `${quotaId ?? ""} ${quotaMetric ?? ""}`.toUpperCase();
  if (!hay.trim()) {
    return PLP_PROVIDER_QUOTA_CLASS.UNKNOWN_QUOTA;
  }
  if (/PERDAY|DAILY|DAY_/.test(hay) || /\/DAY\b|_DAY_/.test(hay)) {
    return PLP_PROVIDER_QUOTA_CLASS.DAILY_QUOTA;
  }
  if (/TOKEN|TPM|TOKENS_PER/.test(hay)) {
    if (/PERMINUTE|PER_MINUTE|PERSECOND|PER_SECOND|RPM|RPD/.test(hay)) {
      return PLP_PROVIDER_QUOTA_CLASS.TOKEN_RATE;
    }
    return PLP_PROVIDER_QUOTA_CLASS.TOKEN_RATE;
  }
  if (/PERMINUTE|PER_MINUTE|PERSECOND|PER_SECOND|\bRPM\b|RATE/.test(hay)) {
    return PLP_PROVIDER_QUOTA_CLASS.RATE_WINDOW;
  }
  if (/PERPROJECT|PER_PROJECT|PROJECT/.test(hay) && !/PERMODEL|PER_MODEL|MODEL/.test(hay)) {
    return PLP_PROVIDER_QUOTA_CLASS.PROJECT_QUOTA;
  }
  if (/PERMODEL|PER_MODEL|MODEL/.test(hay)) {
    // Model-scoped without day/minute → treat as model quota (often longer-lived).
    return PLP_PROVIDER_QUOTA_CLASS.MODEL_QUOTA;
  }
  return PLP_PROVIDER_QUOTA_CLASS.UNKNOWN_QUOTA;
}

/**
 * Extract safe quota forensics from a Gemini error object (already parsed JSON).
 */
export function extractGeminiQuotaForensics(input: {
  readonly error?: {
    readonly status?: unknown;
    readonly code?: unknown;
    readonly details?: unknown;
    readonly message?: unknown;
  } | null;
  readonly httpStatus?: number | null;
  readonly retryAfterHeaderSeconds?: number | null;
}): GeminiQuotaForensics | null {
  const statusToken = sanitizeGeminiErrorToken(input.error?.status);
  const is429 = input.httpStatus === 429;
  const isResourceExhausted =
    statusToken === "RESOURCE_EXHAUSTED" ||
    sanitizeGeminiErrorToken(input.error?.code) === "RESOURCE_EXHAUSTED";
  if (!is429 && !isResourceExhausted) {
    return null;
  }

  const details = Array.isArray(input.error?.details) ? input.error!.details! : [];
  let quotaMetric: string | null = null;
  let quotaLimitId: string | null = null;
  let retryDelaySeconds: number | null = null;
  let errorInfoReason: string | null = null;

  for (const raw of details) {
    if (!isRecord(raw)) {
      continue;
    }
    const type = detailType(raw);
    if (type === TYPE_RETRY_INFO || type.endsWith(".RetryInfo")) {
      const delay =
        parseGeminiRetryDelaySeconds(raw.retryDelay) ??
        parseGeminiRetryDelaySeconds(raw.retry_delay);
      if (delay != null) {
        retryDelaySeconds = delay;
      }
      continue;
    }
    if (type === TYPE_ERROR_INFO || type.endsWith(".ErrorInfo")) {
      errorInfoReason = sanitizeGeminiErrorToken(raw.reason);
      continue;
    }
    if (type === TYPE_QUOTA_FAILURE || type.endsWith(".QuotaFailure")) {
      const violations = Array.isArray(raw.violations) ? raw.violations : [];
      for (const violation of violations) {
        if (!isRecord(violation)) {
          continue;
        }
        if (!quotaMetric) {
          quotaMetric = sanitizeQuotaIdentifier(violation.quotaMetric);
        }
        if (!quotaLimitId) {
          quotaLimitId = sanitizeQuotaIdentifier(violation.quotaId);
        }
        // Dimensions: keep only model/location tokens — never project/billing ids.
        if (isRecord(violation.quotaDimensions)) {
          const model = sanitizeQuotaIdentifier(violation.quotaDimensions.model, 64);
          const location = sanitizeQuotaIdentifier(
            violation.quotaDimensions.location,
            32,
          );
          void model;
          void location;
        }
      }
    }
  }

  // Never scrape free-form error.message for content — only accept structured delay.
  const headerDelay =
    input.retryAfterHeaderSeconds != null &&
    Number.isFinite(input.retryAfterHeaderSeconds) &&
    input.retryAfterHeaderSeconds > 0
      ? Math.min(Math.trunc(input.retryAfterHeaderSeconds), LONG_QUOTA_MAX_S)
      : null;

  const quotaClass = classifyQuotaIdAndMetric(quotaLimitId, quotaMetric);
  const resolvedDelay =
    retryDelaySeconds ?? headerDelay ?? null;

  return {
    quotaClass,
    quotaMetric,
    quotaLimitId,
    quotaRetryDelaySeconds: resolvedDelay,
    geminiErrorReason:
      errorInfoReason ?? statusToken ?? sanitizeGeminiErrorToken(input.error?.code),
  };
}

/**
 * Compute durable cooldown duration (seconds) from quota class + RetryInfo.
 * Conservative: long classes never use short tight loops.
 */
export function resolveQuotaCooldownSeconds(input: {
  readonly quotaClass: PlpProviderQuotaClass;
  readonly quotaRetryDelaySeconds?: number | null;
}): number {
  const provided =
    input.quotaRetryDelaySeconds != null &&
    Number.isFinite(input.quotaRetryDelaySeconds) &&
    input.quotaRetryDelaySeconds > 0
      ? Math.trunc(input.quotaRetryDelaySeconds)
      : null;

  switch (input.quotaClass) {
    case PLP_PROVIDER_QUOTA_CLASS.RATE_WINDOW:
    case PLP_PROVIDER_QUOTA_CLASS.TOKEN_RATE:
      return Math.min(
        Math.max(provided ?? RATE_WINDOW_DEFAULT_S, 15),
        RATE_WINDOW_MAX_S,
      );
    case PLP_PROVIDER_QUOTA_CLASS.DAILY_QUOTA:
    case PLP_PROVIDER_QUOTA_CLASS.PROJECT_QUOTA:
    case PLP_PROVIDER_QUOTA_CLASS.MODEL_QUOTA: {
      // Prefer provider delay when long; otherwise floor at 1h.
      const floor = LONG_QUOTA_DEFAULT_S;
      return Math.min(Math.max(provided ?? floor, floor), LONG_QUOTA_MAX_S);
    }
    case PLP_PROVIDER_QUOTA_CLASS.UNKNOWN_QUOTA:
    default:
      return Math.min(
        Math.max(provided ?? UNKNOWN_QUOTA_DEFAULT_S, UNKNOWN_QUOTA_DEFAULT_S),
        UNKNOWN_QUOTA_MAX_S,
      );
  }
}

export function isQuotaExhaustionTransport(input: {
  readonly httpStatus?: number | null;
  readonly errorClass?: string | null;
  readonly geminiErrorStatus?: string | null;
  readonly quotaClass?: string | null;
}): boolean {
  if (input.httpStatus === 429) return true;
  if (input.errorClass === "HTTP_429") return true;
  if (input.errorClass === "PROVIDER_COOLDOWN") return true;
  if (input.geminiErrorStatus === "RESOURCE_EXHAUSTED") return true;
  if (input.quotaClass && input.quotaClass !== "") return true;
  return false;
}
