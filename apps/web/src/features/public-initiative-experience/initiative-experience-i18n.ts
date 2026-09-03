/**
 * Pack 02G Task 08B.1 — Initiative Experience display localization helpers.
 * Display-only. Canonical API/domain values are never mutated.
 */

import {
  INITIATIVE_ACTIVITY_AREA_OPTIONS,
  PUBLIC_INITIATIVE_EXPERIENCE_STAGES,
  type InitiativeActivityAreaOption,
  type InitiativeCollaborationSystemEventKind,
  type InitiativeExperienceLifecycleStageState,
  type InitiativeLifecyclePhase,
  type InitiativeStatus,
  type ParticipationScope,
} from "@hu/types";

import { formatLanguageDisplayName } from "../language/format-language-display-name";
import { normalizeInitiativeStageCode } from "./normalize-initiative-stage-code";
import {
  looksLikeRawI18nKey,
  normalizeInitiativeStatusCode,
} from "./normalize-initiative-status-code";

function humanizeFallback(code: string): string {
  return code
    .trim()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

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
  values?: Record<string, string | number | boolean>,
): string {
  const translatorValues = values
    ? (Object.fromEntries(
        Object.entries(values).map(([name, value]) => [
          name,
          typeof value === "boolean" ? String(value) : value,
        ]),
      ) as Record<string, string | number | Date>)
    : undefined;

  const isUnresolved = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      return true;
    }
    if (looksLikeRawI18nKey(trimmed)) {
      return true;
    }
    if (trimmed === key) {
      return true;
    }
    const lower = trimmed.toLowerCase();
    const keyLower = key.toLowerCase();
    if (lower.endsWith(`.${keyLower}`) || lower === keyLower) {
      return true;
    }
    // Pack 08I.11 — catch namespace.key even when casing differs from lookup key.
    if (/\.(stages|statuses|states|phases)\./i.test(trimmed)) {
      return true;
    }
    return false;
  };

  if (typeof messagesOrT === "function") {
    try {
      const value = messagesOrT(key, translatorValues);
      if (isUnresolved(value)) {
        return fallback;
      }
      return value.trim();
    } catch {
      return fallback;
    }
  }
  const template = resolveInitiativeExperienceMessage(messagesOrT, key);
  if (!template || isUnresolved(template)) {
    return fallback;
  }
  if (!translatorValues) {
    return template;
  }
  let result = template;
  for (const [name, value] of Object.entries(translatorValues)) {
    result = result.replaceAll(`{${name}}`, String(value));
  }
  return result.trim() ? result : fallback;
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
  const code = normalizeInitiativeStageCode(stageId);
  const humanFallback = humanizeFallback(fallbackLabel || code);
  return resolveLabel(messagesOrT, `stages.${code}`, humanFallback);
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
  const code = normalizeInitiativeStatusCode(status);
  const humanFallback = humanizeFallback(code);
  return resolveLabel(messagesOrT, `statuses.${code}`, humanFallback);
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

const CIVIC_ARCHIVE_COMPLETENESS_SUMMARY_CODES = new Set<string>([
  "stages_published",
  "public_impact_available",
  "public_impact_missing",
  "public_impact_available_optional",
  "public_impact_not_required_public_choice",
  "tracking_unresolved",
  "tracking_resolved",
  "commitments_unfinished",
  "commitments_finished",
]);

/**
 * Pack 02G 08G — localize finite completeness summaryDescriptors.
 * Falls back to English `summary` when descriptors are missing (skew).
 */
