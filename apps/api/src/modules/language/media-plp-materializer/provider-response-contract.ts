/**
 * RESET 05E — PLP provider response contract + failure taxonomy.
 *
 * Safe structural metadata only — never prose, prompts, or secrets.
 */

export const PLP_PROVIDER_FAILURE_SUBTYPE = {
  HTTP_FAILURE: "HTTP_FAILURE",
  HTTP_TIMEOUT: "HTTP_TIMEOUT",
  EMPTY_RESPONSE: "EMPTY_RESPONSE",
  GEMINI_ENVELOPE_MISSING: "GEMINI_ENVELOPE_MISSING",
  CANDIDATE_MISSING: "CANDIDATE_MISSING",
  TEXT_PART_MISSING: "TEXT_PART_MISSING",
  TRUNCATED_RESPONSE: "TRUNCATED_RESPONSE",
  JSON_FENCE_EXTRACTION_FAILED: "JSON_FENCE_EXTRACTION_FAILED",
  JSON_PARSE_FAILED: "JSON_PARSE_FAILED",
  JSON_ROOT_NOT_OBJECT: "JSON_ROOT_NOT_OBJECT",
  EXPECTED_KEY_MISSING: "EXPECTED_KEY_MISSING",
  PATH_MAPPING_FAILED: "PATH_MAPPING_FAILED",
  SAFETY_BLOCKED: "SAFETY_BLOCKED",
  TOKEN_LIMIT_OR_FINISH_REASON: "TOKEN_LIMIT_OR_FINISH_REASON",
  UNKNOWN_PROVIDER_SHAPE: "UNKNOWN_PROVIDER_SHAPE",
  DUPLICATE_KEY: "DUPLICATE_KEY",
  BRAND_ARTIFACT: "BRAND_ARTIFACT",
  BATCH_INCOMPLETE: "BATCH_INCOMPLETE",
} as const;

export type PlpProviderFailureSubtype =
  (typeof PLP_PROVIDER_FAILURE_SUBTYPE)[keyof typeof PLP_PROVIDER_FAILURE_SUBTYPE];

export type PlpProviderEnvelopeMeta = {
  readonly httpStatus: number | null;
  readonly httpClass: string | null;
  readonly finishReason: string | null;
  readonly candidateCount: number;
  readonly textPartCount: number;
  readonly extractedLength: number;
  readonly expectedKeyCount: number;
  readonly returnedKeyCount: number;
  readonly missingKeyCount: number;
  readonly batchIndex: number | null;
  readonly batchCount: number | null;
  readonly failureSubtype: PlpProviderFailureSubtype | null;
};

export type PlpTranslationsContract = {
  readonly translations: readonly {
    readonly key: string;
    readonly value: string;
  }[];
};

/** Gemini responseSchema for the stable translations-array contract. */
export const PLP_GEMINI_TRANSLATIONS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
        },
        required: ["key", "value"],
      },
    },
  },
  required: ["translations"],
} as const;

export function encodePlpTranslationsContract(
  flat: Readonly<Record<string, string>>,
): PlpTranslationsContract {
  const translations = Object.keys(flat)
    .sort()
    .map((key) => ({ key, value: flat[key]! }));
  return { translations };
}

