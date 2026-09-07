/**
 * RESET 05C / 05C.3 — process one PLP build request (async queue worker only).
 *
 * Returns structured failure detail so durable work can persist real causes.
 * Never blocks HTTP/SSR callers. Provider imports stay dynamic here only.
 */

import type {
  LanguageCode,
  MediaPlpEntityType,
  PlpBuildRequest,
} from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPES } from "@hu/types";

import { findCurrentPublishedPresentation } from "../persistence/repository.js";
import { getPublishedLocalizationPersistenceMode } from "../persistence/repository.js";
import { collectAutoPaths } from "../presentation-paths.js";
import { classifyUsableLocalizedPresentation } from "../usability.js";
import { runUniversalPlpBuild } from "./build-pipeline.js";
import { isPlpBuildStaleAgainstLive } from "./build-request-queue.js";
import { getPlpDomainAdapter } from "./domain-adapter-registry.js";
import { isCollectedPathMachineEligible } from "./field-authority.js";
import {
  failureFromTimeoutError,
  mapBuildStatusToFailure,
  mapProviderBoundaryReasonToFailure,
  structuredFailure,
  type ProcessPlpBuildRequestResult,
} from "./plp-auto-build-failure.js";
import {
  ensureAllDefaultPlpAdaptersRegistered,
  ensureMediaPlpAdapterRegistered,
} from "./register-defaults.js";
import { PLP_UNIVERSAL_PROVIDER_TIMEOUT_MS } from "./safety.js";

export type ProcessPlpBuildRequestDeps = {
  readonly importProvider?: () => Promise<{
    readonly provider: import("../../translation-provider.js").TranslationProvider;
    readonly PROVIDER_TRANSPORT: string;
  }>;
  readonly callProvider?: (input: {
    readonly provider: import("../../translation-provider.js").TranslationProvider;
    readonly locale: LanguageCode;
    readonly autoValues: Readonly<Record<string, string>>;
    readonly sourceRecordId: string;
    readonly sourceVersion: string;
    readonly PROVIDER_TRANSPORT?: string;
  }) => Promise<
    | { readonly ok: true; readonly values: Readonly<Record<string, string>> }
    | {
        readonly ok: false;
        readonly message: string;
        readonly reason?: string;
      }
  >;
  readonly verifyDurability?: (input: {
    readonly entityType: string;
    readonly entityId: string;
    readonly locale: string;
    readonly canonicalVersion: string;
    readonly requireMongo?: boolean;
  }) => Promise<{ readonly ok: boolean; readonly reason?: string }>;
  readonly lookupTranslation?: (input: {
    readonly entityType: MediaPlpEntityType;
    readonly entityId: string;
    readonly locale: LanguageCode;
    readonly autoPaths: readonly string[];
    readonly expectedSourceVersion?: string | null;
  }) => Promise<{
    readonly EXISTING_TRANSLATION_COMPLETE: boolean;
    readonly values: Readonly<Record<string, string>>;
  }>;
  readonly providerTimeoutMs?: number;
};

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function collectMachineAutoValues(input: {
  readonly presentation: unknown;
  readonly fieldPolicy: Parameters<typeof isCollectedPathMachineEligible>[1];
}): {
  readonly autoPaths: readonly string[];
  readonly autoValues: Record<string, string>;
} {
  const collected = collectAutoPaths(input.presentation as never);
  const autoValues: Record<string, string> = {};
  const autoPaths: string[] = [];
  for (const node of collected) {
    if (!isCollectedPathMachineEligible(node.path, input.fieldPolicy)) {
      continue;
    }
    autoPaths.push(node.path);
    autoValues[node.path] = node.value;
  }
  return { autoPaths, autoValues };
}

function failed(result: ProcessPlpBuildRequestResult & { status: "FAILED" }): ProcessPlpBuildRequestResult {
  return result;
}

/**
 * Process a single coalesced build request. Safe for concurrency=1 drain.
 */
