/**
 * RESET 05C — process one PLP build request (async queue worker only).
 *
 * Never blocks HTTP/SSR callers. Provider/materializer imports stay dynamic
 * and confined to this module (not build-pipeline).
 *
 * Focus: public_news first; other Media types OK when the domain adapter resolves.
 */

import type {
  LanguageCode,
  MediaPlpEntityType,
  PlpBuildRequest,
  PlpBuildRequestStatus,
} from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPES } from "@hu/types";

import { findCurrentPublishedPresentation } from "../persistence/repository.js";
import { getPublishedLocalizationPersistenceMode } from "../persistence/repository.js";
import { collectAutoPaths } from "../presentation-paths.js";
import { classifyUsableLocalizedPresentation } from "../usability.js";
import { runUniversalPlpBuild } from "./build-pipeline.js";
import { isPlpBuildStaleAgainstLive } from "./build-request-queue.js";
import { getPlpDomainAdapter } from "./domain-adapter-registry.js";
import { machineEligiblePaths } from "./field-authority.js";
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
    | { readonly ok: false; readonly message: string }
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
  readonly fieldPolicy: Parameters<typeof machineEligiblePaths>[0];
}): {
  readonly autoPaths: readonly string[];
  readonly autoValues: Record<string, string>;
} {
  const machinePaths = new Set(machineEligiblePaths(input.fieldPolicy));
  const collected = collectAutoPaths(input.presentation as never);
  const autoValues: Record<string, string> = {};
  const autoPaths: string[] = [];
  for (const node of collected) {
    if (!machinePaths.has(node.path)) {
      continue;
    }
    autoPaths.push(node.path);
    autoValues[node.path] = node.value;
  }
  return { autoPaths, autoValues };
}

/**
 * Process a single coalesced build request. Safe for concurrency=1 drain.
 */
export async function processPlpBuildRequest(
  request: PlpBuildRequest,
  deps: ProcessPlpBuildRequestDeps = {},
): Promise<PlpBuildRequestStatus> {
  ensureMediaPlpAdapterRegistered();
  ensureAllDefaultPlpAdaptersRegistered();

  const adapter = getPlpDomainAdapter(request.entityType);
  if (!adapter) {
    return "FAILED";
  }

  const contract = await adapter.resolveCanonicalEntity({
    entityType: request.entityType,
    entityId: request.entityId,
    locale: request.locale as LanguageCode,
  });
  if (!contract) {
    return "FAILED";
  }

  if (
    isPlpBuildStaleAgainstLive({
      buildTargetCanonicalVersion: request.canonicalVersion,
      liveCanonicalVersion: contract.canonicalVersion,
    })
  ) {
    return "SUPERSEDED";
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
    return "COMPLETED";
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
      return "FAILED";
    }

    try {
      // Per-request provider budget: materializer counters are one-shot CLI caps.
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
            return { ok: false as const, message: result.message };
          }
          return { ok: true as const, values: result.values };
        });

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
        // Leave canonical usable; do not corrupt existing snapshots.
        return "FAILED";
      }
      localizationValues = { ...providerResult.values };
      localizationSource = "PROVIDER";
    } catch (error) {
      // Leave canonical usable; do not corrupt existing snapshots.
      void error;
      return "FAILED";
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

  if (built.status !== "COMPLETED") {
    return built.status;
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
      return "FAILED";
    }
  } catch {
    return "FAILED";
  }

  return "COMPLETED";
}