export function decodePlpTranslationsContract(parsed: unknown):
  | { readonly ok: true; readonly values: Record<string, string> }
  | {
      readonly ok: false;
      readonly subtype: PlpProviderFailureSubtype;
      readonly duplicateKeys?: readonly string[];
    } {
  if (parsed === null || parsed === undefined) {
    return { ok: false, subtype: PLP_PROVIDER_FAILURE_SUBTYPE.JSON_ROOT_NOT_OBJECT };
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, subtype: PLP_PROVIDER_FAILURE_SUBTYPE.JSON_ROOT_NOT_OBJECT };
  }
  const root = parsed as Record<string, unknown>;

  // Preferred contract.
  if (Array.isArray(root.translations)) {
    const values: Record<string, string> = {};
    const duplicates: string[] = [];
    for (const entry of root.translations) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return { ok: false, subtype: PLP_PROVIDER_FAILURE_SUBTYPE.PATH_MAPPING_FAILED };
      }
      const row = entry as Record<string, unknown>;
      if (typeof row.key !== "string" || typeof row.value !== "string") {
        return { ok: false, subtype: PLP_PROVIDER_FAILURE_SUBTYPE.PATH_MAPPING_FAILED };
      }
      if (Object.prototype.hasOwnProperty.call(values, row.key)) {
        duplicates.push(row.key);
        continue;
      }
      values[row.key] = row.value;
    }
    if (duplicates.length > 0) {
      return {
        ok: false,
        subtype: PLP_PROVIDER_FAILURE_SUBTYPE.DUPLICATE_KEY,
        duplicateKeys: duplicates,
      };
    }
    return { ok: true, values };
  }

  // Legacy/flat object: all string values.
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(root)) {
    if (typeof value !== "string") {
      return { ok: false, subtype: PLP_PROVIDER_FAILURE_SUBTYPE.UNKNOWN_PROVIDER_SHAPE };
    }
    values[key] = value;
  }
  return { ok: true, values };
}

export function httpStatusClass(status: number | null | undefined): string | null {
  if (status == null || !Number.isFinite(status)) {
    return null;
  }
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500 && status < 600) return "5xx";
  return "other";
}

/**
 * RESET 05E.2 — bounded safe HTTP/transport error class (no prose).
 */
export function classifyHttpTransportErrorClass(
  status: number | null | undefined,
): string | null {
  if (status == null || !Number.isFinite(status)) {
    return null;
  }
  if (status === 400) return "HTTP_400";
  if (status === 401) return "HTTP_401";
  if (status === 403) return "HTTP_403";
  if (status === 404) return "HTTP_404";
  if (status === 408) return "HTTP_408";
  if (status === 429) return "HTTP_429";
  if (status >= 500 && status < 600) return "HTTP_5XX";
  if (status >= 400 && status < 500) return "HTTP_4XX";
  return "UNKNOWN_TRANSPORT";
}

/** Classify fetch/network exceptions into safe ERROR_CLASS tokens. */
export function classifyNetworkTransportErrorClass(
  error: unknown,
): "TIMEOUT" | "ABORT" | "DNS" | "TLS" | "SOCKET" | "NETWORK" | "UNKNOWN_TRANSPORT" {
  if (error instanceof Error) {
    if (error.name === "AbortError" || /aborted/i.test(error.message)) {
      return "ABORT";
    }
    if (/timed?\s*out|TimeoutError/i.test(error.message) || error.name === "TimeoutError") {
      return "TIMEOUT";
    }
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|DNS/i.test(error.message)) {
      return "DNS";
    }
    if (/CERT_|SSL|TLS|UNABLE_TO_VERIFY/i.test(error.message)) {
      return "TLS";
    }
    if (/ECONNRESET|ECONNREFUSED|EPIPE|socket|UND_ERR/i.test(error.message)) {
      return "SOCKET";
    }
    if (/fetch failed|network|ECONN|ENETUNREACH/i.test(error.message)) {
      return "NETWORK";
    }
  }
  return "NETWORK";
}

/** Parse Retry-After header: delta-seconds only (ignore HTTP-date). */
export function parseRetryAfterSeconds(header: string | null | undefined): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const seconds = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(seconds, 3600);
}

/** Gemini error.status / reason — machine tokens only. */
export function sanitizeGeminiErrorToken(
  value: unknown,
  maxLen = 64,
): string | null {
  if (typeof value !== "string") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(Math.trunc(value));
    }
    return null;
  }
  const token = value.trim().toUpperCase().replace(/[^A-Z0-9_.-]/g, "");
  if (!token || token.length > maxLen) {
    return token ? token.slice(0, maxLen) : null;
  }
  return token;
}

