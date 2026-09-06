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

    let result: ResolvePublishedPresentationResult;

    if (!current || current.state !== "PUBLISHED") {
      result = {
        mode: "CANONICAL_FALLBACK",
        presentation: input.canonicalPresentation,
        seo: input.canonicalSeo,
        reasonCode: "NO_PUBLISHED_SNAPSHOT",
      };
    } else if (current.identity.canonicalVersion !== input.liveCanonicalVersion) {
      result = {
        mode: "CANONICAL_FALLBACK",
        presentation: input.canonicalPresentation,
        seo: input.canonicalSeo,
        reasonCode: "CANONICAL_VERSION_MISMATCH",
      };
    } else if (current.identity.localizationSchemaVersion !== liveSchema) {
      result = {
        mode: "CANONICAL_FALLBACK",
        presentation: input.canonicalPresentation,
        seo: input.canonicalSeo,
        reasonCode: "SCHEMA_VERSION_MISMATCH",
      };
    } else {
      result = {
        mode: "PUBLISHED_LOCALIZED",
        presentation: current.presentation,
        seo: current.seo,
        identity: current.identity,
        snapshotId: current.snapshotId,
      };
    }

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
