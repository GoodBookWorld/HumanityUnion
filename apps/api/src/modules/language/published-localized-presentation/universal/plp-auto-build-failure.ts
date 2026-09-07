/**
 * RESET 05C.3 — structured PLP auto-build failure contract.
 *
 * safeReason never includes bodies, prompts, secrets, URIs, or private data.
 */

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

/** Safe reason codes only — strip URLs, payloads, long blobs. */
export function sanitizePlpAutoBuildFailureReason(reason: string): string {
  const trimmed = reason.trim().slice(0, 800);
  return (
    trimmed
      .replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, "[redacted]")
      .replace(/https?:\/\/[^\s"']+/gi, "[redacted-url]")
      .replace(/[A-Za-z0-9+/_-]{40,}/g, "[redacted]")
      .replace(/\s+/g, " ")
      .slice(0, 600) || "UNKNOWN"
  );
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

export function mapProviderBoundaryReasonToFailure(input: {
  readonly reason: string;
  readonly message: string;
}): PlpAutoBuildStructuredFailure {
  const reason = input.reason.toUpperCase();
  if (reason === "TIMEOUT") {
    return structuredFailure({
      failureCode: "PROVIDER_TIMEOUT",
      retryable: true,
      stage: "provider",
      safeReason: `PROVIDER_TIMEOUT:${sanitizePlpAutoBuildFailureReason(input.message)}`,
    });
  }
  if (reason === "PARTIAL" || reason === "WRONG_TARGET_LANGUAGE") {
    return structuredFailure({
      failureCode: "PROVIDER_PARTIAL",
      retryable: false,
      stage: "provider",
      safeReason: `PROVIDER_PARTIAL:${reason}`,
    });
  }
  if (reason === "LOCALIZATION_CONTENT_INTEGRITY_FAILED") {
    return structuredFailure({
      failureCode: "PROVIDER_INTEGRITY",
      retryable: false,
      stage: "provider",
      safeReason: "PROVIDER_INTEGRITY:LOCALIZATION_CONTENT_INTEGRITY_FAILED",
    });
  }
  if (reason === "BRAND_TOKEN_PRESERVATION_FAILED") {
    return structuredFailure({
      failureCode: "PROVIDER_INTEGRITY",
      retryable: false,
      stage: "provider",
      safeReason: "PROVIDER_INTEGRITY:BRAND_TOKEN_PRESERVATION_FAILED",
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
  if (reason === "PARSE_FAILURE" || reason === "PROVIDER_FAILURE") {
    return structuredFailure({
      failureCode: "PROVIDER_FAILURE",
      retryable: reason === "PROVIDER_FAILURE",
      stage: "provider",
      safeReason: `PROVIDER_FAILURE:${reason}`,
    });
  }
  return structuredFailure({
    failureCode: "PROVIDER_FAILURE",
    retryable: true,
    stage: "provider",
    safeReason: `PROVIDER_FAILURE:${sanitizePlpAutoBuildFailureReason(input.message || reason)}`,
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
    return structuredFailure({
      failureCode: "STALE_CANONICAL_VERSION",
      retryable: false,
      stage: "validate",
      safeReason: codes || "STALE_CANONICAL_VERSION",
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