/**
 * Bounded batching by key count + estimated output characters.
 * Provider concurrency stays 1; batches run sequentially.
 */
export function planPlpProviderBatches(
  flat: Readonly<Record<string, string>>,
  input?: {
    readonly maxKeysPerBatch?: number;
    readonly maxEstimatedOutputChars?: number;
  },
): readonly (Readonly<Record<string, string>>)[] {
  const maxKeys = input?.maxKeysPerBatch ?? 6;
  const maxChars = input?.maxEstimatedOutputChars ?? 10_000;
  const keys = Object.keys(flat).sort();
  if (keys.length === 0) {
    return [];
  }
  const batches: Record<string, string>[] = [];
  let current: Record<string, string> = {};
  let currentChars = 0;
  let currentKeys = 0;

  const flush = () => {
    if (currentKeys === 0) return;
    batches.push(current);
    current = {};
    currentChars = 0;
    currentKeys = 0;
  };

  for (const key of keys) {
    const value = flat[key]!;
    // Translation expansion budget (~1.4x) + JSON overhead.
    const estimated = Math.ceil((key.length + value.length) * 1.4) + 24;
    if (
      currentKeys > 0 &&
      (currentKeys >= maxKeys || currentChars + estimated > maxChars)
    ) {
      flush();
    }
    current[key] = value;
    currentChars += estimated;
    currentKeys += 1;
  }
  flush();
  return batches;
}

export function isPlpProviderFailureSubtypeRetryable(
  subtype: PlpProviderFailureSubtype | string | null | undefined,
): boolean {
  switch (subtype) {
    case PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_FAILURE:
    case PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_TIMEOUT:
    case PLP_PROVIDER_FAILURE_SUBTYPE.EMPTY_RESPONSE:
    case PLP_PROVIDER_FAILURE_SUBTYPE.GEMINI_ENVELOPE_MISSING:
    case PLP_PROVIDER_FAILURE_SUBTYPE.CANDIDATE_MISSING:
    case PLP_PROVIDER_FAILURE_SUBTYPE.TEXT_PART_MISSING:
    case PLP_PROVIDER_FAILURE_SUBTYPE.TRUNCATED_RESPONSE:
    case PLP_PROVIDER_FAILURE_SUBTYPE.JSON_FENCE_EXTRACTION_FAILED:
    case PLP_PROVIDER_FAILURE_SUBTYPE.JSON_PARSE_FAILED:
    case PLP_PROVIDER_FAILURE_SUBTYPE.JSON_ROOT_NOT_OBJECT:
    case PLP_PROVIDER_FAILURE_SUBTYPE.EXPECTED_KEY_MISSING:
    case PLP_PROVIDER_FAILURE_SUBTYPE.TOKEN_LIMIT_OR_FINISH_REASON:
    case PLP_PROVIDER_FAILURE_SUBTYPE.UNKNOWN_PROVIDER_SHAPE:
    case PLP_PROVIDER_FAILURE_SUBTYPE.BATCH_INCOMPLETE:
      return true;
    case PLP_PROVIDER_FAILURE_SUBTYPE.PATH_MAPPING_FAILED:
    case PLP_PROVIDER_FAILURE_SUBTYPE.SAFETY_BLOCKED:
    case PLP_PROVIDER_FAILURE_SUBTYPE.DUPLICATE_KEY:
    case PLP_PROVIDER_FAILURE_SUBTYPE.BRAND_ARTIFACT:
      return false;
    default:
      return true;
  }
}

export function classifyFinishReasonSubtype(
  finishReason: string | null | undefined,
): PlpProviderFailureSubtype | null {
  if (!finishReason) return null;
  const upper = finishReason.toUpperCase();
  if (upper.includes("MAX_TOKEN") || upper === "MAX_TOKENS") {
    return PLP_PROVIDER_FAILURE_SUBTYPE.TOKEN_LIMIT_OR_FINISH_REASON;
  }
  if (upper.includes("SAFETY") || upper.includes("BLOCK")) {
    return PLP_PROVIDER_FAILURE_SUBTYPE.SAFETY_BLOCKED;
  }
  if (upper.includes("RECITATION") || upper.includes("OTHER")) {
    return PLP_PROVIDER_FAILURE_SUBTYPE.TRUNCATED_RESPONSE;
  }
  return null;
}

