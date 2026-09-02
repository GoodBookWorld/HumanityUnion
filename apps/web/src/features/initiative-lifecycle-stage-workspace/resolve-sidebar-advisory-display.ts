/**
 * Pack 02G Task 08E.8a–08E.8f — resolve Working Sidebar advisory descriptors to display text.
 * Display-only. Does not parse English or mutate civic values.
 * API opaque intelligence details bypass this resolver entirely.
 * Overdue/stalled/date/statistics calculations remain derive-owned — this layer only presents codes.
 */

import type { InitiativeExperienceTranslator } from "../public-initiative-experience/initiative-experience-i18n";
import {
  ANALYSIS_ADVISORY_MESSAGE_KEY,
  CIVIC_ARCHIVE_ADVISORY_MESSAGE_KEY,
  COLLECTIVE_DECISION_ADVISORY_MESSAGE_KEY,
  DECISION_SESSION_ADVISORY_MESSAGE_KEY,
  IMPLEMENTATION_COMMITMENT_ADVISORY_MESSAGE_KEY,
  IMPLEMENTATION_TRACKING_ADVISORY_MESSAGE_KEY,
  OFFICIAL_RESPONSE_ADVISORY_MESSAGE_KEY,
  PUBLIC_IMPACT_ADVISORY_MESSAGE_KEY,
  isAnalysisSidebarAdvisoryCode,
  isCivicArchiveSidebarAdvisoryCode,
  isCivicArchiveSidebarFieldId,
  isCollectiveDecisionSidebarAdvisoryCode,
  isCollectiveDecisionSidebarFieldId,
  isDecisionSessionSidebarAdvisoryCode,
  isDecisionSessionSidebarFieldId,
  isImplementationCommitmentSidebarAdvisoryCode,
  isImplementationCommitmentSidebarFieldId,
  isImplementationTrackingSidebarAdvisoryCode,
  isImplementationTrackingSidebarFieldId,
  isOfficialResponseSidebarAdvisoryCode,
  isOfficialResponseSidebarFieldId,
  isPetitionSidebarAdvisoryCode,
  isPetitionSidebarFieldId,
  isProposalSidebarAdvisoryCode,
  isProposalSidebarFieldId,
  isProposalTreatmentSuggestionCode,
  isPublicImpactSidebarAdvisoryCode,
  isPublicImpactSidebarFieldId,
  isPublicImpactSidebarSectionId,
  isRevisionSidebarAdvisoryCode,
  PETITION_ADVISORY_MESSAGE_KEY,
  PROPOSAL_ADVISORY_MESSAGE_KEY,
  REVISION_ADVISORY_MESSAGE_KEY,
  type InitiativeSidebarAdvisory,
  type PetitionSidebarFieldId,
  type ProposalSidebarFieldId,
} from "./sidebar-advisory-contract";

export type SidebarAdvisoryPresentation = {
  readonly text: string;
  readonly code: string;
  readonly civic?: InitiativeSidebarAdvisory["civic"];
};

function paramFlag(params: InitiativeSidebarAdvisory["params"], key: string): boolean {
  const value = params?.[key];
  return value === true || value === 1 || value === "true" || value === "1";
}

function paramNumber(params: InitiativeSidebarAdvisory["params"], key: string): number {
  const value = params?.[key];
  return typeof value === "number" ? value : Number(value ?? 0);
}

/**
 * Canonical Proposal field ID → localized label via author.proposal.fields.*.
 * Unknown → raw ID.
 */
export function resolveProposalSidebarFieldDisplayLabel(
  fieldId: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isProposalSidebarFieldId(fieldId)) {
    return fieldId;
  }
  return t(`author.proposal.fields.${fieldId}`);
}

/**
 * Format Proposal field IDs as a localized, comma-joined list for ICU {fields}.
 */
