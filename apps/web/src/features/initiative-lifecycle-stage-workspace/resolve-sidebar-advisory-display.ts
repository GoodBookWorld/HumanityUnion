/**
 * Pack 02G Task 08E.8a–08E.8d — resolve Working Sidebar advisory descriptors to display text.
 * Display-only. Does not parse English or mutate civic values.
 * API opaque intelligence details bypass this resolver entirely.
 */

import type { InitiativeExperienceTranslator } from "../public-initiative-experience/initiative-experience-i18n";
import {
  ANALYSIS_ADVISORY_MESSAGE_KEY,
  COLLECTIVE_DECISION_ADVISORY_MESSAGE_KEY,
  DECISION_SESSION_ADVISORY_MESSAGE_KEY,
  isAnalysisSidebarAdvisoryCode,
  isCollectiveDecisionSidebarAdvisoryCode,
  isCollectiveDecisionSidebarFieldId,
  isDecisionSessionSidebarAdvisoryCode,
  isDecisionSessionSidebarFieldId,
  isPetitionSidebarAdvisoryCode,
  isPetitionSidebarFieldId,
  isProposalSidebarAdvisoryCode,
  isProposalSidebarFieldId,
  isProposalTreatmentSuggestionCode,
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

  return {
    text: t("author.sidebar.advisories.unknown", { code: advisory.code }),
    code: advisory.code,
    civic: advisory.civic,
  };
}

/** Type helpers for incomplete proposal / petition field ID arrays. */
export type { ProposalSidebarFieldId, PetitionSidebarFieldId };