/** Extract JSON object text; prefer fence strip, else first `{`…last `}`. */
export function extractJsonObjectText(raw: string):
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly subtype: PlpProviderFailureSubtype } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, subtype: PLP_PROVIDER_FAILURE_SUBTYPE.EMPTY_RESPONSE };
  }
  const fenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (fenced.startsWith("{") && fenced.endsWith("}")) {
    return { ok: true, text: fenced };
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return { ok: true, text: trimmed.slice(start, end + 1) };
  }
  return {
    ok: false,
    subtype: PLP_PROVIDER_FAILURE_SUBTYPE.JSON_FENCE_EXTRACTION_FAILED,
  };
}

export function emptyProviderEnvelopeMeta(
  partial?: Partial<PlpProviderEnvelopeMeta>,
): PlpProviderEnvelopeMeta {
  return {
    httpStatus: null,
    httpClass: null,
    finishReason: null,
    candidateCount: 0,
    textPartCount: 0,
    extractedLength: 0,
    expectedKeyCount: 0,
    returnedKeyCount: 0,
    missingKeyCount: 0,
    batchIndex: null,
    batchCount: null,
    failureSubtype: null,
    ...partial,
  };
}

export function formatProviderEnvelopeForensics(
  meta: PlpProviderEnvelopeMeta | null | undefined,
): string {
  if (!meta) return "";
  const parts: string[] = [];
  if (meta.failureSubtype) {
    parts.push(`PROVIDER_FAILURE_SUBTYPE=${meta.failureSubtype}`);
  }
  if (meta.httpClass) {
    parts.push(`PROVIDER_HTTP_CLASS=${meta.httpClass}`);
  }
  if (meta.finishReason) {
    parts.push(`PROVIDER_FINISH_REASON=${meta.finishReason}`);
  }
  parts.push(`PROVIDER_CANDIDATE_COUNT=${meta.candidateCount}`);
  parts.push(`PROVIDER_TEXT_PART_COUNT=${meta.textPartCount}`);
  parts.push(`PROVIDER_EXTRACTED_LENGTH=${meta.extractedLength}`);
  parts.push(`PROVIDER_EXPECTED_KEY_COUNT=${meta.expectedKeyCount}`);
  parts.push(`PROVIDER_RETURNED_KEY_COUNT=${meta.returnedKeyCount}`);
  parts.push(`PROVIDER_MISSING_KEY_COUNT=${meta.missingKeyCount}`);
  if (meta.batchIndex != null) {
    parts.push(`PROVIDER_BATCH_INDEX=${meta.batchIndex}`);
  }
  if (meta.batchCount != null) {
    parts.push(`PROVIDER_BATCH_COUNT=${meta.batchCount}`);
  }
  return parts.join(";");
}

/** Failures reopenable by the bounded current-consumer heal. */
export function isProviderResponseClassFailureReason(
  lastError: string | null | undefined,
  failureCode: string | null | undefined,
): boolean {
  return classifyProviderResponseRecoveryFailure(lastError, failureCode) != null;
}

/**
 * RESET 05E.1 — recovery generation for one-shot current-consumer reopen under
 * the structured provider contract. Prevents bootstrap restart budget resets.
 */
export const PLP_PROVIDER_CONTRACT_RECOVERY_GENERATION = "05E" as const;

export type ConsumerProviderRecoveryClass =
  | "PROVIDER_RESPONSE"
  | "LEGACY_PROVIDER_RESPONSE_FAILURE";

