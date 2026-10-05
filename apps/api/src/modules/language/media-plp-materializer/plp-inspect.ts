/**
 * Reset 03B / 03E.4 — inspect current PLP pointer.
 * Match/usability uses the shared classifier (identity + CLI.1 + LSI.1).
 * Gate C — READY preserve only when PLP validity says READY.
 */

import type {
  LocalizedPresentationUsability,
  LocalizedPresentationUsabilityReason,
  PublicPresentationNode,
} from "@hu/types";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import { findCurrentPublishedPresentation } from "../published-localized-presentation/persistence/repository.js";
import { classifyUsableLocalizedPresentation } from "../published-localized-presentation/usability.js";
import {
  classifyPublishedLocalizedPresentationValidity,
  type PlpReconciliationState,
} from "../published-localized-presentation/plp-validity.js";
import { markMaterializerPlpLookup } from "./counters.js";

export type MediaPlpMaterializerPlpInspect = {
  readonly PLP_CURRENT_FOUND: boolean;
  readonly PLP_STATE: string | null;
  readonly PLP_CANONICAL_VERSION: string | null;
  readonly PLP_SCHEMA_VERSION: string | null;
  readonly PLP_CONTENT_REVISION: number | null;
  /**
   * True only when Gate B/C reconciliation state is READY
   * (usable + presentation-eligible, not deterministic/INVALID/STALE).
   */
  readonly PLP_MATCHES_CURRENT_SOURCE: boolean;
  readonly EXISTING_PLP_USABILITY: LocalizedPresentationUsability | null;
  readonly EXISTING_PLP_USABILITY_REASON: LocalizedPresentationUsabilityReason | null;
  /** Gate C — optional on test mocks; production inspect always sets it. */
  readonly PLP_RECONCILIATION_STATE?: PlpReconciliationState | null;
  readonly CONTENT_INTEGRITY_STATUS: string | null;
  readonly STRUCTURAL_INTEGRITY_STATUS: string | null;
  readonly REBUILD_REQUIRED: boolean;
};

export async function inspectMediaPlpCurrent(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string | null;
  readonly canonicalPresentation?: PublicPresentationNode | null;
}): Promise<MediaPlpMaterializerPlpInspect> {
  markMaterializerPlpLookup();
  const current = await findCurrentPublishedPresentation({
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
  });
  if (!current) {
    return {
      PLP_CURRENT_FOUND: false,
      PLP_STATE: null,
      PLP_CANONICAL_VERSION: null,
      PLP_SCHEMA_VERSION: null,
      PLP_CONTENT_REVISION: null,
      PLP_MATCHES_CURRENT_SOURCE: false,
      EXISTING_PLP_USABILITY: "REBUILD_REQUIRED",
      EXISTING_PLP_USABILITY_REASON: "NO_SNAPSHOT",
      PLP_RECONCILIATION_STATE: "MISSING",
      CONTENT_INTEGRITY_STATUS: null,
      STRUCTURAL_INTEGRITY_STATUS: null,
      REBUILD_REQUIRED: true,
    };
  }

  const classification = classifyUsableLocalizedPresentation({
    locale: input.locale,
    liveCanonicalVersion: input.canonicalVersion,
    liveLocalizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    canonicalPresentation: input.canonicalPresentation ?? null,
    snapshot: current,
  });
  const validity = classifyPublishedLocalizedPresentationValidity({
    locale: input.locale,
    liveCanonicalVersion: input.canonicalVersion,
    liveLocalizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    canonicalPresentation: input.canonicalPresentation ?? null,
    snapshot: current,
    storedLocalizationInputVersion: (
      current.identity as { localizationInputVersion?: string }
    ).localizationInputVersion,
  });

  return {
    PLP_CURRENT_FOUND: true,
    PLP_STATE: current.state,
    PLP_CANONICAL_VERSION: current.identity.canonicalVersion,
    PLP_SCHEMA_VERSION: String(current.identity.localizationSchemaVersion),
    PLP_CONTENT_REVISION: current.contentRevision,
    PLP_MATCHES_CURRENT_SOURCE: validity.reconciliationState === "READY",
    EXISTING_PLP_USABILITY: classification.usability,
    EXISTING_PLP_USABILITY_REASON: classification.reason,
    PLP_RECONCILIATION_STATE: validity.reconciliationState,
    CONTENT_INTEGRITY_STATUS: classification.contentIntegrityStatus,
    STRUCTURAL_INTEGRITY_STATUS: classification.structuralIntegrityStatus,
    REBUILD_REQUIRED:
      classification.rebuildRequired || validity.reconciliationState !== "READY",
  };
}