export function formatProposalSidebarFieldLabels(
  fieldIds: readonly string[],
  t: InitiativeExperienceTranslator,
): string {
  return fieldIds.map((fieldId) => resolveProposalSidebarFieldDisplayLabel(fieldId, t)).join(", ");
}

/**
 * Canonical Petition field ID → localized label via author.petition.fields.*.
 * Unknown → raw ID.
 */
export function resolvePetitionSidebarFieldDisplayLabel(
  fieldId: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isPetitionSidebarFieldId(fieldId)) {
    return fieldId;
  }
  return t(`author.petition.fields.${fieldId}`);
}

/**
 * Decision Session field ID → author.decisionSession.fields.*.
 * Unknown → raw ID.
 */
export function resolveDecisionSessionSidebarFieldDisplayLabel(
  fieldId: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isDecisionSessionSidebarFieldId(fieldId)) {
    return fieldId;
  }
  return t(`author.decisionSession.fields.${fieldId}`);
}

/**
 * Collective Decision field ID → author.collectiveDecision.fields.*.
 * Unknown → raw ID.
 */
export function resolveCollectiveDecisionSidebarFieldDisplayLabel(
  fieldId: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isCollectiveDecisionSidebarFieldId(fieldId)) {
    return fieldId;
  }
  return t(`author.collectiveDecision.fields.${fieldId}`);
}

/**
 * Implementation Commitment field ID → author.commitment.fields.*.
 * Unknown → raw ID.
 */
export function resolveImplementationCommitmentSidebarFieldDisplayLabel(
  fieldId: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isImplementationCommitmentSidebarFieldId(fieldId)) {
    return fieldId;
  }
  return t(`author.commitment.fields.${fieldId}`);
}

/**
 * Implementation Tracking field ID → author.tracking.fields.*.
 * Unknown → raw ID.
 */
export function resolveImplementationTrackingSidebarFieldDisplayLabel(
  fieldId: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isImplementationTrackingSidebarFieldId(fieldId)) {
    return fieldId;
  }
  return t(`author.tracking.fields.${fieldId}`);
}

/**
 * Official Response field ID → author.officialResponse.fields.*.
 * Unknown → raw ID.
 */
export function resolveOfficialResponseSidebarFieldDisplayLabel(
  fieldId: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isOfficialResponseSidebarFieldId(fieldId)) {
    return fieldId;
  }
  return t(`author.officialResponse.fields.${fieldId}`);
}

/**
 * Public Impact field ID → author.publicImpact.fields.*.
 * Unknown → raw ID.
 */
export function resolvePublicImpactSidebarFieldDisplayLabel(
  fieldId: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isPublicImpactSidebarFieldId(fieldId)) {
    return fieldId;
  }
  return t(`author.publicImpact.fields.${fieldId}`);
}

/**
 * Public Impact section ID → author.publicImpact.sections.*.
 * Unknown → raw ID.
 */
export function resolvePublicImpactSidebarSectionDisplayLabel(
  sectionId: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isPublicImpactSidebarSectionId(sectionId)) {
    return sectionId;
  }
  return t(`author.publicImpact.sections.${sectionId}`);
}

/**
 * Civic Archive field ID → author.archive.fields.*.
 * Unknown → raw ID.
 */
export function resolveCivicArchiveSidebarFieldDisplayLabel(
  fieldId: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isCivicArchiveSidebarFieldId(fieldId)) {
    return fieldId;
  }
  return t(`author.archive.fields.${fieldId}`);
}

/**
 * Stable treatment suggestion code → display label.
 * Reuses author.proposal.curation.* where semantics match Accept / Partially accept / Decline.
 * `review` uses advisories.proposal.treatments.review.
 * Unknown → raw code.
 */
export function resolveProposalTreatmentSuggestionDisplayLabel(
  suggestion: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isProposalTreatmentSuggestionCode(suggestion)) {
    return suggestion;
  }
  if (suggestion === "accept") {
    return t("author.proposal.curation.included_in_revision");
  }
  if (suggestion === "partially_accept") {
    return t("author.proposal.curation.keep_for_later");
  }
  if (suggestion === "decline") {
    return t("author.proposal.curation.not_applicable");
  }
  return t("author.sidebar.advisories.proposal.treatments.review");
}

