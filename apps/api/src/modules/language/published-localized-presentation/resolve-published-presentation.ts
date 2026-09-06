/**
 * Reset 02 — public read contract (provider/worker-free).
 *
 * Canonical-version policy (ADR-026 / Reset 01 preferred safety):
 * A PUBLISHED snapshot is returned only when identity.canonicalVersion matches
 * liveCanonicalVersion AND localizationSchemaVersion matches (when provided).
 * Otherwise coherent CANONICAL_FALLBACK — never a mixed tree, never SUPERSEDED/
 * BUILDING/FAILED/PARTIAL.
 *
 * Reset 03D — bounded in-process resolve cache keyed by
 * entityType|entityId|locale|canonicalVersion|schemaVersion.
 *
 * Reset 03E.4 — read eligibility uses the shared usability classifier
 * (same contract as materializer rebuild eligibility).
 */

import type {
  ResolvePublishedPresentationInput,
  ResolvePublishedPresentationResult,
} from "@hu/types";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import { findCurrentPublishedPresentation } from "./persistence/repository.js";
import {
  buildMediaPlpResolveCacheKey,
  getCachedMediaPlpResolve,
  setCachedMediaPlpResolve,
} from "./resolve-cache.js";
import { classifyUsableLocalizedPresentation } from "./usability.js";

export async function resolvePublishedPresentation(
  input: ResolvePublishedPresentationInput,
): Promise<ResolvePublishedPresentationResult> {
  const liveSchema =
    input.liveLocalizationSchemaVersion ?? PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
  const cacheKey = buildMediaPlpResolveCacheKey({
    entityType: input.entityType,
    entityId: input.entityId,
    locale: String(input.locale),
    liveCanonicalVersion: input.liveCanonicalVersion,
    localizationSchemaVersion: liveSchema,
  });
  const cached = getCachedMediaPlpResolve(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const current = await findCurrentPublishedPresentation({
      entityType: input.entityType,
      entityId: input.entityId,
      locale: String(input.locale),
    });

    const usability = classifyUsableLocalizedPresentation({
      locale: String(input.locale),
      liveCanonicalVersion: input.liveCanonicalVersion,
      liveLocalizationSchemaVersion: liveSchema,
      canonicalPresentation: input.canonicalPresentation,
      snapshot: current,
    });

    const result: ResolvePublishedPresentationResult = usability.allowPublishedLocalized
      ? {
          mode: "PUBLISHED_LOCALIZED",
          presentation: current!.presentation,
          seo: current!.seo,
          identity: current!.identity,
          snapshotId: current!.snapshotId,
        }
      : {
          mode: "CANONICAL_FALLBACK",
          presentation: input.canonicalPresentation,
          seo: input.canonicalSeo,
          reasonCode: usability.resolveReasonCode ?? "NO_PUBLISHED_SNAPSHOT",
        };

    setCachedMediaPlpResolve(cacheKey, result);
    return result;
  } catch {
    // Persistence failure: controlled fallback — no provider, no sync build, no corpus hydrate.
    // Do not cache persistence failures (allow quick retry after recovery).
    return {
      mode: "CANONICAL_FALLBACK",
      presentation: input.canonicalPresentation,
      seo: input.canonicalSeo,
      reasonCode: "PERSISTENCE_LOOKUP_FAILED",
    };
  }
}
