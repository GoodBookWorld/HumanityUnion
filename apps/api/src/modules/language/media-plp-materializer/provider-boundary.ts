/**
 * Reset 03B.2 / RESET 05D.5 / 05D.6 — thin provider execution boundary (execute only).
 * Never silently falls back to the heavy Gemini provider module / registry barrel.
 *
 * RESET 05D.6 — Brand slots extracted before provider; Gemini never receives
 * `{siteName}` or transport sentinels. Reassembly restores canonical Brand slots.
 */

import type { LanguageCode } from "@hu/types";
import {
  assertProviderPayloadHasNoBrandArtifacts,
  buildProviderOwnedMachinePayload,
  countBrandSiteNameTokens,
  reassembleBrandSlotPlans,
  stripBrandSlotsForMachineCompare,
  templateHasBrandSiteNameToken,
  textContainsBrandTransportArtifact,
} from "@hu/types";

import type { TranslationProvider } from "../translation-provider.js";
import { TranslationProviderError } from "../translation.config.js";
import {
  markMaterializerProviderCall,
  markMaterializerProviderImported,
  getMediaPlpMaterializerCounters,
} from "./counters.js";
import { resolveMediaPlpOperatorMaxProviderInputBytes } from "./constants.js";
import {
  createThinMediaPlpProviderFromConfig,
  MEDIA_PLP_THIN_GEMINI_TRANSPORT_ID,
  type MediaPlpBatchableTransport,
} from "./thin-gemini-transport.js";
import {
  classifyNewsPathForensics,
  classifyProviderResponseShape,
  deriveProviderPartialSubreason,
  emptyForensics,
  formatProviderForensicsSafe,
  type BrandPathForensicReport,
  type NewsPathForensicState,
  type ProviderBoundaryForensics,
  type ProviderPartialSubreason,
  type ProviderResponseShape,
} from "./provider-boundary-forensics.js";
import {
  decodePlpTranslationsContract,
  encodePlpTranslationsContract,
  httpStatusClass,
  planPlpProviderBatches,
  PLP_PROVIDER_FAILURE_SUBTYPE,
  type PlpProviderFailureSubtype,
} from "./provider-response-contract.js";

export const MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY = "THIN" as const;

export type ProviderMachinePathDiagnostics = {
  readonly EXPECTED_MACHINE_PATHS: readonly string[];
  readonly RETURNED_MACHINE_PATHS: readonly string[];
  readonly MISSING_MACHINE_PATHS: readonly string[];
  readonly UNEXPECTED_MACHINE_PATHS: readonly string[];
  readonly BRAND_TOKEN_PATH_STATES: readonly BrandPathForensicReport[];
  readonly NEWS_PATH_STATES: readonly NewsPathForensicState[];
  readonly PROVIDER_PARTIAL_SUBREASON: ProviderPartialSubreason | null;
  readonly PROVIDER_RESPONSE_SHAPE: ProviderResponseShape;
};

export type ProviderBoundaryFailureReason =
  | "PAYLOAD_LIMIT"
  | "PROVIDER_CALL_CAP"
  | "PROVIDER_FAILURE"
  | "PARSE_FAILURE"
  | "WRONG_TARGET_LANGUAGE"
  | "LOCALIZATION_CONTENT_INTEGRITY_FAILED"
  | "BRAND_TOKEN_PRESERVATION_FAILED"
  | "PARTIAL"
  | "TIMEOUT";

export type ProviderBoundaryResult =
  | {
      readonly ok: true;
      readonly values: Readonly<Record<string, string>>;
      readonly PROVIDER_INPUT_BYTES: number;
      readonly providerId: string;
      readonly PROVIDER_EXECUTION_BOUNDARY: typeof MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY;
      readonly PROVIDER_TRANSPORT: string;
      readonly pathDiagnostics: ProviderMachinePathDiagnostics;
      readonly forensics: ProviderBoundaryForensics;
    }
  | {
      readonly ok: false;
      readonly reason: ProviderBoundaryFailureReason;
      readonly PROVIDER_INPUT_BYTES: number;
      readonly message: string;
      readonly PROVIDER_EXECUTION_BOUNDARY: typeof MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY;
      readonly PROVIDER_TRANSPORT: string;
      readonly pathDiagnostics?: ProviderMachinePathDiagnostics;
      readonly forensics?: ProviderBoundaryForensics;
    };

export type ThinProviderImportResult = {
  readonly provider: TranslationProvider;
  readonly PROVIDER_EXECUTION_BOUNDARY: typeof MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY;
  readonly PROVIDER_TRANSPORT: string;
};

export {
  formatProviderForensicsSafe,
  isProviderPartialSubtypeRetryable,
  classifyBrandPathForensics,
  classifyNewsPathForensics,
  deriveProviderPartialSubreason,
  type ProviderBoundaryForensics,
  type BrandPathForensicReport,
  type NewsPathForensicState,
  type ProviderPartialSubreason,
} from "./provider-boundary-forensics.js";

/**
 * Import the thin Media PLP provider execution boundary only.
 * Never imports the heavy Gemini provider module (registry barrel).
 */
export async function importMediaPlpMaterializerProvider(): Promise<ThinProviderImportResult> {
  markMaterializerProviderImported();
  const { resolveTranslationConfig } = await import("../translation.config.js");
  const config = resolveTranslationConfig();
  const created = await createThinMediaPlpProviderFromConfig(config);
  return {
    provider: created.provider,
    PROVIDER_EXECUTION_BOUNDARY: MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY,
    PROVIDER_TRANSPORT: created.PROVIDER_TRANSPORT,
  };
}