function buildInterpolationValues(
  advisory: InitiativeSidebarAdvisory,
  t: InitiativeExperienceTranslator,
): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  if (advisory.params) {
    for (const [key, value] of Object.entries(advisory.params)) {
      if (typeof value === "boolean") {
        values[key] = value ? "true" : "false";
      } else {
        values[key] = value;
      }
    }
  }
  if (advisory.civic?.subject != null) {
    values.topic = advisory.civic.subject;
  }
  if (advisory.civic?.title != null) {
    values.title = advisory.civic.title;
  }
  if (advisory.civic?.role != null) {
    values.role = advisory.civic.role;
  }
  if (advisory.civic?.excerpt != null) {
    values.excerpt = advisory.civic.excerpt;
  }
  if (advisory.civic?.trackingTitle != null) {
    values.trackingTitle = advisory.civic.trackingTitle;
  }
  if (advisory.civic?.subject != null) {
    values.subject = advisory.civic.subject;
  }
  if (advisory.civic?.fieldIds && advisory.civic.fieldIds.length > 0) {
    values.fields = formatProposalSidebarFieldLabels(advisory.civic.fieldIds, t);
  }
  if (advisory.civic?.petitionFieldIds && advisory.civic.petitionFieldIds.length > 0) {
    values.field = resolvePetitionSidebarFieldDisplayLabel(advisory.civic.petitionFieldIds[0]!, t);
  }
  if (
    advisory.civic?.decisionSessionFieldIds &&
    advisory.civic.decisionSessionFieldIds.length > 0
  ) {
    values.field = resolveDecisionSessionSidebarFieldDisplayLabel(
      advisory.civic.decisionSessionFieldIds[0]!,
      t,
    );
  }
  if (
    advisory.civic?.collectiveDecisionFieldIds &&
    advisory.civic.collectiveDecisionFieldIds.length > 0
  ) {
    values.field = resolveCollectiveDecisionSidebarFieldDisplayLabel(
      advisory.civic.collectiveDecisionFieldIds[0]!,
      t,
    );
  }
  if (
    advisory.civic?.implementationCommitmentFieldIds &&
    advisory.civic.implementationCommitmentFieldIds.length > 0
  ) {
    values.field = resolveImplementationCommitmentSidebarFieldDisplayLabel(
      advisory.civic.implementationCommitmentFieldIds[0]!,
      t,
    );
  }
  if (
    advisory.civic?.implementationTrackingFieldIds &&
    advisory.civic.implementationTrackingFieldIds.length > 0
  ) {
    values.field = resolveImplementationTrackingSidebarFieldDisplayLabel(
      advisory.civic.implementationTrackingFieldIds[0]!,
      t,
    );
  }
  if (
    advisory.civic?.officialResponseFieldIds &&
    advisory.civic.officialResponseFieldIds.length > 0
  ) {
    values.field = resolveOfficialResponseSidebarFieldDisplayLabel(
      advisory.civic.officialResponseFieldIds[0]!,
      t,
    );
  }
  if (advisory.civic?.publicImpactFieldIds && advisory.civic.publicImpactFieldIds.length > 0) {
    values.field = resolvePublicImpactSidebarFieldDisplayLabel(
      advisory.civic.publicImpactFieldIds[0]!,
      t,
    );
  }
  if (advisory.civic?.civicArchiveFieldIds && advisory.civic.civicArchiveFieldIds.length > 0) {
    values.field = resolveCivicArchiveSidebarFieldDisplayLabel(
      advisory.civic.civicArchiveFieldIds[0]!,
      t,
    );
  }
  if (advisory.civic?.title != null) {
    values.label = advisory.civic.title;
  } else if (advisory.civic?.publicImpactSectionId != null) {
    values.label = resolvePublicImpactSidebarSectionDisplayLabel(
      advisory.civic.publicImpactSectionId,
      t,
    );
  }
  return values;
}

