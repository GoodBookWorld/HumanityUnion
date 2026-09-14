/**
 * Reset 03E.4 — shared published-presentation usability contract.
 *
 * Read eligibility and rebuild eligibility are complements of the same classifier.
 * A snapshot rejected by the read path must never suppress its own rebuild.
 */

import type {
  LocalizedPresentationUsability,
  LocalizedPresentationUsabilityReason,
  LocalizationContentIntegrityReport,
  LocalizationStructuralIntegrityReport,
  PublicPresentationNode,
  PublishedLocalizedPresentationRecord,
  PublishedLocalizationSchemaVersion,
} from "@hu/types";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import {
  evaluateLocalizationContentIntegrity,
  resolveLocalizationContentIntegrityForRead,
} from "./content-integrity.js";
import {
  evaluateLocalizationStructuralIntegrity,
  resolveLocalizationStructuralIntegrityForRead,
} from "./structural-integrity.js";
import { mergeLocalizedLayersByProvenance } from "./validate-build-result.js";
import { resolveFieldPolicyForEntityType } from "./universal/resolve-field-policy.js";
import type { PlpFieldPolicyMap } from "@hu/types";

export type UsableLocalizedPresentationSnapshot = {
  readonly state: PublishedLocalizedPresentationRecord["state"];
  readonly identity: PublishedLocalizedPresentationRecord["identity"];
  readonly presentation: PublicPresentationNode | null | undefined;
  readonly contentIntegrity?: LocalizationContentIntegrityReport | null;
  readonly structuralIntegrity?: LocalizationStructuralIntegrityReport | null;
};

export type UsableLocalizedPresentationClassification = {
  readonly usability: LocalizedPresentationUsability;
  readonly reason: LocalizedPresentationUsabilityReason;
  /** Resolver-facing reason codes (preserves LOCALIZATION_* / NO_PUBLISHED_SNAPSHOT). */
  readonly resolveReasonCode: string | null;
  readonly allowPublishedLocalized: boolean;
  readonly rebuildRequired: boolean;
  readonly contentIntegrityStatus: string | null;
  readonly structuralIntegrityStatus: string | null;
};

function rebuild(
  reason: LocalizedPresentationUsabilityReason,
  resolveReasonCode: string,
  integrity?: {
    readonly contentIntegrityStatus?: string | null;
    readonly structuralIntegrityStatus?: string | null;
  },
): UsableLocalizedPresentationClassification {
  return {
    usability: "REBUILD_REQUIRED",
    reason,
    resolveReasonCode,
    allowPublishedLocalized: false,
    rebuildRequired: true,
    contentIntegrityStatus: integrity?.contentIntegrityStatus ?? null,
    structuralIntegrityStatus: integrity?.structuralIntegrityStatus ?? null,
  };
}

/**
 * Shared classifier for locale != en (and identity gates for all locales).
 * Both resolvePublishedPresentation and materialize:media-plp must use this.
 */