function toPathDiagnostics(
  forensics: ProviderBoundaryForensics,
): ProviderMachinePathDiagnostics {
  return {
    EXPECTED_MACHINE_PATHS: forensics.EXPECTED_MACHINE_PATHS,
    RETURNED_MACHINE_PATHS: forensics.RETURNED_MACHINE_PATHS,
    MISSING_MACHINE_PATHS: forensics.MISSING_MACHINE_PATHS,
    UNEXPECTED_MACHINE_PATHS: forensics.UNEXPECTED_MACHINE_PATHS,
    BRAND_TOKEN_PATH_STATES: forensics.BRAND_TOKEN_PATH_STATES,
    NEWS_PATH_STATES: forensics.NEWS_PATH_STATES,
    PROVIDER_PARTIAL_SUBREASON: forensics.PROVIDER_PARTIAL_SUBREASON,
    PROVIDER_RESPONSE_SHAPE: forensics.PROVIDER_RESPONSE_SHAPE,
  };
}

export function buildProviderMachinePathDiagnostics(input: {
  readonly autoValues: Readonly<Record<string, string>>;
  readonly translated: Readonly<Record<string, string>>;
  /** Keys present in provider result (may include empty-string values). */
  readonly presentKeys?: readonly string[];
  readonly allReturnedKeys?: readonly string[];
  readonly locale?: LanguageCode;
  readonly shape?: ProviderResponseShape;
  readonly brandStates?: readonly BrandPathForensicReport[];
}): ProviderMachinePathDiagnostics {
  const expected = Object.keys(input.autoValues).sort();
  const presentSet = new Set(
    input.presentKeys ??
      Object.keys(input.translated).filter(
        (k) => typeof input.translated[k] === "string",
      ),
  );
  const returned = expected
    .filter(
      (k) =>
        presentSet.has(k) &&
        typeof input.translated[k] === "string" &&
        input.translated[k]!.trim().length > 0,
    )
    .sort();
  const expectedSet = new Set(expected);
  const returnedSet = new Set(returned);
  const missing = expected.filter((p) => !presentSet.has(p));
  const unexpected = (input.allReturnedKeys ?? [...presentSet])
    .filter((p) => !expectedSet.has(p))
    .sort();

  const locale = input.locale ?? "uk";
  const newsStates = expected.map((path) =>
    classifyNewsPathForensics({
      path,
      canonicalSource: input.autoValues[path] ?? "",
      returnedValue: presentSet.has(path)
        ? (input.translated[path] ?? "")
        : undefined,
      locale,
      mappedToExpectedPath: presentSet.has(path),
    }),
  );

  const brandStates: BrandPathForensicReport[] =
    input.brandStates != null
      ? [...input.brandStates]
      : expected.flatMap((path) => {
          const source = input.autoValues[path] ?? "";
          if (!templateHasBrandSiteNameToken(source)) {
            return [];
          }
          const restored = input.translated[path] ?? "";
          const expectedCount = countBrandSiteNameTokens(source);
          const finalCount = countBrandSiteNameTokens(restored);
          const state: BrandPathForensicReport["TOKEN_STATE"] =
            finalCount === expectedCount
              ? "PRESERVED"
              : finalCount === 0
                ? "MISSING_AFTER_PROVIDER"
                : "ALTERED";
          return [
            {
              SEMANTIC_PATH: path,
              EXPECTED_TOKEN_COUNT: expectedCount,
              PROTECTED_TOKEN_COUNT_BEFORE_SERIALIZE: 0,
              TOKEN_COUNT_AFTER_PROVIDER_PARSE: 0,
              TOKEN_COUNT_AFTER_FLATTEN: 0,
              TOKEN_COUNT_AFTER_RESTORE: finalCount,
              FINAL_CANONICAL_TOKEN_COUNT: finalCount,
              TOKEN_STATE: state,
              PROVIDER_PATH_PRESENT: path in input.translated,
            },
          ];
        });

  const subreason = deriveProviderPartialSubreason({
    pathStates: newsStates,
    missingPaths: missing,
    unexpectedPaths: unexpected,
  });

  return {
    EXPECTED_MACHINE_PATHS: expected,
    RETURNED_MACHINE_PATHS: returned,
    MISSING_MACHINE_PATHS: missing,
    UNEXPECTED_MACHINE_PATHS: [...new Set(unexpected)].sort(),
    BRAND_TOKEN_PATH_STATES: brandStates,
    NEWS_PATH_STATES: newsStates,
    PROVIDER_PARTIAL_SUBREASON:
      missing.length > 0 ||
      newsStates.some((s) => !s.NON_EMPTY || !s.TARGET_LANGUAGE_ACCEPTED)
        ? subreason
        : null,
    PROVIDER_RESPONSE_SHAPE: input.shape ?? "OBJECT",
  };
}

