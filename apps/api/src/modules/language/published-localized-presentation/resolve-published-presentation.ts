/**
 * Reset 02 — public read contract (provider/worker-free).
 *
 * Canonical-version policy (ADR-026 / Reset 01 preferred safety):
 * A PUBLISHED snapshot is returned only when identity.canonicalVersion matches
 * liveCanonicalVersion AND localizationSchemaVersion matches (when provided).
 * Otherwise coherent CANONICAL_FALLBACK — never a mixed tree, never SUPERSEDED/
 * BUILDING/FAILED/PARTIAL.
 */

import type {
  ResolvePublishedPresentationInput,
  ResolvePublishedPresentationResult,
} from "@hu/types";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import { findCurrentPublishedPresentation } from "./persistence/repository.js";

export async function resolvePublishedPresentation(
  input: ResolvePublishedPresentationInput,
): Promise<ResolvePublishedPresentationResult> {
  try {
    const current = await findCurrentPublishedPresentation({
      entityType: input.entityType,
      entityId: input.entityId,
      locale: String(input.locale),
    });

    if (!current || current.state !== "PUBLISHED") {
      return {
        mode: "CANONICAL_FALLBACK",
        presentation: input.canonicalPresentation,
        seo: input.canonicalSeo,
        reasonCode: "NO_PUBLISHED_SNAPSHOT",
      };
    }

    if (current.identity.canonicalVersion !== input.liveCanonicalVersion) {
      return {
        mode: "CANONICAL_FALLBACK",
        presentation: input.canonicalPresentation,
        seo: input.canonicalSeo,
        reasonCode: "CANONICAL_VERSION_MISMATCH",
      };
    }

    const liveSchema =
      input.liveLocalizationSchemaVersion ?? PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
    if (current.identity.localizationSchemaVersion !== liveSchema) {
      return {
        mode: "CANONICAL_FALLBACK",
        presentation: input.canonicalPresentation,
        seo: input.canonicalSeo,
        reasonCode: "SCHEMA_VERSION_MISMATCH",
      };
    }

    return {
      mode: "PUBLISHED_LOCALIZED",
      presentation: current.presentation,
      seo: current.seo,
      identity: current.identity,
      snapshotId: current.snapshotId,
    };
  } catch {
    // Persistence failure: controlled fallback — no provider, no sync build, no corpus hydrate.
    return {
      mode: "CANONICAL_FALLBACK",
      presentation: input.canonicalPresentation,
      seo: input.canonicalSeo,
      reasonCode: "PERSISTENCE_LOOKUP_FAILED",
    };
  }
}
