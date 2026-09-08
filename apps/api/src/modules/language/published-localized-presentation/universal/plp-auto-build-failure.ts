/**
 * RESET 05C.3 / 05D.5 — structured PLP auto-build failure contract.
 *
 * safeReason never includes bodies, prompts, secrets, URIs, or private data.
 * RESET 05D.5 — forensics-first encoding; generic PARTIAL is not retryable.
 */

import {
  isProviderPartialSubtypeRetryable,
  type ProviderPartialSubreason,
} from "../../media-plp-materializer/provider-boundary-forensics.js";
import { isPlpProviderFailureSubtypeRetryable } from "../../media-plp-materializer/provider-response-contract.js";
import {
  encodePlpStructuredStaleSafeReason,
  parsePlpStructuredStaleFromSafeReason,
  PLP_STALE_ORIGIN,
  type PlpStructuredStaleDetail,
} from "./plp-stale-result.js";

export type PlpAutoBuildFailureCode =
  | "PROCESSOR_DORMANT"
  | "SOURCE_NOT_FOUND"
  | "ADAPTER_OR_SOURCE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_FAILURE"
  | "PROVIDER_PARTIAL"
  | "PROVIDER_INTEGRITY"
  | "PROVIDER_PAYLOAD"
  | "PROVIDER_CAP"
  | "REJECTED_PARTIAL"
  | "PUBLISH_FAILED"
  | "STALE_CANONICAL_VERSION"
  | "UNKNOWN";

export type PlpAutoBuildFailureStage =
  | "processor"
  | "adapter"
  | "source"
  | "provider"
  | "validate"
  | "publish"
  | "durability";

export type PlpAutoBuildStructuredFailure = {
  readonly failureCode: PlpAutoBuildFailureCode;
  readonly retryable: boolean;
  readonly safeReason: string;
  readonly stage: PlpAutoBuildFailureStage;
};

export type ProcessPlpBuildRequestResult =
  | {
      readonly status: "COMPLETED" | "SKIPPED_USABLE" | "SUPERSEDED" | "QUEUED";
      readonly failure?: undefined;
    }
  | {
      readonly status: "FAILED";
      readonly failure: PlpAutoBuildStructuredFailure;
    };

const FORENSIC_KEYS = [
  "PROVIDER_PARTIAL_SUBREASON",
  "PROVIDER_RESPONSE_SHAPE",
  "PROVIDER_FAILURE_SUBTYPE",
  "PROVIDER_HTTP_CLASS",
  "PROVIDER_HTTP_STATUS",
  "PROVIDER_ERROR_CLASS",
  "PROVIDER_ERROR_CODE",
  "PROVIDER_RETRY_AFTER",
  "PROVIDER_GEMINI_ERROR_STATUS",
  "PROVIDER_GEMINI_ERROR_REASON",
  "PROVIDER_FINISH_REASON",
  "PROVIDER_CANDIDATE_COUNT",
  "PROVIDER_TEXT_PART_COUNT",
  "PROVIDER_EXTRACTED_LENGTH",
  "PROVIDER_EXPECTED_KEY_COUNT",
  "PROVIDER_RETURNED_KEY_COUNT",
  "PROVIDER_MISSING_KEY_COUNT",
  "PROVIDER_BATCH_INDEX",
  "PROVIDER_BATCH_COUNT",
  "BRAND_TOKEN_PATHS",
  "PATH_STATES",
  "MISSING_MACHINE_PATHS",
  "EXPECTED_MACHINE_PATHS",
  "UNEXPECTED_MACHINE_PATHS",
  "STALE_ORIGIN_ID",
  "STALE_WORK_VERSION",
  "STALE_CURRENT_SOURCE_VERSION",
  "STALE_BOUNDARY",
  "STALE_AUTHORITY",
  "STALE_WORK_CONTENT_REVISION",
  "STALE_EXISTING_CONTENT_REVISION",
  "STALE_CANDIDATE_VERSION",
  "STALE_EXISTING_SNAPSHOT_VERSION",
] as const;

/**
 * Safe reason codes only — strip URLs, payloads, long blobs.
 * RESET 05D.5 — preserve structured forensic key=value segments; truncate prose.
 */