export function validateMediaPlpProviderLocalizationValues(input: {
  readonly locale: LanguageCode;
  readonly autoValues: Readonly<Record<string, string>>;
  readonly translated: Readonly<Record<string, string>>;
  readonly presentKeys?: readonly string[];
  readonly brandStates?: readonly BrandPathForensicReport[];
  readonly shape?: ProviderResponseShape;
}):
  | { readonly ok: true; readonly pathDiagnostics: ProviderMachinePathDiagnostics }
  | {
      readonly ok: false;
      readonly reason:
        | "PARTIAL"
        | "WRONG_TARGET_LANGUAGE"
        | "LOCALIZATION_CONTENT_INTEGRITY_FAILED"
        | "BRAND_TOKEN_PRESERVATION_FAILED";
      readonly message: string;
      readonly pathDiagnostics: ProviderMachinePathDiagnostics;
    } {
  const pathDiagnostics = buildProviderMachinePathDiagnostics({
    autoValues: input.autoValues,
    translated: input.translated,
    presentKeys: input.presentKeys,
    locale: input.locale,
    brandStates: input.brandStates,
    shape: input.shape,
  });

  if (pathDiagnostics.MISSING_MACHINE_PATHS.length > 0) {
    return {
      ok: false,
      reason: "PARTIAL",
      message: `PARTIAL:MISSING_PATH;${formatProviderForensicsSafe({
        ...pathDiagnostics,
        PROVIDER_PARTIAL_SUBREASON: "MISSING_PATH",
      } satisfies ProviderBoundaryForensics)}`,
      pathDiagnostics: {
        ...pathDiagnostics,
        PROVIDER_PARTIAL_SUBREASON: "MISSING_PATH",
      },
    };
  }

  const emptyPaths = pathDiagnostics.NEWS_PATH_STATES.filter(
    (s) => s.PATH_PRESENT && !s.NON_EMPTY,
  );
  if (emptyPaths.length > 0) {
    return {
      ok: false,
      reason: "PARTIAL",
      message: `PARTIAL:EMPTY_VALUE;${formatProviderForensicsSafe({
        ...pathDiagnostics,
        PROVIDER_PARTIAL_SUBREASON: "EMPTY_VALUE",
      } satisfies ProviderBoundaryForensics)}`,
      pathDiagnostics: {
        ...pathDiagnostics,
        PROVIDER_PARTIAL_SUBREASON: "EMPTY_VALUE",
      },
    };
  }

  const brandLoss = pathDiagnostics.BRAND_TOKEN_PATH_STATES.filter(
    (row) => row.TOKEN_STATE !== "PRESERVED",
  );
  if (brandLoss.length > 0) {
    const forensics: ProviderBoundaryForensics = {
      ...pathDiagnostics,
      PROVIDER_PARTIAL_SUBREASON: null,
    };
    return {
      ok: false,
      reason: "BRAND_TOKEN_PRESERVATION_FAILED",
      message: `BRAND_TOKEN_PRESERVATION_FAILED;${formatProviderForensicsSafe(forensics)}`,
      pathDiagnostics,
    };
  }

  for (const key of Object.keys(input.autoValues)) {
    const source = input.autoValues[key]!;
    const translated = input.translated[key]!;
    if (
      templateHasBrandSiteNameToken(source) &&
      !templateHasBrandSiteNameToken(translated)
    ) {
      const forensics: ProviderBoundaryForensics = {
        ...pathDiagnostics,
        PROVIDER_PARTIAL_SUBREASON: null,
      };
      return {
        ok: false,
        reason: "BRAND_TOKEN_PRESERVATION_FAILED",
        message: `BRAND_TOKEN_PRESERVATION_FAILED;${formatProviderForensicsSafe(forensics)}`,
        pathDiagnostics,
      };
    }
  }

  if (input.locale !== "en") {
    const identical: string[] = [];
    let anyProsePath = false;
    for (const key of Object.keys(input.autoValues)) {
      if (key === "id" || key.endsWith(".id")) {
        continue;
      }
      anyProsePath = true;
      const source = stripBrandSlotsForMachineCompare(input.autoValues[key]!);
      const translated = stripBrandSlotsForMachineCompare(
        input.translated[key]!,
      );
      // Brand-slot-only paths (no machine prose) are not integrity subjects.
      if (!source) {
        continue;
      }
      if (translated === source) {
        identical.push(key);
      }
    }
    const proseKeys = Object.keys(input.autoValues).filter((k) => {
      if (k === "id" || k.endsWith(".id")) {
        return false;
      }
      return stripBrandSlotsForMachineCompare(input.autoValues[k]!).length > 0;
    });
    if (anyProsePath && proseKeys.length > 0 && identical.length === proseKeys.length) {
      const forensics: ProviderBoundaryForensics = {
        ...pathDiagnostics,
        PROVIDER_PARTIAL_SUBREASON: "WRONG_TARGET_LANGUAGE",
      };
      return {
        ok: false,
        reason: "WRONG_TARGET_LANGUAGE",
        message: `PARTIAL:WRONG_TARGET_LANGUAGE;${formatProviderForensicsSafe(forensics)}`,
        pathDiagnostics: {
          ...pathDiagnostics,
          PROVIDER_PARTIAL_SUBREASON: "WRONG_TARGET_LANGUAGE",
        },
      };
    }
    if (identical.length > 0) {
      const forensics: ProviderBoundaryForensics = {
        ...pathDiagnostics,
        PROVIDER_PARTIAL_SUBREASON: "CONTENT_INTEGRITY_FAILURE",
      };
      return {
        ok: false,
        reason: "LOCALIZATION_CONTENT_INTEGRITY_FAILED",
        message: `CONTENT_INTEGRITY_FAILURE;${formatProviderForensicsSafe(forensics)}`,
        pathDiagnostics: {
          ...pathDiagnostics,
          PROVIDER_PARTIAL_SUBREASON: "CONTENT_INTEGRITY_FAILURE",
        },
      };
    }
  }

  return { ok: true, pathDiagnostics };
}