export async function processPlpBuildRequest(
  request: PlpBuildRequest,
  deps: ProcessPlpBuildRequestDeps = {},
): Promise<ProcessPlpBuildRequestResult> {
  ensureMediaPlpAdapterRegistered();
  ensureAllDefaultPlpAdaptersRegistered();

  const adapter = getPlpDomainAdapter(request.entityType);
  if (!adapter) {
    return failed({
      status: "FAILED",
      failure: structuredFailure({
        failureCode: "ADAPTER_OR_SOURCE",
        retryable: false,
        stage: "adapter",
        safeReason: `ADAPTER_OR_SOURCE:no_adapter:${request.entityType}`,
      }),
    });
  }

  const contract = await adapter.resolveCanonicalEntity({
    entityType: request.entityType,
    entityId: request.entityId,
    locale: request.locale as LanguageCode,
  });
  if (!contract) {
    return failed({
      status: "FAILED",
      failure: structuredFailure({
        failureCode: "SOURCE_NOT_FOUND",
        retryable: false,
        stage: "source",
        safeReason: "SOURCE_NOT_FOUND",
      }),
    });
  }

  if (
    isPlpBuildStaleAgainstLive({
      buildTargetCanonicalVersion: request.canonicalVersion,
      liveCanonicalVersion: contract.canonicalVersion,
    })
  ) {
    return { status: "SUPERSEDED" };
  }

  const existing = await findCurrentPublishedPresentation({
    entityType: request.entityType,
    entityId: request.entityId,
    locale: request.locale,
  });
  const usability = classifyUsableLocalizedPresentation({
    locale: request.locale,
    liveCanonicalVersion: contract.canonicalVersion,
    liveLocalizationSchemaVersion: contract.localizationSchemaVersion,
    canonicalPresentation: contract.canonicalPresentation,
    snapshot: existing,
  });
  if (usability.allowPublishedLocalized) {
    return { status: "SKIPPED_USABLE" };
  }

  const { autoPaths, autoValues } = collectMachineAutoValues({
    presentation: contract.canonicalPresentation,
    fieldPolicy: contract.fieldPolicy,
  });

  let localizationValues: Record<string, string> = {};
  let localizationSource: "EXISTING_CURRENT" | "PROVIDER" = "PROVIDER";

  const isMediaType = (MEDIA_PLP_ENTITY_TYPES as readonly string[]).includes(
    request.entityType,
  );

  if (isMediaType && autoPaths.length > 0) {
    try {
      const lookup =
        deps.lookupTranslation ??
        (await import("../../media-plp-materializer/translation-reuse.js"))
          .lookupExistingMediaPlpTranslation;
      const translation = await lookup({
        entityType: request.entityType as MediaPlpEntityType,
        entityId: request.entityId,
        locale: request.locale as LanguageCode,
        autoPaths,
        expectedSourceVersion: contract.canonicalVersion,
      });
      if (translation.EXISTING_TRANSLATION_COMPLETE) {
        localizationValues = { ...translation.values };
        localizationSource = "EXISTING_CURRENT";
      }
    } catch {
      // Memory / unbound CT store — fall through to provider.
    }
  }

  if (localizationSource !== "EXISTING_CURRENT") {
    if (autoPaths.length === 0) {
      return failed({
        status: "FAILED",
        failure: structuredFailure({
          failureCode: "ADAPTER_OR_SOURCE",
          retryable: false,
          stage: "source",
          safeReason: "ADAPTER_OR_SOURCE:no_machine_auto_paths",
        }),
      });
    }

    try {
      const { resetMediaPlpMaterializerProviderCallBudget } = await import(
        "../../media-plp-materializer/counters.js"
      );
      resetMediaPlpMaterializerProviderCallBudget();

      const providerModule = await import(
        "../../media-plp-materializer/provider-boundary.js"
      );
      const imported = await (deps.importProvider
        ? deps.importProvider()
        : providerModule.importMediaPlpMaterializerProvider());

      const timeoutMs =
        deps.providerTimeoutMs ?? PLP_UNIVERSAL_PROVIDER_TIMEOUT_MS;
      const callProvider =
        deps.callProvider ??
        (async (input) => {
          const result =
            await providerModule.callMediaPlpMaterializerProviderOnce({
              provider: input.provider,
              locale: input.locale,
              autoValues: input.autoValues,
              sourceRecordId: input.sourceRecordId,
              sourceVersion: input.sourceVersion,
              PROVIDER_TRANSPORT: input.PROVIDER_TRANSPORT,
            });
          if (!result.ok) {
            return {
              ok: false as const,
              message: result.message,
              reason: result.reason,
            };
          }
          return { ok: true as const, values: result.values };
        });

      const { recordPlpAutoBuildProviderCall } = await import(
        "./plp-auto-build-runtime.js"
      );
      recordPlpAutoBuildProviderCall();

      const providerResult = await withTimeout(
        callProvider({
          provider: imported.provider,
          locale: request.locale as LanguageCode,
          autoValues,
          sourceRecordId: `${request.entityType}:${request.entityId}`,
          sourceVersion: contract.canonicalVersion,
          PROVIDER_TRANSPORT: imported.PROVIDER_TRANSPORT,
        }),
        timeoutMs,
        "PLP auto-build provider",
      );

      if (!providerResult.ok) {
        return failed({
          status: "FAILED",
          failure: mapProviderBoundaryReasonToFailure({
            reason: providerResult.reason ?? "PROVIDER_FAILURE",
            message: providerResult.message,
          }),
        });
      }
      localizationValues = { ...providerResult.values };
      localizationSource = "PROVIDER";
    } catch (error) {
      return failed({
        status: "FAILED",
        failure: failureFromTimeoutError(error),
      });
    }
  }

  const built = await runUniversalPlpBuild({
    contract,
    liveCanonicalVersion: contract.canonicalVersion,
    layers: [
      {
        source: "MACHINE",
        values: localizationValues,
        provider:
          localizationSource === "PROVIDER"
            ? "plp_auto_build"
            : "existing_current",
      },
    ],
  });

  if (built.status === "SUPERSEDED") {
    return { status: "SUPERSEDED" };
  }
  if (built.status !== "COMPLETED") {
    return failed({
      status: "FAILED",
      failure: mapBuildStatusToFailure({
        status: built.status,
        reasonCodes: built.reasonCodes,
        pathDiagnostics: built.pathDiagnostics,
      }),
    });
  }

  const requireMongo =
    getPublishedLocalizationPersistenceMode() === "mongo";
  try {
    const verify =
      deps.verifyDurability ??
      (await import("../../media-plp-materializer/durability-verify.js"))
        .verifyDurableMediaPlpCurrent;
    const durability = await verify({
      entityType: request.entityType,
      entityId: request.entityId,
      locale: request.locale,
      canonicalVersion: contract.canonicalVersion,
      requireMongo,
    });
    if (!durability.ok) {
      return failed({
        status: "FAILED",
        failure: structuredFailure({
          failureCode: "PUBLISH_FAILED",
          retryable: true,
          stage: "durability",
          safeReason: `PUBLISH_FAILED:DURABILITY:${sanitizeSafe(durability.reason)}`,
        }),
      });
    }
  } catch (error) {
    return failed({
      status: "FAILED",
      failure: structuredFailure({
        failureCode: "PUBLISH_FAILED",
        retryable: true,
        stage: "durability",
        safeReason: `PUBLISH_FAILED:DURABILITY_THROW:${sanitizeSafe(
          error instanceof Error ? error.message : "unknown",
        )}`,
      }),
    });
  }

  return { status: "COMPLETED" };
}

function sanitizeSafe(value: string | undefined): string {
  return (value ?? "unknown").replace(/\s+/g, " ").trim().slice(0, 60);
}

export type { ProcessPlpBuildRequestResult };