export function classifyUsableLocalizedPresentation(input: {
  readonly locale: string;
  readonly liveCanonicalVersion: string | null | undefined;
  readonly liveLocalizationSchemaVersion?: PublishedLocalizationSchemaVersion | string;
  readonly canonicalPresentation: PublicPresentationNode | null | undefined;
  readonly snapshot:
    | UsableLocalizedPresentationSnapshot
    | PublishedLocalizedPresentationRecord
    | null
    | undefined;
}): UsableLocalizedPresentationClassification {
  const liveSchema =
    input.liveLocalizationSchemaVersion ?? PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
  const snapshot = input.snapshot ?? null;

  if (!snapshot) {
    return rebuild("NO_SNAPSHOT", "NO_PUBLISHED_SNAPSHOT");
  }

  if (snapshot.state !== "PUBLISHED") {
    return rebuild("STATE_NOT_PUBLISHED", "NO_PUBLISHED_SNAPSHOT", {
      contentIntegrityStatus: snapshot.contentIntegrity?.status ?? null,
      structuralIntegrityStatus: snapshot.structuralIntegrity?.status ?? null,
    });
  }

  if (
    !input.liveCanonicalVersion ||
    snapshot.identity.canonicalVersion !== input.liveCanonicalVersion
  ) {
    return rebuild("CANONICAL_VERSION_MISMATCH", "CANONICAL_VERSION_MISMATCH", {
      contentIntegrityStatus: snapshot.contentIntegrity?.status ?? null,
      structuralIntegrityStatus: snapshot.structuralIntegrity?.status ?? null,
    });
  }

  if (snapshot.identity.localizationSchemaVersion !== liveSchema) {
    return rebuild("SCHEMA_VERSION_MISMATCH", "SCHEMA_VERSION_MISMATCH", {
      contentIntegrityStatus: snapshot.contentIntegrity?.status ?? null,
      structuralIntegrityStatus: snapshot.structuralIntegrity?.status ?? null,
    });
  }

  if (String(input.locale).toLowerCase() === "en") {
    return {
      usability: "USABLE_LOCALIZED",
      reason: "OK",
      resolveReasonCode: null,
      allowPublishedLocalized: true,
      rebuildRequired: false,
      contentIntegrityStatus: "NOT_APPLICABLE_EN",
      structuralIntegrityStatus: "NOT_APPLICABLE_EN",
    };
  }

  if (
    input.canonicalPresentation == null ||
    snapshot.presentation == null
  ) {
    return rebuild(
      "PRESENTATION_OR_CANONICAL_MISSING",
      "LOCALIZATION_CONTENT_INTEGRITY_MISSING",
    );
  }

  const fieldPolicy = resolveFieldPolicyForEntityType(snapshot.identity.entityType);

  const content = resolveLocalizationContentIntegrityForRead({
    locale: String(input.locale),
    canonicalPresentation: input.canonicalPresentation,
    localizedPresentation: snapshot.presentation,
    fieldPolicy,
    persisted: snapshot.contentIntegrity ?? null,
  });

  if (!content.allowPublishedLocalized) {
    const reason: LocalizedPresentationUsabilityReason =
      content.reasonCode === "LOCALIZATION_CONTENT_INTEGRITY_MISSING"
        ? "CONTENT_INTEGRITY_MISSING"
        : "CONTENT_INTEGRITY_FAILED";
    return rebuild(reason, content.reasonCode, {
      contentIntegrityStatus:
        content.reasonCode === "LOCALIZATION_CONTENT_INTEGRITY_MISSING"
          ? "UNKNOWN_LEGACY"
          : content.report.status,
      structuralIntegrityStatus: snapshot.structuralIntegrity?.status ?? null,
    });
  }

  const structural = resolveLocalizationStructuralIntegrityForRead({
    locale: String(input.locale),
    canonicalPresentation: input.canonicalPresentation,
    localizedPresentation: snapshot.presentation,
    fieldPolicy,
    persisted: snapshot.structuralIntegrity ?? null,
  });

  if (!structural.allowPublishedLocalized) {
    const reason: LocalizedPresentationUsabilityReason =
      structural.reasonCode === "LOCALIZATION_STRUCTURAL_INTEGRITY_MISSING"
        ? "STRUCTURAL_INTEGRITY_MISSING"
        : "STRUCTURAL_INTEGRITY_FAILED";
    return rebuild(reason, structural.reasonCode, {
      contentIntegrityStatus: content.report.status,
      structuralIntegrityStatus:
        structural.reasonCode === "LOCALIZATION_STRUCTURAL_INTEGRITY_MISSING"
          ? "UNKNOWN_LEGACY"
          : structural.report.status,
    });
  }

  return {
    usability: "USABLE_LOCALIZED",
    reason: "OK",
    resolveReasonCode: null,
    allowPublishedLocalized: true,
    rebuildRequired: false,
    contentIntegrityStatus: content.report.status,
    structuralIntegrityStatus: structural.report.status,
  };
}

/**
 * CT path completeness alone is not proof — candidate must pass CLI.1 + LSI.1.
 */
export function translationValuesPassLocalizationIntegrity(input: {
  readonly locale: string;
  readonly canonicalPresentation: PublicPresentationNode;
  readonly values: Readonly<Record<string, string>>;
  readonly fieldPolicy?: PlpFieldPolicyMap;
  readonly entityType?: string;
}): {
  readonly ok: boolean;
  readonly contentIntegrity: LocalizationContentIntegrityReport;
  readonly structuralIntegrity: LocalizationStructuralIntegrityReport;
} {
  const fieldPolicy =
    input.fieldPolicy ??
    (input.entityType
      ? resolveFieldPolicyForEntityType(input.entityType)
      : {});
  const merged = mergeLocalizedLayersByProvenance({
    canonicalPresentation: input.canonicalPresentation,
    layers: [{ source: "MACHINE", values: { ...input.values } }],
  });
  const contentIntegrity = evaluateLocalizationContentIntegrity({
    locale: input.locale,
    canonicalPresentation: input.canonicalPresentation,
    localizedPresentation: merged.presentation,
    fieldPolicy,
  });
  const structuralIntegrity = evaluateLocalizationStructuralIntegrity({
    locale: input.locale,
    canonicalPresentation: input.canonicalPresentation,
    localizedPresentation: merged.presentation,
    fieldPolicy,
  });
  return {
    ok:
      contentIntegrity.status === "PASSED" &&
      structuralIntegrity.status === "PASSED",
    contentIntegrity,
    structuralIntegrity,
  };
}
