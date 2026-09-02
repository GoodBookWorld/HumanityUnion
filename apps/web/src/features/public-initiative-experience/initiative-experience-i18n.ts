/**
 * Pack 02G Task 08B.1 — Initiative Experience display localization helpers.
 * Display-only. Canonical API/domain values are never mutated.
 */

import {
  INITIATIVE_ACTIVITY_AREA_OPTIONS,
  PUBLIC_INITIATIVE_EXPERIENCE_STAGES,
  type InitiativeActivityAreaOption,
  type InitiativeExperienceLifecycleStageState,
  type InitiativeLifecyclePhase,
  type InitiativeStatus,
  type ParticipationScope,
} from "@hu/types";

import { formatLanguageDisplayName } from "../language/format-language-display-name";

/** Message keys under initiativeExperience.activityAreas.* */
export const ACTIVITY_AREA_MESSAGE_KEY_BY_VALUE: Record<
  InitiativeActivityAreaOption,
  string
> = {
  "Human Rights": "humanRights",
  "Peace and Security": "peaceAndSecurity",
  "Democracy and Governance": "democracyAndGovernance",
  "Justice and Rule of Law": "justiceAndRuleOfLaw",
  "Environment and Climate": "environmentAndClimate",
  "Public Health": "publicHealth",
  Education: "education",
  "Science and Research": "scienceAndResearch",
  "Technology and Digital Society": "technologyAndDigitalSociety",
  "Information Integrity and Media Literacy": "informationIntegrityAndMediaLiteracy",
  "Economy and Employment": "economyAndEmployment",
  "Poverty Reduction and Social Protection": "povertyReductionAndSocialProtection",
  "Housing and Community Development": "housingAndCommunityDevelopment",
  "Food and Agriculture": "foodAndAgriculture",
  Energy: "energy",
  "Infrastructure and Transport": "infrastructureAndTransport",
  "Culture and Heritage": "cultureAndHeritage",
  "Equality and Inclusion": "equalityAndInclusion",
  "Children and Youth": "childrenAndYouth",
  "Older Persons": "olderPersons",
  "Disability Inclusion": "disabilityInclusion",
  "Migration and Integration": "migrationAndIntegration",
  "Emergency Preparedness and Response": "emergencyPreparednessAndResponse",
  "International Cooperation": "internationalCooperation",
  "Animal Welfare": "animalWelfare",
  Other: "other",
};

export type InitiativeExperienceMessages = Record<string, unknown>;

/** next-intl translator scoped to `initiativeExperience`. */
export type InitiativeExperienceTranslator = {
  (key: string, values?: Record<string, string | number | Date>): string;
};

function readNestedString(root: unknown, dottedKey: string): string | undefined {
  const parts = dottedKey.split(".");
  let cursor: unknown = root;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === "string" ? cursor : undefined;
}

export function resolveInitiativeExperienceMessage(
  messages: InitiativeExperienceMessages,
  dottedKey: string,
): string | undefined {
  const ns = messages.initiativeExperience;
  return readNestedString(ns, dottedKey);
}

function resolveLabel(
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
  key: string,
  fallback: string,
): string {
  if (typeof messagesOrT === "function") {
    try {
      const value = messagesOrT(key);
      return value.trim() ? value : fallback;
    } catch {
      return fallback;
    }
  }
  return resolveInitiativeExperienceMessage(messagesOrT, key) || fallback;
}

/** Locale-aware calendar date for hero/overview/sidebar (interface locale). */
export function formatInitiativeExperienceDate(
  locale: string,
  iso: string | null | undefined,
  options?: { month?: "long" | "short" },
): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: options?.month ?? "long",
    day: "numeric",
  });
}

/** Human-readable language name for the active interface locale. */
export function formatInitiativeExperienceLanguageName(
  interfaceLocale: string,
  languageCode: string,
): string {
  return formatLanguageDisplayName(interfaceLocale, languageCode);
}

export function resolveLifecycleStageDisplayLabel(
  stageId: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
  fallbackLabel?: string,
): string {
  return resolveLabel(messagesOrT, `stages.${stageId}`, fallbackLabel || stageId);
}

export function resolveLifecycleStateDisplayLabel(
  state: InitiativeExperienceLifecycleStageState | string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
  fallbackLabel?: string,
): string {
  return resolveLabel(messagesOrT, `states.${state}`, fallbackLabel || state);
}

export function resolveLifecyclePhaseDisplayLabel(
  phase: InitiativeLifecyclePhase | string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  return resolveLabel(messagesOrT, `phases.${phase}`, phase);
}