export function flattenStructuredLocalizationValues(
  node: unknown,
  prefix: string,
  out: Record<string, string>,
): void {
  if (typeof node === "string") {
    // Preserve empty strings so EMPTY_VALUE forensics can distinguish from MISSING_PATH.
    if (prefix) {
      out[prefix] = node;
    }
    return;
  }
  if (node === null || node === undefined) {
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((entry, index) => {
      const next = prefix ? `${prefix}[${index}]` : `[${index}]`;
      flattenStructuredLocalizationValues(entry, next, out);
    });
    return;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${key}` : key;
      flattenStructuredLocalizationValues(value, next, out);
    }
  }
}

/** @deprecated Prefer formatProviderForensicsSafe — kept for callers. */
export function formatProviderPathDiagnosticsSafe(
  diagnostics: ProviderMachinePathDiagnostics | undefined,
): string {
  if (!diagnostics) {
    return "";
  }
  return formatProviderForensicsSafe({
    PROVIDER_RESPONSE_SHAPE: diagnostics.PROVIDER_RESPONSE_SHAPE,
    BRAND_TOKEN_PATH_STATES: diagnostics.BRAND_TOKEN_PATH_STATES,
    NEWS_PATH_STATES: diagnostics.NEWS_PATH_STATES,
    PROVIDER_PARTIAL_SUBREASON: diagnostics.PROVIDER_PARTIAL_SUBREASON,
    EXPECTED_MACHINE_PATHS: diagnostics.EXPECTED_MACHINE_PATHS,
    RETURNED_MACHINE_PATHS: diagnostics.RETURNED_MACHINE_PATHS,
    MISSING_MACHINE_PATHS: diagnostics.MISSING_MACHINE_PATHS,
    UNEXPECTED_MACHINE_PATHS: diagnostics.UNEXPECTED_MACHINE_PATHS,
  });
}

function failResult(input: {
  readonly reason: ProviderBoundaryFailureReason;
  readonly bytes: number;
  readonly transport: string;
  readonly forensics: ProviderBoundaryForensics;
  readonly messagePrefix?: string;
}): ProviderBoundaryResult {
  const encoded = formatProviderForensicsSafe(input.forensics);
  return {
    ok: false,
    reason: input.reason,
    PROVIDER_INPUT_BYTES: input.bytes,
    message: `${input.messagePrefix ?? input.reason};${encoded}`,
    PROVIDER_EXECUTION_BOUNDARY: MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY,
    PROVIDER_TRANSPORT: input.transport,
    pathDiagnostics: toPathDiagnostics(input.forensics),
    forensics: input.forensics,
  };
}

export async function callMediaPlpMaterializerProviderOnce(input: {
  readonly provider: TranslationProvider;
  readonly locale: LanguageCode;
  readonly autoValues: Readonly<Record<string, string>>;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly maxInputBytes?: number;
  readonly PROVIDER_TRANSPORT?: string;
}): Promise<ProviderBoundaryResult> {
  const transport = input.PROVIDER_TRANSPORT ?? MEDIA_PLP_THIN_GEMINI_TRANSPORT_ID;
  const boundary = MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY;
  const expectedPaths = Object.keys(input.autoValues).sort();

  // RESET 05D.6 — extract Brand slots; provider receives MACHINE_TEXT only.
  const { payload: providerOwnedPayload, plans: brandSlotPlans } =
    buildProviderOwnedMachinePayload(input.autoValues);
  const brandPayloadViolators =
    assertProviderPayloadHasNoBrandArtifacts(providerOwnedPayload);
  if (brandPayloadViolators.length > 0) {
    return failResult({
      reason: "BRAND_TOKEN_PRESERVATION_FAILED",
      bytes: 0,
      transport,
      forensics: {
        ...emptyForensics({ expectedPaths }),
        PROVIDER_FAILURE_SUBTYPE: PLP_PROVIDER_FAILURE_SUBTYPE.BRAND_ARTIFACT,
      },
      messagePrefix:
        "BRAND_TOKEN_PRESERVATION_FAILED:PROVIDER_PAYLOAD_CONTAINS_BRAND",
    });
  }

  const batches = planPlpProviderBatches(providerOwnedPayload);
  const batchCount = Math.max(1, batches.length);
  // One sequential call per batch, plus at most one same-batch retry on MISSING_PATH.
  const maxProviderCalls = batchCount * 2;
  const counters = getMediaPlpMaterializerCounters();
  // RESET 05E — allow sequential batch hops (+ bounded MISSING_PATH retry; concurrency still 1).
  if (counters.PROVIDER_CALL_COUNT >= maxProviderCalls) {
    return failResult({
      reason: "PROVIDER_CALL_CAP",
      bytes: 0,
      transport,
      forensics: emptyForensics({ expectedPaths }),
      messagePrefix: "PROVIDER_CALL_CAP",
    });
  }

  const batchable = input.provider as MediaPlpBatchableTransport;
  if (typeof batchable.setMaxRequestsForBatching === "function") {
    batchable.setMaxRequestsForBatching(maxProviderCalls);
  }

  const maxBytes = input.maxInputBytes ?? resolveMediaPlpOperatorMaxProviderInputBytes();
  let totalBytes = 0;
  const flattenedSegments: Record<string, string> = {};
  let lastProviderId = "unknown";
  let lastEnvelope: {
    httpStatus?: number | null;
    finishReason?: string | null;
    candidateCount?: number;
    textPartCount?: number;
    extractedLength?: number;
    errorClass?: string | null;
    errorCode?: string | null;
    retryAfterSeconds?: number | null;
    geminiErrorStatus?: string | null;
    geminiErrorReason?: string | null;
    quotaClass?: string | null;
    quotaMetric?: string | null;
    quotaLimitId?: string | null;
    quotaRetryDelaySeconds?: number | null;
  } = {};

  const semanticPathFromProviderKey = (key: string): string => {
    const hash = key.lastIndexOf("#m");
    if (hash > 0 && /^#m\d+$/.test(key.slice(hash))) {
      return key.slice(0, hash);
    }
    return key;
  };

  const subtypeForensics = (
    subtype: PlpProviderFailureSubtype,
    batchIndex: number,
    extras?: Partial<ProviderBoundaryForensics>,
  ): ProviderBoundaryForensics => ({
    ...emptyForensics({ expectedPaths, shape: "INVALID" }),
    PROVIDER_FAILURE_SUBTYPE: subtype,
    PROVIDER_HTTP_CLASS: httpStatusClass(lastEnvelope.httpStatus ?? null),
    PROVIDER_HTTP_STATUS: lastEnvelope.httpStatus ?? null,
    PROVIDER_ERROR_CLASS: lastEnvelope.errorClass ?? null,
    PROVIDER_ERROR_CODE: lastEnvelope.errorCode ?? null,
    PROVIDER_RETRY_AFTER: lastEnvelope.retryAfterSeconds ?? null,
    PROVIDER_GEMINI_ERROR_STATUS: lastEnvelope.geminiErrorStatus ?? null,
    PROVIDER_GEMINI_ERROR_REASON: lastEnvelope.geminiErrorReason ?? null,
    PROVIDER_QUOTA_CLASS: lastEnvelope.quotaClass ?? null,
    PROVIDER_QUOTA_METRIC: lastEnvelope.quotaMetric ?? null,
    PROVIDER_QUOTA_LIMIT_ID: lastEnvelope.quotaLimitId ?? null,
    PROVIDER_QUOTA_RETRY_DELAY_SECONDS:
      lastEnvelope.quotaRetryDelaySeconds ?? null,
    PROVIDER_FINISH_REASON: lastEnvelope.finishReason ?? null,
    PROVIDER_CANDIDATE_COUNT: lastEnvelope.candidateCount ?? 0,
    PROVIDER_TEXT_PART_COUNT: lastEnvelope.textPartCount ?? 0,
    PROVIDER_EXTRACTED_LENGTH: lastEnvelope.extractedLength ?? 0,
    // Entity-level semantic counts (compatibility).
    PROVIDER_EXPECTED_KEY_COUNT: expectedPaths.length,
    PROVIDER_RETURNED_KEY_COUNT: Object.keys(flattenedSegments).length,
    PROVIDER_MISSING_KEY_COUNT: Math.max(
      0,
      expectedPaths.length - Object.keys(flattenedSegments).length,
    ),
    PROVIDER_BATCH_INDEX: batchIndex,
    PROVIDER_BATCH_COUNT: batchCount,
    ...extras,
  });

  try {
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex]!;
      const batchProviderKeys = Object.keys(batch);
      const contract = encodePlpTranslationsContract(batch);
      const payload = JSON.stringify(contract);
      const bytes = Buffer.byteLength(payload, "utf8");
      if (bytes > maxBytes) {
        return failResult({
          reason: "PAYLOAD_LIMIT",
          bytes: totalBytes,
          transport,
          forensics: subtypeForensics(
            PLP_PROVIDER_FAILURE_SUBTYPE.UNKNOWN_PROVIDER_SHAPE,
            batchIndex,
            {
              PROVIDER_BATCH_EXPECTED_KEY_COUNT: batchProviderKeys.length,
              PROVIDER_BATCH_RETURNED_KEY_COUNT: 0,
              PROVIDER_BATCH_MISSING_KEY_COUNT: batchProviderKeys.length,
            },
          ),
          messagePrefix: "PAYLOAD_LIMIT",
        });
      }

      let batchAccepted = false;
      // Attempt 0 = first call; attempt 1 = single bounded same-batch retry (MISSING_PATH only).
      for (let attempt = 0; attempt < 2 && !batchAccepted; attempt += 1) {
        totalBytes += bytes;
        markMaterializerProviderCall();
        if (getMediaPlpMaterializerCounters().PROVIDER_CALL_COUNT > maxProviderCalls) {
          return failResult({
            reason: "PROVIDER_CALL_CAP",
            bytes: totalBytes,
            transport,
            forensics: subtypeForensics(
              PLP_PROVIDER_FAILURE_SUBTYPE.BATCH_INCOMPLETE,
              batchIndex,
              {
                PROVIDER_BATCH_EXPECTED_KEY_COUNT: batchProviderKeys.length,
                PROVIDER_BATCH_ATTEMPT: attempt + 1,
              },
            ),
            messagePrefix: "PROVIDER_CALL_CAP",
          });
        }

        const result = await input.provider.translate({
          sourceLanguage: "en",
          targetLanguage: input.locale,
          text: payload,
          contentType: "structured_json",
          sourceRecordId: input.sourceRecordId,
          sourceVersion: input.sourceVersion,
          safetyCleared: true,
        });
        lastProviderId = result.providerId;
        lastEnvelope = result.envelope ?? {};

        let parsed: unknown;
        try {
          parsed = JSON.parse(result.translatedText);
        } catch {
          return failResult({
            reason: "PARSE_FAILURE",
            bytes: totalBytes,
            transport,
            forensics: {
              ...subtypeForensics(
                PLP_PROVIDER_FAILURE_SUBTYPE.JSON_PARSE_FAILED,
                batchIndex,
                {
                  PROVIDER_BATCH_EXPECTED_KEY_COUNT: batchProviderKeys.length,
                  PROVIDER_BATCH_ATTEMPT: attempt + 1,
                },
              ),
              PROVIDER_PARTIAL_SUBREASON: "PARSE_FAILURE",
              PROVIDER_EXTRACTED_LENGTH: result.translatedText.length,
            },
            messagePrefix: "PARSE_FAILURE",
          });
        }

        const shape = classifyProviderResponseShape(parsed);
        if (shape !== "OBJECT") {
          return failResult({
            reason: "PARSE_FAILURE",
            bytes: totalBytes,
            transport,
            forensics: {
              ...subtypeForensics(
                PLP_PROVIDER_FAILURE_SUBTYPE.JSON_ROOT_NOT_OBJECT,
                batchIndex,
                {
                  PROVIDER_RESPONSE_SHAPE: shape,
                  PROVIDER_BATCH_EXPECTED_KEY_COUNT: batchProviderKeys.length,
                  PROVIDER_BATCH_ATTEMPT: attempt + 1,
                },
              ),
              PROVIDER_PARTIAL_SUBREASON: "PARSE_FAILURE",
            },
            messagePrefix: "PARSE_FAILURE",
          });
        }

        const decoded = decodePlpTranslationsContract(parsed);
        if (!decoded.ok) {
          return failResult({
            reason:
              decoded.subtype === PLP_PROVIDER_FAILURE_SUBTYPE.DUPLICATE_KEY
                ? "PARTIAL"
                : "PARSE_FAILURE",
            bytes: totalBytes,
            transport,
            forensics: {
              ...subtypeForensics(decoded.subtype, batchIndex, {
                PROVIDER_RESPONSE_SHAPE: "OBJECT",
                PROVIDER_BATCH_EXPECTED_KEY_COUNT: batchProviderKeys.length,
                PROVIDER_BATCH_ATTEMPT: attempt + 1,
              }),
              PROVIDER_PARTIAL_SUBREASON:
                decoded.subtype === PLP_PROVIDER_FAILURE_SUBTYPE.DUPLICATE_KEY
                  ? "PATH_MAPPING_FAILURE"
                  : "PARSE_FAILURE",
            },
            messagePrefix:
              decoded.subtype === PLP_PROVIDER_FAILURE_SUBTYPE.DUPLICATE_KEY
                ? "PARTIAL:DUPLICATE_KEY"
                : "PARSE_FAILURE",
          });
        }

        // Validate completeness before merging — incomplete responses must not
        // pollute flattenedSegments (required for same-batch retry + fail-closed).
        const missingBatchKeys = batchProviderKeys.filter(
          (k) => !(k in decoded.values) || !decoded.values[k]!.trim(),
        );
        const batchReturnedKeyCount = batchProviderKeys.filter(
          (k) => k in decoded.values && Boolean(decoded.values[k]!.trim()),
        ).length;

        if (missingBatchKeys.length > 0) {
          if (attempt === 0) {
            // Bounded retry: resend the same batch payload only.
            continue;
          }
          const missingSemantic = [
            ...new Set(missingBatchKeys.map(semanticPathFromProviderKey)),
          ].sort();
          return failResult({
            reason: "PARTIAL",
            bytes: totalBytes,
            transport,
            forensics: {
              ...subtypeForensics(
                PLP_PROVIDER_FAILURE_SUBTYPE.EXPECTED_KEY_MISSING,
                batchIndex,
                {
                  PROVIDER_RESPONSE_SHAPE: "OBJECT",
                  PROVIDER_BATCH_EXPECTED_KEY_COUNT: batchProviderKeys.length,
                  PROVIDER_BATCH_RETURNED_KEY_COUNT: batchReturnedKeyCount,
                  PROVIDER_BATCH_MISSING_KEY_COUNT: missingBatchKeys.length,
                  PROVIDER_BATCH_ATTEMPT: attempt + 1,
                  // On batch MISSING_PATH abort, returned/missing reflect this batch.
                  PROVIDER_RETURNED_KEY_COUNT: batchReturnedKeyCount,
                  PROVIDER_MISSING_KEY_COUNT: missingBatchKeys.length,
                },
              ),
              PROVIDER_PARTIAL_SUBREASON: "MISSING_PATH",
              MISSING_MACHINE_PATHS: missingSemantic,
              RETURNED_MACHINE_PATHS: Object.keys(decoded.values)
                .map(semanticPathFromProviderKey)
                .sort(),
            },
            messagePrefix: "PARTIAL:MISSING_PATH",
          });
        }

        for (const [key, value] of Object.entries(decoded.values)) {
          if (Object.prototype.hasOwnProperty.call(flattenedSegments, key)) {
            return failResult({
              reason: "PARTIAL",
              bytes: totalBytes,
              transport,
              forensics: {
                ...subtypeForensics(PLP_PROVIDER_FAILURE_SUBTYPE.DUPLICATE_KEY, batchIndex, {
                  PROVIDER_RESPONSE_SHAPE: "OBJECT",
                  PROVIDER_BATCH_EXPECTED_KEY_COUNT: batchProviderKeys.length,
                  PROVIDER_BATCH_ATTEMPT: attempt + 1,
                }),
                PROVIDER_PARTIAL_SUBREASON: "PATH_MAPPING_FAILURE",
              },
              messagePrefix: "PARTIAL:DUPLICATE_KEY",
            });
          }
          flattenedSegments[key] = value;
        }
        batchAccepted = true;
      }

      if (!batchAccepted) {
        return failResult({
          reason: "PARTIAL",
          bytes: totalBytes,
          transport,
          forensics: subtypeForensics(
            PLP_PROVIDER_FAILURE_SUBTYPE.EXPECTED_KEY_MISSING,
            batchIndex,
            {
              PROVIDER_RESPONSE_SHAPE: "OBJECT",
              PROVIDER_BATCH_EXPECTED_KEY_COUNT: batchProviderKeys.length,
              PROVIDER_BATCH_RETURNED_KEY_COUNT: 0,
              PROVIDER_BATCH_MISSING_KEY_COUNT: batchProviderKeys.length,
              PROVIDER_BATCH_ATTEMPT: 2,
              PROVIDER_RETURNED_KEY_COUNT: 0,
              PROVIDER_MISSING_KEY_COUNT: batchProviderKeys.length,
            },
          ),
          messagePrefix: "PARTIAL:MISSING_PATH",
        });
      }
    }

    // Defensive: provider must not inject Brand tokens/sentinels into segments.
    const injectedBrandKeys = Object.entries(flattenedSegments)
      .filter(([, value]) => textContainsBrandTransportArtifact(value))
      .map(([key]) => key);
    if (injectedBrandKeys.length > 0) {
      return failResult({
        reason: "BRAND_TOKEN_PRESERVATION_FAILED",
        bytes: totalBytes,
        transport,
        forensics: {
          ...subtypeForensics(PLP_PROVIDER_FAILURE_SUBTYPE.BRAND_ARTIFACT, 0, {
            PROVIDER_RESPONSE_SHAPE: "OBJECT",
          }),
          PROVIDER_PARTIAL_SUBREASON: "OTHER_STRUCTURAL_FAILURE",
          RETURNED_MACHINE_PATHS: Object.keys(flattenedSegments).sort(),
        },
        messagePrefix:
          "BRAND_TOKEN_PRESERVATION_FAILED:PROVIDER_INJECTED_BRAND",
      });
    }

    const reassembled = reassembleBrandSlotPlans({
      plans: brandSlotPlans,
      translatedSegments: flattenedSegments,
    });
    if (reassembled.missingSegmentKeys.length > 0) {
      const missingSemantic = expectedPaths.filter(
        (p) => !(p in reassembled.values),
      );
      const newsStates = expectedPaths.map((path) =>
        classifyNewsPathForensics({
          path,
          canonicalSource: input.autoValues[path] ?? "",
          returnedValue:
            path in reassembled.values ? reassembled.values[path] : undefined,
          locale: input.locale,
          mappedToExpectedPath: path in reassembled.values,
        }),
      );
      const forensics: ProviderBoundaryForensics = {
        PROVIDER_RESPONSE_SHAPE: "OBJECT",
        BRAND_TOKEN_PATH_STATES: [],
        NEWS_PATH_STATES: newsStates,
        PROVIDER_PARTIAL_SUBREASON: "MISSING_PATH",
        EXPECTED_MACHINE_PATHS: expectedPaths,
        RETURNED_MACHINE_PATHS: Object.keys(reassembled.values).sort(),
        MISSING_MACHINE_PATHS: missingSemantic,
        UNEXPECTED_MACHINE_PATHS: [],
        PROVIDER_FAILURE_SUBTYPE: PLP_PROVIDER_FAILURE_SUBTYPE.EXPECTED_KEY_MISSING,
        PROVIDER_BATCH_COUNT: batchCount,
        PROVIDER_EXPECTED_KEY_COUNT: expectedPaths.length,
        PROVIDER_RETURNED_KEY_COUNT: Object.keys(reassembled.values).length,
        PROVIDER_MISSING_KEY_COUNT: missingSemantic.length,
      };
      return failResult({
        reason: "PARTIAL",
        bytes: totalBytes,
        transport,
        forensics,
        messagePrefix: "PARTIAL:MISSING_PATH",
      });
    }

    const aligned: Record<string, string> = { ...reassembled.values };
    const presentKeys = Object.keys(aligned);
    const shape: ProviderResponseShape = "OBJECT";

    const brandStates: BrandPathForensicReport[] = [];
    for (const path of expectedPaths) {
      const source = input.autoValues[path] ?? "";
      if (!templateHasBrandSiteNameToken(source)) {
        continue;
      }
      const restoredVal = aligned[path] ?? null;
      const expectedCount = countBrandSiteNameTokens(source);
      const finalCount = restoredVal
        ? countBrandSiteNameTokens(restoredVal)
        : 0;
      brandStates.push({
        SEMANTIC_PATH: path,
        EXPECTED_TOKEN_COUNT: expectedCount,
        PROTECTED_TOKEN_COUNT_BEFORE_SERIALIZE: 0,
        TOKEN_COUNT_AFTER_PROVIDER_PARSE: 0,
        TOKEN_COUNT_AFTER_FLATTEN: 0,
        TOKEN_COUNT_AFTER_RESTORE: finalCount,
        FINAL_CANONICAL_TOKEN_COUNT: finalCount,
        TOKEN_STATE:
          restoredVal != null && finalCount === expectedCount
            ? "PRESERVED"
            : restoredVal == null
              ? "MISSING_AFTER_PARSE"
              : "ALTERED",
        PROVIDER_PATH_PRESENT: restoredVal != null,
      });
    }

    const newsStates = expectedPaths.map((path) =>
      classifyNewsPathForensics({
        path,
        canonicalSource: input.autoValues[path] ?? "",
        returnedValue: Object.prototype.hasOwnProperty.call(aligned, path)
          ? aligned[path]
          : undefined,
        locale: input.locale,
        mappedToExpectedPath: Object.prototype.hasOwnProperty.call(
          aligned,
          path,
        ),
      }),
    );

    const missing = expectedPaths.filter((p) => !presentKeys.includes(p));
    const returnedNonEmpty = presentKeys.filter((k) => aligned[k]!.trim());
    const unexpected = Object.keys(flattenedSegments).filter((p) => {
      if (expectedPaths.includes(p)) {
        return false;
      }
      return !brandSlotPlans.some((plan) => plan.providerKeys.includes(p));
    });

    const forensicsBase: ProviderBoundaryForensics = {
      PROVIDER_RESPONSE_SHAPE: shape,
      BRAND_TOKEN_PATH_STATES: brandStates,
      NEWS_PATH_STATES: newsStates,
      PROVIDER_PARTIAL_SUBREASON: null,
      EXPECTED_MACHINE_PATHS: expectedPaths,
      RETURNED_MACHINE_PATHS: returnedNonEmpty.sort(),
      MISSING_MACHINE_PATHS: missing,
      UNEXPECTED_MACHINE_PATHS: [...new Set(unexpected)].sort(),
      PROVIDER_BATCH_COUNT: batchCount,
      PROVIDER_EXPECTED_KEY_COUNT: expectedPaths.length,
      PROVIDER_RETURNED_KEY_COUNT: returnedNonEmpty.length,
      PROVIDER_MISSING_KEY_COUNT: missing.length,
      PROVIDER_HTTP_CLASS: httpStatusClass(lastEnvelope.httpStatus ?? 200),
      PROVIDER_FINISH_REASON: lastEnvelope.finishReason ?? null,
      PROVIDER_CANDIDATE_COUNT: lastEnvelope.candidateCount ?? 1,
      PROVIDER_TEXT_PART_COUNT: lastEnvelope.textPartCount ?? 1,
      PROVIDER_EXTRACTED_LENGTH: lastEnvelope.extractedLength ?? 0,
    };

    const validated = validateMediaPlpProviderLocalizationValues({
      locale: input.locale,
      autoValues: input.autoValues,
      translated: aligned,
      presentKeys,
      brandStates,
      shape,
    });

    if (!validated.ok) {
      const sub =
        validated.pathDiagnostics.PROVIDER_PARTIAL_SUBREASON ??
        (validated.reason === "PARTIAL"
          ? deriveProviderPartialSubreason({
              pathStates: newsStates,
              missingPaths: missing,
              unexpectedPaths: unexpected,
            })
          : validated.reason === "WRONG_TARGET_LANGUAGE"
            ? "WRONG_TARGET_LANGUAGE"
            : validated.reason === "LOCALIZATION_CONTENT_INTEGRITY_FAILED"
              ? "CONTENT_INTEGRITY_FAILURE"
              : null);
      const forensics: ProviderBoundaryForensics = {
        ...forensicsBase,
        BRAND_TOKEN_PATH_STATES:
          validated.pathDiagnostics.BRAND_TOKEN_PATH_STATES.length > 0
            ? validated.pathDiagnostics.BRAND_TOKEN_PATH_STATES
            : brandStates,
        NEWS_PATH_STATES: validated.pathDiagnostics.NEWS_PATH_STATES,
        PROVIDER_PARTIAL_SUBREASON: sub,
        MISSING_MACHINE_PATHS: validated.pathDiagnostics.MISSING_MACHINE_PATHS,
        RETURNED_MACHINE_PATHS: validated.pathDiagnostics.RETURNED_MACHINE_PATHS,
        PROVIDER_FAILURE_SUBTYPE:
          sub === "WRONG_TARGET_LANGUAGE" || sub === "CONTENT_INTEGRITY_FAILURE"
            ? null
            : PLP_PROVIDER_FAILURE_SUBTYPE.EXPECTED_KEY_MISSING,
      };
      return {
        ok: false,
        reason: validated.reason,
        PROVIDER_INPUT_BYTES: totalBytes,
        message: formatProviderForensicsSafe(forensics)
          ? `${validated.reason};${formatProviderForensicsSafe(forensics)}`
          : validated.message,
        PROVIDER_EXECUTION_BOUNDARY: boundary,
        PROVIDER_TRANSPORT: transport,
        pathDiagnostics: toPathDiagnostics(forensics),
        forensics,
      };
    }

    return {
      ok: true,
      values: Object.fromEntries(
        Object.entries(aligned).filter(([, v]) => v.trim().length > 0),
      ),
      PROVIDER_INPUT_BYTES: totalBytes,
      providerId: lastProviderId,
      PROVIDER_EXECUTION_BOUNDARY: boundary,
      PROVIDER_TRANSPORT: transport,
      pathDiagnostics: validated.pathDiagnostics,
      forensics: {
        ...forensicsBase,
        BRAND_TOKEN_PATH_STATES: validated.pathDiagnostics.BRAND_TOKEN_PATH_STATES,
        NEWS_PATH_STATES: validated.pathDiagnostics.NEWS_PATH_STATES,
        PROVIDER_PARTIAL_SUBREASON: null,
        MISSING_MACHINE_PATHS: [],
        RETURNED_MACHINE_PATHS: validated.pathDiagnostics.RETURNED_MACHINE_PATHS,
        PROVIDER_MISSING_KEY_COUNT: 0,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "provider failure";
    const transportMeta =
      error instanceof TranslationProviderError ? error.transport : undefined;
    if (transportMeta) {
      lastEnvelope = {
        httpStatus: transportMeta.httpStatus ?? null,
        finishReason: lastEnvelope.finishReason ?? null,
        candidateCount: 0,
        textPartCount: 0,
        extractedLength: 0,
        errorClass: transportMeta.errorClass ?? null,
        errorCode: transportMeta.errorCode ?? null,
        retryAfterSeconds: transportMeta.retryAfterSeconds ?? null,
        geminiErrorStatus: transportMeta.geminiErrorStatus ?? null,
        geminiErrorReason: transportMeta.geminiErrorReason ?? null,
        quotaClass: transportMeta.quotaClass ?? null,
        quotaMetric: transportMeta.quotaMetric ?? null,
        quotaLimitId: transportMeta.quotaLimitId ?? null,
        quotaRetryDelaySeconds: transportMeta.quotaRetryDelaySeconds ?? null,
      };
    }
    const subtype =
      error instanceof TranslationProviderError && error.providerFailureSubtype
        ? (error.providerFailureSubtype as PlpProviderFailureSubtype)
        : /timed out/i.test(message)
          ? PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_TIMEOUT
          : PLP_PROVIDER_FAILURE_SUBTYPE.UNKNOWN_PROVIDER_SHAPE;
    const isTimeout =
      subtype === PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_TIMEOUT ||
      (error instanceof TranslationProviderError && error.code === "timeout") ||
      /timed out/i.test(message);
    return failResult({
      reason: isTimeout ? "TIMEOUT" : "PROVIDER_FAILURE",
      bytes: totalBytes,
      transport,
      forensics: {
        ...subtypeForensics(subtype, 0),
        PROVIDER_PARTIAL_SUBREASON: null,
        PROVIDER_HTTP_CLASS:
          transportMeta?.httpClass ??
          httpStatusClass(transportMeta?.httpStatus ?? null),
        PROVIDER_HTTP_STATUS: transportMeta?.httpStatus ?? null,
        PROVIDER_ERROR_CLASS: transportMeta?.errorClass ?? null,
        PROVIDER_ERROR_CODE: transportMeta?.errorCode ?? null,
        PROVIDER_RETRY_AFTER: transportMeta?.retryAfterSeconds ?? null,
        PROVIDER_GEMINI_ERROR_STATUS: transportMeta?.geminiErrorStatus ?? null,
        PROVIDER_GEMINI_ERROR_REASON: transportMeta?.geminiErrorReason ?? null,
        PROVIDER_QUOTA_CLASS: transportMeta?.quotaClass ?? null,
        PROVIDER_QUOTA_METRIC: transportMeta?.quotaMetric ?? null,
        PROVIDER_QUOTA_LIMIT_ID: transportMeta?.quotaLimitId ?? null,
        PROVIDER_QUOTA_RETRY_DELAY_SECONDS:
          transportMeta?.quotaRetryDelaySeconds ?? null,
      },
      messagePrefix: isTimeout ? "TIMEOUT" : "PROVIDER_FAILURE",
    });
  }
}
