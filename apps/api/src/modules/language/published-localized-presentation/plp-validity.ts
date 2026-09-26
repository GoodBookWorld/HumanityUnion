/**
 * STEP 15D.14.B.2 — PLP validity / reconciliation eligibility (Gate C input).
 *
 * Semantic parity with CT Gate B:
 * READY | MISSING | STALE | INVALID | BLOCKED | NOT_APPLICABLE
 *
 * READY = presentation-eligible real localized output.
 * Deterministic / structurally bad / required terminology violation → not READY.
 */

import type {
  PublicPresentationNode,
  PublishedLocalizedPresentationRecord,
} from "@hu/types";

import type { ContentTranslationReconciliationState } from "../content-translation-validity.js";
import {
  classifyLocalizationInputCurrentness,
} from "../localization-input-contract.js";
import {
  classifyUsableLocalizedPresentation,
  type UsableLocalizedPresentationClassification,
} from "./usability.js";

export type PlpReconciliationState = ContentTranslationReconciliationState;

export type PlpValidityClassification = {
  readonly reconciliationState: PlpReconciliationState;
  readonly presentationEligible: boolean;
  readonly localizedCoverage: boolean;
  readonly workRemaining: boolean;
  readonly reasons: readonly string[];
  readonly usability: UsableLocalizedPresentationClassification | null;
};

function isDeterministicPlpProvider(
  snapshot: PublishedLocalizedPresentationRecord | null | undefined,
): boolean {
  const provenance = snapshot?.provenance ?? [];
  return provenance.some(
    (entry) =>
      entry.source === "MACHINE" &&
      String(entry.provider ?? "")
        .trim()
        .toLowerCase() === "deterministic",
  );
}

/**
 * Classify a PLP snapshot for reconciliation / readiness.
 * Does not mutate durable state.
 */
export function classifyPublishedLocalizedPresentationValidity(input: {
  readonly locale: string;
  readonly liveCanonicalVersion: string | null | undefined;
  readonly liveLocalizationSchemaVersion?: string;
  readonly liveLocalizationInputVersion?: string | null;
  readonly storedLocalizationInputVersion?: string | null;
  readonly canonicalPresentation: PublicPresentationNode | null | undefined;
  readonly snapshot:
    | PublishedLocalizedPresentationRecord
    | null
    | undefined;
  readonly terminologyViolations?: boolean;
}): PlpValidityClassification {
  if (String(input.locale).toLowerCase() === "en") {
    return {
      reconciliationState: "NOT_APPLICABLE",
      presentationEligible: false,
      localizedCoverage: false,
      workRemaining: false,
      reasons: ["source_locale"],
      usability: null,
    };
  }

  if (!input.snapshot) {
    return {
      reconciliationState: "MISSING",
      presentationEligible: false,
      localizedCoverage: false,
      workRemaining: true,
      reasons: ["no_published_snapshot"],
      usability: null,
    };
  }

  const usability = classifyUsableLocalizedPresentation({
    locale: input.locale,
    liveCanonicalVersion: input.liveCanonicalVersion,
    liveLocalizationSchemaVersion: input.liveLocalizationSchemaVersion,
    canonicalPresentation: input.canonicalPresentation,
    snapshot: input.snapshot,
  });

  if (
    usability.reason === "CANONICAL_VERSION_MISMATCH" ||
    usability.reason === "SCHEMA_VERSION_MISMATCH"
  ) {
    return {
      reconciliationState: "STALE",
      presentationEligible: false,
      localizedCoverage: false,
      workRemaining: true,
      reasons: [usability.reason.toLowerCase()],
      usability,
    };
  }

  if (input.liveLocalizationInputVersion) {
    const inputState = classifyLocalizationInputCurrentness({
      storedLocalizationInputVersion:
        input.storedLocalizationInputVersion ??
        (
          input.snapshot.identity as {
            localizationInputVersion?: string;
          }
        ).localizationInputVersion,
      liveLocalizationInputVersion: input.liveLocalizationInputVersion,
    });
    if (inputState === "stale") {
      return {
        reconciliationState: "STALE",
        presentationEligible: false,
        localizedCoverage: false,
        workRemaining: true,
        reasons: ["localization_input_stale"],
        usability,
      };
    }
  }

  if (input.terminologyViolations === true) {
    return {
      reconciliationState: "INVALID",
      presentationEligible: false,
      localizedCoverage: false,
      workRemaining: true,
      reasons: ["terminology_protection_violation"],
      usability,
    };
  }

  if (isDeterministicPlpProvider(input.snapshot) && usability.allowPublishedLocalized) {
    return {
      reconciliationState: "INVALID",
      presentationEligible: false,
      localizedCoverage: false,
      workRemaining: true,
      reasons: ["deterministic_placeholder"],
      usability,
    };
  }

  if (
    !usability.allowPublishedLocalized &&
    (usability.reason === "CONTENT_INTEGRITY_FAILED" ||
      usability.reason === "STRUCTURAL_INTEGRITY_FAILED" ||
      usability.reason === "CONTENT_INTEGRITY_MISSING" ||
      usability.reason === "STRUCTURAL_INTEGRITY_MISSING")
  ) {
    return {
      reconciliationState: "INVALID",
      presentationEligible: false,
      localizedCoverage: false,
      workRemaining: true,
      reasons: [usability.reason.toLowerCase()],
      usability,
    };
  }

  if (!usability.allowPublishedLocalized) {
    if (usability.reason === "NO_SNAPSHOT" || usability.reason === "STATE_NOT_PUBLISHED") {
      return {
        reconciliationState: "MISSING",
        presentationEligible: false,
        localizedCoverage: false,
        workRemaining: true,
        reasons: [usability.reason.toLowerCase()],
        usability,
      };
    }
    return {
      reconciliationState: "BLOCKED",
      presentationEligible: false,
      localizedCoverage: false,
      workRemaining: true,
      reasons: [usability.reason.toLowerCase()],
      usability,
    };
  }

  return {
    reconciliationState: "READY",
    presentationEligible: true,
    localizedCoverage: true,
    workRemaining: false,
    reasons: [],
    usability,
  };
}