export type ConsumerProviderRecoveryIneligibleReason =
  | "NO_WORK_ROW"
  | "NOT_FAILED"
  | "VERSION_MISMATCH"
  | "USABLE_SNAPSHOT"
  | "RECOVERY_ALREADY_ATTEMPTED"
  | "STALE_OR_CANONICAL"
  | "INTEGRITY_OR_BRAND"
  | "NON_PROVIDER"
  | "NOT_PROVIDER_RESPONSE_CLASS";

/**
 * Classify whether a durable failure is a (legacy or current) provider-response
 * class safe for bounded current-consumer recovery. Never treats stale,
 * integrity/Brand, source/adapter, or deterministic validate failures as eligible.
 */
export function classifyProviderResponseRecoveryFailure(
  lastError: string | null | undefined,
  failureCode: string | null | undefined,
): ConsumerProviderRecoveryClass | null {
  const code = (failureCode ?? "").toUpperCase();
  const reason = (lastError ?? "").toUpperCase();

  // Explicit exclusions first.
  if (
    code === "STALE_CANONICAL_VERSION" ||
    code === "SOURCE_NOT_FOUND" ||
    code === "ADAPTER_OR_SOURCE" ||
    code === "PROVIDER_INTEGRITY" ||
    code === "PROVIDER_PAYLOAD" ||
    code === "PROVIDER_CAP" ||
    code === "REJECTED_PARTIAL" ||
    code === "PUBLISH_FAILED"
  ) {
    return null;
  }
  if (
    reason.includes("STALE_REVISION") ||
    reason.includes("STALE_CANONICAL_VERSION") ||
    reason.includes("STALE_ORIGIN_ID=") ||
    reason.includes("PROVIDER_INTEGRITY") ||
    reason.includes("BRAND_TOKEN_PRESERVATION_FAILED") ||
    reason.includes("BRAND_ARTIFACT") ||
    reason.includes("SOURCE_NOT_FOUND") ||
    reason.includes("ADAPTER_OR_SOURCE") ||
    reason.includes("REJECTED_PARTIAL")
  ) {
    return null;
  }

  // Current 05E structured taxonomy.
  if (
    reason.includes("PROVIDER_FAILURE_SUBTYPE=") ||
    reason.includes("PROVIDER_HTTP_CLASS=") ||
    reason.includes("PROVIDER_FINISH_REASON=")
  ) {
    return "PROVIDER_RESPONSE";
  }

  // Structured codes that are provider-response class.
  if (
    code === "PROVIDER_FAILURE" ||
    code === "PROVIDER_TIMEOUT" ||
    code === "PROVIDER_PARTIAL"
  ) {
    // PARTIAL that is really integrity/Brand already excluded above.
    const hasModernForensics =
      reason.includes("PROVIDER_FAILURE_SUBTYPE=") ||
      reason.includes("PROVIDER_BATCH_COUNT=");
    return hasModernForensics
      ? "PROVIDER_RESPONSE"
      : "LEGACY_PROVIDER_RESPONSE_FAILURE";
  }

  // Legacy pre-05E shapes (safe subset).
  if (
    reason.includes("PROVIDER_RESPONSE_SHAPE=INVALID") ||
    reason.includes("PROVIDER_FAILURE") ||
    reason.includes("PROVIDER_TIMEOUT") ||
    reason.includes("PROVIDER_PARTIAL") ||
    reason.includes("PARSE_FAILURE") ||
    reason.includes("WRONG_TARGET_LANGUAGE") ||
    reason.includes("MISSING_PATH") ||
    reason.includes("MISSING_MACHINE_PATHS=") ||
    reason.includes("JSON_PARSE") ||
    reason.includes("EMPTY_RESPONSE") ||
    reason.includes("TOKEN_LIMIT") ||
    reason.includes("TRUNCATED") ||
    reason.includes("MALFORMED")
  ) {
    return "LEGACY_PROVIDER_RESPONSE_FAILURE";
  }

  return null;
}