/** Preserve omit-empty join semantics from pre-migration DS sources summary. */
function resolveDecisionSessionSourcesSummary(
  advisory: InitiativeSidebarAdvisory,
  t: InitiativeExperienceTranslator,
): string {
  const parts: string[] = [];
  if (paramFlag(advisory.params, "hasPetition")) {
    parts.push(t("author.sidebar.advisories.decisionSession.sources.petition"));
  }
  if (paramFlag(advisory.params, "hasRevision")) {
    parts.push(
      t("author.sidebar.advisories.decisionSession.sources.revision", {
        version: paramNumber(advisory.params, "revisionVersion"),
      }),
    );
  }
  if (paramFlag(advisory.params, "hasAnalysis")) {
    parts.push(t("author.sidebar.advisories.decisionSession.sources.analysis"));
  }
  const proposalCount = paramNumber(advisory.params, "proposalCount");
  if (proposalCount > 0) {
    parts.push(
      t("author.sidebar.advisories.decisionSession.sources.proposals", {
        count: proposalCount,
      }),
    );
  }
  const allyCount = paramNumber(advisory.params, "allyRecommendationCount");
  if (allyCount > 0) {
    parts.push(
      t("author.sidebar.advisories.decisionSession.sources.allies", {
        count: allyCount,
      }),
    );
  }
  return parts.join(" · ");
}

/** Preserve omit-empty join semantics from pre-migration CD sources summary. */
function resolveCollectiveDecisionSourcesSummary(
  advisory: InitiativeSidebarAdvisory,
  t: InitiativeExperienceTranslator,
): string {
  const parts: string[] = [];
  if (paramFlag(advisory.params, "hasDecisionSession")) {
    parts.push(t("author.sidebar.advisories.collectiveDecision.sources.decisionSession"));
  }
  if (paramFlag(advisory.params, "hasPetition")) {
    parts.push(t("author.sidebar.advisories.collectiveDecision.sources.petition"));
  }
  if (paramFlag(advisory.params, "hasRevision")) {
    parts.push(
      t("author.sidebar.advisories.collectiveDecision.sources.revision", {
        version: paramNumber(advisory.params, "revisionVersion"),
      }),
    );
  }
  if (paramFlag(advisory.params, "hasAnalysis")) {
    parts.push(t("author.sidebar.advisories.collectiveDecision.sources.analysis"));
  }
  const proposalCount = paramNumber(advisory.params, "proposalCount");
  if (proposalCount > 0) {
    parts.push(
      t("author.sidebar.advisories.collectiveDecision.sources.proposals", {
        count: proposalCount,
      }),
    );
  }
  return parts.join(" · ");
}

/** Preserve Commitment sources omit-empty + always-include ally-count semantics. */
function resolveImplementationCommitmentSourcesSummary(
  advisory: InitiativeSidebarAdvisory,
  t: InitiativeExperienceTranslator,
): string {
  const parts: string[] = [];
  if (paramFlag(advisory.params, "hasDecision")) {
    parts.push(
      t("author.sidebar.advisories.implementationCommitment.sources.decision", {
        title: String(advisory.civic?.title ?? ""),
      }),
    );
  }
  parts.push(
    t("author.sidebar.advisories.implementationCommitment.sources.allies", {
      count: paramNumber(advisory.params, "activeAllyCount"),
    }),
  );
  return parts.join(" · ");
}