export function resolveInitiativeStatusDisplayLabel(
  status: InitiativeStatus | string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  return resolveLabel(
    messagesOrT,
    `statuses.${status}`,
    status.replaceAll("_", " "),
  );
}

export function resolveActivityAreaDisplayLabel(
  activityArea: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  const messageKey = ACTIVITY_AREA_MESSAGE_KEY_BY_VALUE[
    activityArea as InitiativeActivityAreaOption
  ];
  if (!messageKey) {
    return activityArea;
  }
  return resolveLabel(messagesOrT, `activityAreas.${messageKey}`, activityArea);
}

export function resolvePresentationStatusDisplayLabel(
  status: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  return resolveLabel(messagesOrT, `presentationStatuses.${status}`, status);
}

const PROPOSAL_CURATION_CODES = new Set<string>([
  "draft",
  "ready",
  "published",
  "included_in_revision",
  "keep_for_later",
  "not_applicable",
]);

/**
 * Display-only label for InitiativeStructuredProposal status / curation codes.
 * Canonical codes stay unchanged for select values and API submission.
 */
export function resolveProposalCurationDisplayLabel(
  status: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (!PROPOSAL_CURATION_CODES.has(status)) {
    return status.replaceAll("_", " ");
  }
  return resolveLabel(messagesOrT, `author.proposal.curation.${status}`, status);
}

const PETITION_PROPOSAL_ACCEPTANCE_CODES = new Set<string>(["accepted", "partially_accepted"]);

/**
 * Display-only label for Petition snapshot proposal acceptance codes.
 * Domain contract: InitiativePetitionProposalReference.status is only
 * `"accepted" | "partially_accepted"`. Unknown codes fall back to the raw
 * code — never map unknowns to "Partially accepted".
 */
export function resolvePetitionProposalAcceptanceDisplayLabel(
  status: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (!PETITION_PROPOSAL_ACCEPTANCE_CODES.has(status)) {
    return status;
  }
  return resolveLabel(messagesOrT, `author.petition.proposalAcceptance.${status}`, status);
}

const PARTICIPATION_SCOPE_CODES = new Set<string>([
  "world",
  "country",
  "region",
  "community",
]);

/**
 * Display-only label for canonical ParticipationScope codes.
 * Reuses manage.scopes.* — never submit/store the localized string.
 */
export function resolveParticipationScopeDisplayLabel(
  scope: ParticipationScope | string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (!PARTICIPATION_SCOPE_CODES.has(scope)) {
    return scope;
  }
  return resolveLabel(messagesOrT, `manage.scopes.${scope}`, scope);
}

const COLLECTIVE_DECISION_STATUS_CODES = new Set<string>([
  "draft",
  "opened",
  "closed",
  "cancelled",
]);

/**
 * Display-only label for InitiativeCollectiveDecisionStatus codes.
 * Domain contract: `"draft" | "opened" | "closed" | "cancelled"`.
 * Unknown codes fall back to the raw code — never invent meaning.
 */
export function resolveCollectiveDecisionStatusDisplayLabel(
  status: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (!COLLECTIVE_DECISION_STATUS_CODES.has(status)) {
    return status;
  }
  return resolveLabel(messagesOrT, `author.collectiveDecision.statuses.${status}`, status);
}

/**
 * Display-only vote-choice labels reused from collaboration.vote.*.
 * Canonical codes (`support` | `do_not_support` | `abstain`) stay unchanged.
 */
export function resolveInitiativeDecisionVoteChoiceDisplayLabel(
  choice: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  switch (choice) {
    case "support":
      return resolveLabel(messagesOrT, "collaboration.vote.support", choice);
    case "do_not_support":
      return resolveLabel(messagesOrT, "collaboration.vote.doNotSupport", choice);
    case "abstain":
      return resolveLabel(messagesOrT, "collaboration.vote.abstain", choice);
    default:
      return choice;
  }
}

const COMMITMENT_CANDIDATE_STATUS_CODES = new Set<string>(["draft"]);

/**
 * Display-only label for Commitment Candidate draft status.
 * Domain contract today: candidate drafts use `"draft"` only.
 */
export function resolveCommitmentCandidateStatusDisplayLabel(
  status: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (!COMMITMENT_CANDIDATE_STATUS_CODES.has(status)) {
    return status;
  }
  return resolveLabel(messagesOrT, `author.commitment.candidateStatuses.${status}`, status);
}