export function classifyConsumerProviderRecoveryEligibility(input: {
  readonly work: {
    readonly status: string;
    readonly canonicalVersion: string;
    readonly lastError: string | null;
    readonly failureCode: string | null;
    readonly recoveryGeneration: string | null;
  } | null;
  readonly liveCanonicalVersion: string;
  readonly hasUsableSnapshot: boolean;
}):
  | {
      readonly eligible: true;
      readonly recoveryClass: ConsumerProviderRecoveryClass;
      readonly recoveryGeneration: typeof PLP_PROVIDER_CONTRACT_RECOVERY_GENERATION;
      readonly alreadyAttempted: false;
      readonly ineligibleReason: null;
    }
  | {
      readonly eligible: false;
      readonly recoveryClass: null;
      readonly recoveryGeneration: string | null;
      readonly alreadyAttempted: boolean;
      readonly ineligibleReason: ConsumerProviderRecoveryIneligibleReason;
    } {
  const work = input.work;
  if (!work) {
    return {
      eligible: false,
      recoveryClass: null,
      recoveryGeneration: null,
      alreadyAttempted: false,
      ineligibleReason: "NO_WORK_ROW",
    };
  }
  const alreadyAttempted =
    work.recoveryGeneration === PLP_PROVIDER_CONTRACT_RECOVERY_GENERATION;
  if (input.hasUsableSnapshot) {
    return {
      eligible: false,
      recoveryClass: null,
      recoveryGeneration: work.recoveryGeneration,
      alreadyAttempted,
      ineligibleReason: "USABLE_SNAPSHOT",
    };
  }
  if (work.status !== "failed") {
    return {
      eligible: false,
      recoveryClass: null,
      recoveryGeneration: work.recoveryGeneration,
      alreadyAttempted,
      ineligibleReason: "NOT_FAILED",
    };
  }
  if (work.canonicalVersion !== input.liveCanonicalVersion) {
    return {
      eligible: false,
      recoveryClass: null,
      recoveryGeneration: work.recoveryGeneration,
      alreadyAttempted,
      ineligibleReason: "VERSION_MISMATCH",
    };
  }
  if (alreadyAttempted) {
    return {
      eligible: false,
      recoveryClass: null,
      recoveryGeneration: work.recoveryGeneration,
      alreadyAttempted: true,
      ineligibleReason: "RECOVERY_ALREADY_ATTEMPTED",
    };
  }

  const recoveryClass = classifyProviderResponseRecoveryFailure(
    work.lastError,
    work.failureCode,
  );
  if (!recoveryClass) {
    const code = (work.failureCode ?? "").toUpperCase();
    const reason = (work.lastError ?? "").toUpperCase();
    let ineligibleReason: ConsumerProviderRecoveryIneligibleReason =
      "NOT_PROVIDER_RESPONSE_CLASS";
    if (
      code === "STALE_CANONICAL_VERSION" ||
      reason.includes("STALE_REVISION") ||
      reason.includes("STALE_CANONICAL")
    ) {
      ineligibleReason = "STALE_OR_CANONICAL";
    } else if (
      code === "PROVIDER_INTEGRITY" ||
      reason.includes("BRAND_TOKEN") ||
      reason.includes("PROVIDER_INTEGRITY")
    ) {
      ineligibleReason = "INTEGRITY_OR_BRAND";
    } else if (
      code === "SOURCE_NOT_FOUND" ||
      code === "ADAPTER_OR_SOURCE" ||
      code === "REJECTED_PARTIAL" ||
      code === "PUBLISH_FAILED"
    ) {
      ineligibleReason = "NON_PROVIDER";
    }
    return {
      eligible: false,
      recoveryClass: null,
      recoveryGeneration: work.recoveryGeneration,
      alreadyAttempted: false,
      ineligibleReason,
    };
  }

  return {
    eligible: true,
    recoveryClass,
    recoveryGeneration: PLP_PROVIDER_CONTRACT_RECOVERY_GENERATION,
    alreadyAttempted: false,
    ineligibleReason: null,
  };
}