/** Preserve Tracking sources omit-empty package + always-include count fragments. */
function resolveImplementationTrackingSourcesSummary(
  advisory: InitiativeSidebarAdvisory,
  t: InitiativeExperienceTranslator,
): string {
  const parts: string[] = [];
  if (paramFlag(advisory.params, "hasPackage")) {
    parts.push(
      t("author.sidebar.advisories.implementationTracking.sources.package", {
        title: String(advisory.civic?.title ?? ""),
      }),
    );
  }
  parts.push(
    t("author.sidebar.advisories.implementationTracking.sources.commitments", {
      count: paramNumber(advisory.params, "acceptedCommitmentCount"),
    }),
  );
  parts.push(
    t("author.sidebar.advisories.implementationTracking.sources.actions", {
      count: paramNumber(advisory.params, "decisionActionCount"),
    }),
  );
  parts.push(
    t("author.sidebar.advisories.implementationTracking.sources.allies", {
      count: paramNumber(advisory.params, "activeAllyCount"),
    }),
  );
  return parts.join(" · ");
}

/** Preserve Official Response sources omit-empty + always-include count fragments. */
function resolveOfficialResponseSourcesSummary(
  advisory: InitiativeSidebarAdvisory,
  t: InitiativeExperienceTranslator,
): string {
  const parts: string[] = [];
  if (paramFlag(advisory.params, "hasTracking")) {
    parts.push(
      t("author.sidebar.advisories.officialResponse.sources.tracking", {
        title: String(advisory.civic?.title ?? ""),
      }),
    );
  }
  parts.push(
    t("author.sidebar.advisories.officialResponse.sources.records", {
      count: paramNumber(advisory.params, "trackingRecordCount"),
    }),
  );
  parts.push(
    t("author.sidebar.advisories.officialResponse.sources.allies", {
      count: paramNumber(advisory.params, "activeAllyCount"),
    }),
  );
  return parts.join(" · ");
}

/** Preserve Public Impact sources omit-empty + always-include count fragments. */
function resolvePublicImpactSourcesSummary(
  advisory: InitiativeSidebarAdvisory,
  t: InitiativeExperienceTranslator,
): string {
  const parts: string[] = [];
  if (paramFlag(advisory.params, "hasOfficial")) {
    const title = String(advisory.civic?.title ?? "");
    parts.push(
      paramFlag(advisory.params, "noResponseOutcome")
        ? t("author.sidebar.advisories.publicImpact.sources.officialNoResponse", { title })
        : t("author.sidebar.advisories.publicImpact.sources.official", { title }),
    );
  }
  if (paramFlag(advisory.params, "hasTracking")) {
    parts.push(
      t("author.sidebar.advisories.publicImpact.sources.tracking", {
        trackingTitle: String(advisory.civic?.trackingTitle ?? ""),
      }),
    );
  }
  parts.push(
    t("author.sidebar.advisories.publicImpact.sources.evidence", {
      count: paramNumber(advisory.params, "evidenceCount"),
    }),
  );
  parts.push(
    t("author.sidebar.advisories.publicImpact.sources.allies", {
      count: paramNumber(advisory.params, "activeAllyCount"),
    }),
  );
  return parts.join(" · ");
}

/** Preserve Civic Archive sources omit-empty + always-include stage count. */
function resolveCivicArchiveSourcesSummary(
  advisory: InitiativeSidebarAdvisory,
  t: InitiativeExperienceTranslator,
): string {
  const parts: string[] = [];
  if (paramFlag(advisory.params, "hasPublicImpact")) {
    parts.push(
      t("author.sidebar.advisories.civicArchive.sources.publicImpact", {
        title: String(advisory.civic?.title ?? ""),
      }),
    );
  }
  if (paramFlag(advisory.params, "hasOfficial")) {
    parts.push(
      t("author.sidebar.advisories.civicArchive.sources.official", {
        subject: String(advisory.civic?.subject ?? ""),
      }),
    );
  }
  if (paramFlag(advisory.params, "hasTracking")) {
    parts.push(
      t("author.sidebar.advisories.civicArchive.sources.tracking", {
        trackingTitle: String(advisory.civic?.trackingTitle ?? ""),
      }),
    );
  }
  parts.push(
    t("author.sidebar.advisories.civicArchive.sources.stages", {
      count: paramNumber(advisory.params, "publishedStageCount"),
    }),
  );
  return parts.join(" · ");
}