const COMMITMENT_VIEW_STATE_CODES = new Set<string>([
  "available",
  "awaiting_you",
  "awaiting_response",
  "accepted",
  "transfer_pending",
  "completed",
  "withdrawn",
  "declined",
]);

/**
 * Display-only labels for Commitment PublicResult view states
 * (derived UI states, not raw proposalStatus codes).
 * Unknown/legacy codes fall back to empty or raw without inventing meaning.
 */
export function resolveCommitmentViewStateDisplayLabel(
  state: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (state === "legacy") {
    return "";
  }
  if (!COMMITMENT_VIEW_STATE_CODES.has(state)) {
    return state;
  }
  return resolveLabel(messagesOrT, `author.commitment.viewStates.${state}`, state);
}

const OFFICIAL_RESPONSE_TYPE_CODES = new Set<string>([
  "official_letter",
  "email",
  "public_statement",
  "meeting_minutes",
  "policy_update",
  "decision_notice",
  "media_response",
  "other",
]);

/** Display-only OfficialResponseType labels. Select values stay canonical. */
export function resolveOfficialResponseTypeDisplayLabel(
  type: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (!OFFICIAL_RESPONSE_TYPE_CODES.has(type)) {
    return type;
  }
  return resolveLabel(messagesOrT, `author.officialResponse.responseTypes.${type}`, type);
}

const OFFICIAL_RESPONSE_VERIFICATION_CODES = new Set<string>([
  "pending",
  "verified",
  "unable_to_verify",
]);

/** Display-only OfficialResponseVerificationState labels. */
export function resolveOfficialResponseVerificationDisplayLabel(
  status: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (!OFFICIAL_RESPONSE_VERIFICATION_CODES.has(status)) {
    return status;
  }
  return resolveLabel(
    messagesOrT,
    `author.officialResponse.verificationStatuses.${status}`,
    status,
  );
}

const PUBLIC_IMPACT_SECTION_CODES = new Set<string>([
  "executive_summary",
  "objectives",
  "implemented_actions",
  "completed_commitments",
  "implementation_progress",
  "official_responses",
  "community_participation",
  "outstanding_issues",
  "lessons_learned",
  "evidence",
  "impact_references",
]);

/**
 * Display-only Public Impact section-id labels (chips / title fallback).
 * Author-entered section.title remains canonical civic content.
 */
export function resolvePublicImpactSectionDisplayLabel(
  sectionId: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (!PUBLIC_IMPACT_SECTION_CODES.has(sectionId)) {
    return sectionId;
  }
  return resolveLabel(messagesOrT, `author.publicImpact.sections.${sectionId}`, sectionId);
}

const CIVIC_ARCHIVE_SECTION_CODES = new Set<string>([
  "archive_overview",
  "original_initiative",
  "discussion_and_participation",
  "collaborative_analysis",
  "improvement_proposals",
  "revision_and_change_history",
  "petition_and_public_participation",
  "decision_session",
  "collective_decision",
  "approved_actions",
  "implementation_commitments",
  "implementation_tracking",
  "official_responses",
  "public_impact",
  "final_results",
  "outstanding_work",
  "lessons_learned",
  "knowledge_contribution",
  "lifecycle_timeline",
  "sources_and_traceability",
]);

/**
 * Display-only Civic Archive section-id labels (chips / title fallback).
 * Historical section.title/body remain canonical archive content.
 */
export function resolveCivicArchiveSectionDisplayLabel(
  sectionId: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (!CIVIC_ARCHIVE_SECTION_CODES.has(sectionId)) {
    return sectionId;
  }
  return resolveLabel(messagesOrT, `author.archive.sections.${sectionId}`, sectionId);
}

const CIVIC_ARCHIVE_TIMELINE_STATUS_CODES = new Set<string>([
  "published",
  "finalized",
  "completed",
  "partial",
  "missing",
  "archived",
]);

/** Display-only InitiativeCivicArchiveTimelineStatus labels. */
export function resolveCivicArchiveTimelineStatusDisplayLabel(
  status: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (!CIVIC_ARCHIVE_TIMELINE_STATUS_CODES.has(status)) {
    return status;
  }
  return resolveLabel(messagesOrT, `author.archive.timelineStatuses.${status}`, status);
}

const PUBLIC_CHOICE_ELECTION_VOTING_STATUS_CODES = new Set<string>([
  "NOT_STARTED",
  "OPEN",
  "CLOSED",
  "EXPIRED",
]);

/**
 * Pack 02G 08E.5 — display-only Public Choice election voting status labels.
 * Canonical codes unchanged. Unknown → raw code (no English helper / replaceAll).
 */