export function sanitizePlpAutoBuildFailureReason(reason: string): string {
  const trimmed = reason.trim();
  if (!trimmed) {
    return "UNKNOWN";
  }

  const segments = trimmed.split(";").map((s) => s.trim()).filter(Boolean);
  const forensic: string[] = [];
  const other: string[] = [];
  for (const seg of segments) {
    const key = seg.split("=")[0] ?? "";
    const isForensic =
      FORENSIC_KEYS.includes(key as (typeof FORENSIC_KEYS)[number]) ||
      /^(PROVIDER_PARTIAL|PROVIDER_INTEGRITY|PROVIDER_FAILURE|PROVIDER_TIMEOUT|PROVIDER_PAYLOAD|PROVIDER_CAP|PARTIAL|PARSE_FAILURE|BRAND_TOKEN_PRESERVATION_FAILED|CONTENT_INTEGRITY_FAILURE|WRONG_TARGET_LANGUAGE|TIMEOUT|PAYLOAD_LIMIT|STALE_REVISION|STALE_CANONICAL_VERSION)(:|$)/.test(
        seg,
      );
    if (isForensic) {
      forensic.push(seg);
    } else {
      other.push(seg);
    }
  }

  const scrub = (value: string) =>
    value
      .replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, "[redacted]")
      .replace(/https?:\/\/[^\s"']+/gi, "[redacted-url]")
      // Do not redact forensic path inventories (may contain long joined tokens).
      .replace(/\s+/g, " ")
      .trim();

  const forensicBlock = scrub(forensic.join(";")).slice(0, 700);
  const proseBlock = scrub(other.join(";")).slice(0, 120);
  const combined = [forensicBlock, proseBlock].filter(Boolean).join(";");
  return combined.slice(0, 800) || "UNKNOWN";
}

export function structuredFailure(input: {
  readonly failureCode: PlpAutoBuildFailureCode;
  readonly retryable: boolean;
  readonly stage: PlpAutoBuildFailureStage;
  readonly safeReason: string;
}): PlpAutoBuildStructuredFailure {
  return {
    failureCode: input.failureCode,
    retryable: input.retryable,
    stage: input.stage,
    safeReason: sanitizePlpAutoBuildFailureReason(input.safeReason),
  };
}

function extractForensicBlock(message: string): string {
  const segments = message.split(";").map((s) => s.trim()).filter(Boolean);
  return segments
    .filter((seg) => {
      const key = seg.split("=")[0] ?? "";
      return (
        FORENSIC_KEYS.includes(key as (typeof FORENSIC_KEYS)[number]) ||
        /^(PROVIDER_PARTIAL_SUBREASON|BRAND_TOKEN_PATHS|PATH_STATES)=/.test(seg)
      );
    })
    .join(";");
}

function extractPartialSubreason(
  message: string,
): ProviderPartialSubreason | null {
  const fromKey = message.match(
    /PROVIDER_PARTIAL_SUBREASON=([A-Z_]+)/,
  )?.[1] as ProviderPartialSubreason | undefined;
  if (fromKey) {
    return fromKey;
  }
  if (/MISSING_PATH/.test(message)) return "MISSING_PATH";
  if (/EMPTY_VALUE/.test(message)) return "EMPTY_VALUE";
  if (/WRONG_TARGET_LANGUAGE/.test(message)) return "WRONG_TARGET_LANGUAGE";
  if (/PATH_MAPPING_FAILURE/.test(message)) return "PATH_MAPPING_FAILURE";
  if (/PARSE_FAILURE/.test(message)) return "PARSE_FAILURE";
  if (/CONTENT_INTEGRITY/.test(message)) return "CONTENT_INTEGRITY_FAILURE";
  return null;
}

export function mapProviderBoundaryReasonToFailure(input: {
  readonly reason: string;
  readonly message: string;
}): PlpAutoBuildStructuredFailure {
  const reason = input.reason.toUpperCase();
  const msg = input.message.trim();
  const forensics = extractForensicBlock(msg);

  if (reason === "TIMEOUT") {
    return structuredFailure({
      failureCode: "PROVIDER_TIMEOUT",
      retryable: true,
      stage: "provider",
      safeReason: forensics
        ? `PROVIDER_TIMEOUT;${forensics}`
        : "PROVIDER_TIMEOUT",
    });
  }

  if (reason === "PARTIAL") {
    const sub =
      extractPartialSubreason(msg) ?? ("OTHER_STRUCTURAL_FAILURE" as const);
    return structuredFailure({
      failureCode: "PROVIDER_PARTIAL",
      retryable: isProviderPartialSubtypeRetryable(sub),
      stage: "provider",
      safeReason: [
        `PROVIDER_PARTIAL:${sub}`,
        `PROVIDER_PARTIAL_SUBREASON=${sub}`,
        forensics,
      ]
        .filter(Boolean)
        .join(";"),
    });
  }

  if (reason === "PARSE_FAILURE") {
    const subtypeMatch = msg.match(/PROVIDER_FAILURE_SUBTYPE=([A-Z_]+)/)?.[1];
    const retryable = isPlpProviderFailureSubtypeRetryable(subtypeMatch);
    return structuredFailure({
      failureCode: "PROVIDER_FAILURE",
      retryable,
      stage: "provider",
      safeReason: forensics
        ? `PROVIDER_FAILURE:PARSE_FAILURE;PROVIDER_PARTIAL_SUBREASON=PARSE_FAILURE;${forensics}`
        : "PROVIDER_FAILURE:PARSE_FAILURE;PROVIDER_PARTIAL_SUBREASON=PARSE_FAILURE",
    });
  }

  if (reason === "WRONG_TARGET_LANGUAGE") {
    return structuredFailure({
      failureCode: "PROVIDER_PARTIAL",
      retryable: true,
      stage: "provider",
      safeReason: [
        "PROVIDER_PARTIAL:WRONG_TARGET_LANGUAGE",
        "PROVIDER_PARTIAL_SUBREASON=WRONG_TARGET_LANGUAGE",
        forensics,
      ]
        .filter(Boolean)
        .join(";"),
    });
  }

  if (reason === "LOCALIZATION_CONTENT_INTEGRITY_FAILED") {
    return structuredFailure({
      failureCode: "PROVIDER_INTEGRITY",
      retryable: false,
      stage: "provider",
      safeReason: forensics
        ? `PROVIDER_INTEGRITY:CONTENT_INTEGRITY_FAILURE;${forensics}`
        : "PROVIDER_INTEGRITY:LOCALIZATION_CONTENT_INTEGRITY_FAILED",
    });
  }

  if (reason === "BRAND_TOKEN_PRESERVATION_FAILED") {
    // Must always retain at least one concrete path when forensics present.
    return structuredFailure({
      failureCode: "PROVIDER_INTEGRITY",
      retryable: false,
      stage: "provider",
      safeReason: forensics
        ? `PROVIDER_INTEGRITY:BRAND_TOKEN_PRESERVATION_FAILED;${forensics}`
        : "PROVIDER_INTEGRITY:BRAND_TOKEN_PRESERVATION_FAILED;BRAND_TOKEN_PATHS=UNKNOWN:UNMAPPABLE",
    });
  }

  if (reason === "PAYLOAD_LIMIT") {
    return structuredFailure({
      failureCode: "PROVIDER_PAYLOAD",
      retryable: false,
      stage: "provider",
      safeReason: "PROVIDER_PAYLOAD:PAYLOAD_LIMIT",
    });
  }

  if (reason === "PROVIDER_CALL_CAP") {
    return structuredFailure({
      failureCode: "PROVIDER_CAP",
      retryable: false,
      stage: "provider",
      safeReason: "PROVIDER_CAP:PROVIDER_CALL_CAP",
    });
  }

  if (reason === "PROVIDER_FAILURE") {
    const subtypeMatch = msg.match(/PROVIDER_FAILURE_SUBTYPE=([A-Z_]+)/)?.[1];
    return structuredFailure({
      failureCode: "PROVIDER_FAILURE",
      retryable: isPlpProviderFailureSubtypeRetryable(subtypeMatch),
      stage: "provider",
      safeReason: forensics
        ? `PROVIDER_FAILURE;${forensics}`
        : "PROVIDER_FAILURE:PROVIDER_FAILURE",
    });
  }

  return structuredFailure({
    failureCode: "PROVIDER_FAILURE",
    retryable: false,
    stage: "provider",
    safeReason: `PROVIDER_FAILURE:UNKNOWN;${forensics || reason}`,
  });
}

export function mapBuildStatusToFailure(input: {
  readonly status: string;
  readonly reasonCodes?: readonly string[];
  readonly pathDiagnostics?: {
    readonly PARTIAL_AUTO_PATHS?: readonly string[];
    readonly CANONICAL_IDENTICAL_TRANSLATABLE_PATHS?: readonly string[];
    readonly INTEGRITY_FAILED_PATHS?: readonly string[];
  };
}): PlpAutoBuildStructuredFailure {
  const codes = (input.reasonCodes ?? []).join(",");
  const pathSuffix = formatPathDiagnostics(input.pathDiagnostics);
  if (input.status === "REJECTED_PARTIAL" || codes.includes("PARTIAL")) {
    return structuredFailure({
      failureCode: "REJECTED_PARTIAL",
      retryable: false,
      stage: "validate",
      safeReason: codes
        ? `REJECTED_PARTIAL:${codes}${pathSuffix}`
        : `REJECTED_PARTIAL${pathSuffix}`,
    });
  }
  if (input.status === "SUPERSEDED" || codes.includes("STALE")) {
    const joined = (input.reasonCodes ?? []).join(";");
    const parsed = parsePlpStructuredStaleFromSafeReason(joined);
    const detail: PlpStructuredStaleDetail =
      parsed ??
      ({
        code: "STALE_CANONICAL_VERSION",
        reason: "STALE_REVISION",
        originId: PLP_STALE_ORIGIN.MAP_BUILD_STATUS,
        boundary: PLP_STALE_ORIGIN.MAP_BUILD_STATUS,
        authority: "mapBuildStatusToFailure",
        workCanonicalVersion: "UNKNOWN",
        currentSourceCanonicalVersion: "UNKNOWN",
      } satisfies PlpStructuredStaleDetail);
    return structuredFailure({
      failureCode: "STALE_CANONICAL_VERSION",
      retryable: false,
      stage: "validate",
      safeReason: encodePlpStructuredStaleSafeReason(detail),
    });
  }
  if (codes.includes("PUBLISH") || input.status === "FAILED") {
    return structuredFailure({
      failureCode: "PUBLISH_FAILED",
      retryable: true,
      stage: "publish",
      safeReason: codes
        ? `PUBLISH_FAILED:${codes}${pathSuffix}`
        : `PUBLISH_FAILED${pathSuffix}`,
    });
  }
  return structuredFailure({
    failureCode: "UNKNOWN",
    retryable: false,
    stage: "publish",
    safeReason: `UNKNOWN:${input.status}${codes ? `:${codes}` : ""}${pathSuffix}`,
  });
}

function formatPathDiagnostics(
  diagnostics:
    | {
        readonly PARTIAL_AUTO_PATHS?: readonly string[];
        readonly CANONICAL_IDENTICAL_TRANSLATABLE_PATHS?: readonly string[];
        readonly INTEGRITY_FAILED_PATHS?: readonly string[];
      }
    | undefined,
): string {
  if (!diagnostics) {
    return "";
  }
  const parts: string[] = [];
  const push = (label: string, paths: readonly string[] | undefined) => {
    if (!paths || paths.length === 0) {
      return;
    }
    parts.push(`${label}=${paths.slice(0, 24).join("|")}`);
  };
  push("PARTIAL_AUTO_PATHS", diagnostics.PARTIAL_AUTO_PATHS);
  push(
    "CANONICAL_IDENTICAL_TRANSLATABLE_PATHS",
    diagnostics.CANONICAL_IDENTICAL_TRANSLATABLE_PATHS,
  );
  push("INTEGRITY_FAILED_PATHS", diagnostics.INTEGRITY_FAILED_PATHS);
  return parts.length > 0 ? `;${parts.join(";")}` : "";
}

export function failureFromTimeoutError(error: unknown): PlpAutoBuildStructuredFailure {
  const message = error instanceof Error ? error.message : "timeout";
  if (/timed?\s*out/i.test(message)) {
    return structuredFailure({
      failureCode: "PROVIDER_TIMEOUT",
      retryable: true,
      stage: "provider",
      safeReason: "PROVIDER_TIMEOUT",
    });
  }
  return structuredFailure({
    failureCode: "PROVIDER_FAILURE",
    retryable: true,
    stage: "provider",
    safeReason: sanitizePlpAutoBuildFailureReason(message),
  });
}