/**
 * Map a known stage advisory code → localized text.
 * Defensive fallback for malformed/external codes: localized unknown label + raw code.
 * API opaque intelligence details must not pass through this resolver.
 */
export function resolveSidebarAdvisoryDisplay(
  advisory: InitiativeSidebarAdvisory,
  t: InitiativeExperienceTranslator,
): SidebarAdvisoryPresentation {
  const values = buildInterpolationValues(advisory, t);

  if (isAnalysisSidebarAdvisoryCode(advisory.code)) {
    const leaf = ANALYSIS_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.analysis.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  if (isProposalSidebarAdvisoryCode(advisory.code)) {
    const leaf = PROPOSAL_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.proposal.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  if (isRevisionSidebarAdvisoryCode(advisory.code)) {
    const leaf = REVISION_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.revision.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  if (isPetitionSidebarAdvisoryCode(advisory.code)) {
    const leaf = PETITION_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.petition.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  if (isDecisionSessionSidebarAdvisoryCode(advisory.code)) {
    if (advisory.code === "decision_session.sources.summary") {
      return {
        text: resolveDecisionSessionSourcesSummary(advisory, t),
        code: advisory.code,
        civic: advisory.civic,
      };
    }
    const leaf = DECISION_SESSION_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.decisionSession.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  if (isCollectiveDecisionSidebarAdvisoryCode(advisory.code)) {
    if (advisory.code === "collective_decision.sources.summary") {
      return {
        text: resolveCollectiveDecisionSourcesSummary(advisory, t),
        code: advisory.code,
        civic: advisory.civic,
      };
    }
    const leaf = COLLECTIVE_DECISION_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.collectiveDecision.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  if (isImplementationCommitmentSidebarAdvisoryCode(advisory.code)) {
    if (advisory.code === "implementation_commitment.sources.summary") {
      return {
        text: resolveImplementationCommitmentSourcesSummary(advisory, t),
        code: advisory.code,
        civic: advisory.civic,
      };
    }
    const leaf = IMPLEMENTATION_COMMITMENT_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.implementationCommitment.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  if (isImplementationTrackingSidebarAdvisoryCode(advisory.code)) {
    if (advisory.code === "implementation_tracking.sources.summary") {
      return {
        text: resolveImplementationTrackingSourcesSummary(advisory, t),
        code: advisory.code,
        civic: advisory.civic,
      };
    }
    const leaf = IMPLEMENTATION_TRACKING_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.implementationTracking.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  if (isOfficialResponseSidebarAdvisoryCode(advisory.code)) {
    if (advisory.code === "official_response.sources.summary") {
      return {
        text: resolveOfficialResponseSourcesSummary(advisory, t),
        code: advisory.code,
        civic: advisory.civic,
      };
    }
    const leaf = OFFICIAL_RESPONSE_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.officialResponse.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  if (isPublicImpactSidebarAdvisoryCode(advisory.code)) {
    if (advisory.code === "public_impact.sources.summary") {
      return {
        text: resolvePublicImpactSourcesSummary(advisory, t),
        code: advisory.code,
        civic: advisory.civic,
      };
    }
    const leaf = PUBLIC_IMPACT_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.publicImpact.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  if (isCivicArchiveSidebarAdvisoryCode(advisory.code)) {
    if (advisory.code === "civic_archive.sources.summary") {
      return {
        text: resolveCivicArchiveSourcesSummary(advisory, t),
        code: advisory.code,
        civic: advisory.civic,
      };
    }
    const leaf = CIVIC_ARCHIVE_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.civicArchive.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  return {
    text: t("author.sidebar.advisories.unknown", { code: advisory.code }),
    code: advisory.code,
    civic: advisory.civic,
  };
}

/** Type helpers for incomplete proposal / petition field ID arrays. */
export type { ProposalSidebarFieldId, PetitionSidebarFieldId };