export function resolveCivicArchiveCompletenessSummaryDisplay(
  completeness: {
    readonly summary: string;
    readonly summaryDescriptors?: readonly {
      readonly code: string;
      readonly params?: Readonly<Record<string, string | number | boolean>>;
    }[];
  },
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  const descriptors = completeness.summaryDescriptors;
  if (!descriptors || descriptors.length === 0) {
    return completeness.summary;
  }

  const parts: string[] = [];
  for (const descriptor of descriptors) {
    if (!CIVIC_ARCHIVE_COMPLETENESS_SUMMARY_CODES.has(descriptor.code)) {
      continue;
    }
    const values = descriptor.params
      ? Object.fromEntries(
          Object.entries(descriptor.params).map(([key, value]) => [
            key,
            typeof value === "boolean" ? String(value) : value,
          ]),
        )
      : undefined;
    parts.push(
      resolveLabel(
        messagesOrT,
        `author.archive.completeness.summaryParts.${descriptor.code}`,
        descriptor.code,
        values,
      ),
    );
  }

  return parts.length > 0 ? parts.join(" ") : completeness.summary;
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

const JOURNEY_STATUS_CODES = new Set<string>([
  "signed_petition",
  "commented",
  "commented_count",
  "supported",
  "opposed",
  "voted",
  "voted_updated",
]);

const JOURNEY_LABEL_CODES = new Set<string>([
  "join_discussion",
  "continue_discussion",
  "sign_petition",
  "petition_signed",
  "cast_vote",
  "review_or_update_vote",
  "view_decision_result",
  "support_initiative",
]);

const JOURNEY_REASON_CODES = new Set<string>([
  "sign_in_to_comment",
  "sign_in_to_sign",
  "sign_in_to_vote",
  "sign_in_to_support",
  "sign_in_to_take_action",
  "support_unavailable",
  "petition_info_unavailable",
  "petition_not_open",
  "voting_closed",
  "decision_not_open",
  "voting_info_unavailable",
  "petition_open_unsigned",
  "vote_open_may_update",
  "vote_open",
  "join_discussion",
  "show_support",
  "commitment_needs_response",
  "still_contribute_discussion",
]);

/**
 * Pack 02G Task 08G — display-only past-action status.
 * Prefer statusCode → catalog; fallback to legacy English; unknown → raw or legacy.
 */
export function resolveCollectiveParticipationStatusDisplay(
  statusCode: string | undefined,
  statusParams: Readonly<Record<string, string | number | boolean>> | undefined,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
  legacyStatusLabel?: string,
): string {
  if (statusCode && JOURNEY_STATUS_CODES.has(statusCode)) {
    return resolveLabel(
      messagesOrT,
      `journey.status.${statusCode}`,
      legacyStatusLabel || statusCode,
      statusParams ? { ...statusParams } : undefined,
    );
  }
  if (legacyStatusLabel) {
    return legacyStatusLabel;
  }
  return statusCode ?? "";
}

/**
 * Pack 02G Task 08G — display-only available/next action label.
 * Prefer labelCode → catalog; fallback to legacy English; unknown → raw or legacy.
 */
export function resolveCollectiveParticipationActionLabelDisplay(
  labelCode: string | undefined,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
  legacyLabel?: string,
): string {
  if (labelCode && JOURNEY_LABEL_CODES.has(labelCode)) {
    return resolveLabel(
      messagesOrT,
      `journey.labels.${labelCode}`,
      legacyLabel || labelCode,
    );
  }
  if (legacyLabel) {
    return legacyLabel;
  }
  return labelCode ?? "";
}

/**
 * Pack 02G Task 08G — display-only available/next action reason.
 * Prefer reasonCode → catalog; fallback to legacy English; unknown → raw or legacy.
 */
export function resolveCollectiveParticipationReasonDisplay(
  reasonCode: string | undefined,
  reasonParams: Readonly<Record<string, string | number | boolean>> | undefined,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
  legacyReason?: string,
): string {
  if (reasonCode && JOURNEY_REASON_CODES.has(reasonCode)) {
    return resolveLabel(
      messagesOrT,
      `journey.reasons.${reasonCode}`,
      legacyReason || reasonCode,
      reasonParams ? { ...reasonParams } : undefined,
    );
  }
  if (legacyReason) {
    return legacyReason;
  }
  return reasonCode ?? "";
}

const COLLABORATION_CHANNEL_SYSTEM_EVENT_KINDS = new Set<InitiativeCollaborationSystemEventKind>([
  "ally_joined",
  "collaboration_accepted",
  "session_scheduled",
  "petition_published",
  "collective_decision_updated",
]);

const COLLABORATION_CHANNEL_SYSTEM_EVENT_NAME_KINDS = new Set<InitiativeCollaborationSystemEventKind>([
  "ally_joined",
  "collaboration_accepted",
]);

/**
 * Pack 02G Task 08G — localize Collaboration Channel system_event presentation.
 * Prefer kind + optional subject name → catalog; unknown kind → English `text` skew fallback.
 */
export function resolveCollaborationChannelSystemEventDisplay(
  input: {
    readonly systemEventKind?: InitiativeCollaborationSystemEventKind;
    readonly systemEventSubjectDisplayName?: string;
    readonly text: string;
  },
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
): string {
  const kind = input.systemEventKind;
  if (!kind || !COLLABORATION_CHANNEL_SYSTEM_EVENT_KINDS.has(kind)) {
    return input.text;
  }

  if (COLLABORATION_CHANNEL_SYSTEM_EVENT_NAME_KINDS.has(kind)) {
    const name =
      input.systemEventSubjectDisplayName?.trim() ||
      resolveLabel(
        messagesOrT,
        `collaboration.channel.systemEvents.defaultNames.${kind}`,
        kind === "ally_joined" ? "A new Ally" : "A collaboration request",
      );
    return resolveLabel(
      messagesOrT,
      `collaboration.channel.systemEvents.${kind}`,
      input.text,
      { name },
    );
  }

  return resolveLabel(
    messagesOrT,
    `collaboration.channel.systemEvents.${kind}`,
    input.text,
  );
}

const CIVIC_ARCHIVE_OUTCOME_STATUS_CODES = new Set<string>([
  "completed",
  "partially_implemented",
  "concluded_without_implementation",
  "cancelled",
  "superseded",
]);

/**
 * Pack 02G 08G — display-only Civic Archive outcome status labels.
 * Canonical outcomeStatus codes unchanged. Unknown → legacy English label/raw.
 */
export function resolveCivicArchiveOutcomeStatusDisplayLabel(
  status: string,
  messagesOrT: InitiativeExperienceMessages | InitiativeExperienceTranslator,
  legacyLabel?: string,
): string {
  if (!CIVIC_ARCHIVE_OUTCOME_STATUS_CODES.has(status)) {
    return legacyLabel ?? status;
  }
  return resolveLabel(
    messagesOrT,
    `civicArchivePublic.outcomes.${status}`,
    legacyLabel ?? status,
  );
}
