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

/** Contract: every public stageId has a catalog key path stages.{id}. */
export function listPublicLifecycleStageIdsForI18n(): readonly string[] {
  return PUBLIC_INITIATIVE_EXPERIENCE_STAGES.map((stage) => stage.stageId);
}

/** Contract: every activity-area option has a message key mapping. */
export function listActivityAreaValuesForI18n(): readonly InitiativeActivityAreaOption[] {
  return INITIATIVE_ACTIVITY_AREA_OPTIONS;
}