export function resolvePublicChoiceElectionVotingStatusDisplayLabel(
  status: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (!PUBLIC_CHOICE_ELECTION_VOTING_STATUS_CODES.has(status)) {
    return status;
  }
  return resolveLabel(messagesOrT, `publicChoice.statuses.${status}`, status);
}

/**
 * Pack 02G 08E.4 — display-only mapping from stable AI-apply form field IDs
 * to existing author.*.fields.* catalog keys. Canonical IDs are never mutated.
 */
export type LifecycleAiApplyNoticeStageId =
  | "petition"
  | "decision_session"
  | "collective_decision";

const DECISION_SESSION_AI_APPLY_FIELD_CATALOG_KEY: Readonly<Record<string, string>> = {
  title: "title",
  decisionQuestion: "question",
  decisionContext: "context",
  objectives: "objectives",
  options: "options",
  supportingArguments: "arguments",
  risks: "risks",
  dependencies: "dependencies",
  requiredResources: "requiredResources",
  suggestedTimeline: "timeline",
  suggestedParticipants: "participants",
  suggestedResponsibleRoles: "roles",
  unresolvedQuestions: "unresolvedQuestions",
};

const COLLECTIVE_DECISION_AI_APPLY_FIELD_CATALOG_KEY: Readonly<Record<string, string>> = {
  title: "title",
  decisionSummary: "summary",
  approvedActions: "approvedActions",
  rejectedAlternatives: "rejectedAlternatives",
  responsibleRoles: "roles",
  implementationPriorities: "priorities",
  implementationTimeline: "timeline",
  decisionRationale: "rationale",
  decisionRisks: "risks",
  successCriteria: "criteria",
  requiredResources: "requiredResources",
  supportingReferences: "supportingReferences",
};

/** Resolve a localized field label for an AI-apply changed field ID. Unknown → raw id. */
export function resolveLifecycleAiApplyFieldDisplayLabel(
  stageId: LifecycleAiApplyNoticeStageId,
  fieldId: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  if (stageId === "petition") {
    return resolveLabel(messagesOrT, `author.petition.fields.${fieldId}`, fieldId);
  }
  if (stageId === "decision_session") {
    const catalogKey = DECISION_SESSION_AI_APPLY_FIELD_CATALOG_KEY[fieldId];
    if (!catalogKey) {
      return fieldId;
    }
    return resolveLabel(
      messagesOrT,
      `author.decisionSession.fields.${catalogKey}`,
      fieldId,
    );
  }
  const catalogKey = COLLECTIVE_DECISION_AI_APPLY_FIELD_CATALOG_KEY[fieldId];
  if (!catalogKey) {
    return fieldId;
  }
  return resolveLabel(
    messagesOrT,
    `author.collectiveDecision.fields.${catalogKey}`,
    fieldId,
  );
}

/** Locale-aware conjunction list for AI-apply field labels. */
export function formatLifecycleAiApplyFieldsList(
  locale: string,
  labels: readonly string[],
): string {
  if (labels.length === 0) {
    return "";
  }
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format([
      ...labels,
    ]);
  } catch {
    return labels.join(", ");
  }
}

/** Build the structured AI-apply notice from catalog + localized field labels. */
export function formatLifecycleAiApplyNotice(input: {
  readonly locale: string;
  readonly stageId: LifecycleAiApplyNoticeStageId;
  readonly changedKeys: readonly string[];
  readonly t: InitiativeExperienceTranslator;
  readonly saveDraft: string;
  readonly preview: string;
  readonly publish: string;
}): string {
  const labels = input.changedKeys.map((fieldId) =>
    resolveLifecycleAiApplyFieldDisplayLabel(input.stageId, fieldId, input.t),
  );
  return input.t("author.actions.aiApplied", {
    fields: formatLifecycleAiApplyFieldsList(input.locale, labels),
    saveDraft: input.saveDraft,
    preview: input.preview,
    publish: input.publish,
  });
}

/** Contract: every public stageId has a catalog key path stages.{id}. */
export function listPublicLifecycleStageIdsForI18n(): readonly string[] {
  return PUBLIC_INITIATIVE_EXPERIENCE_STAGES.map((stage) => stage.stageId);
}

/** Contract: every activity-area option has a message key mapping. */
export function listActivityAreaValuesForI18n(): readonly InitiativeActivityAreaOption[] {
  return INITIATIVE_ACTIVITY_AREA_OPTIONS;
}
