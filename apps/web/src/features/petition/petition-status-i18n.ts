/**
 * HU-LC-05C.4C.7D.2B — Petition Status WEB_UI vocabulary.
 *
 * Every key is relative to the `initiativeExperience` namespace and lives in a
 * public-reader-required family (`author.petition.public.status.*`,
 * `petitionSignature.*`) or reuses an existing key with the same meaning.
 * Raw tokens (Petition state, decision status, outcome types) stay the logic
 * values; only their display labels are looked up here.
 */

import type {
  CollectiveDecision,
  CollectiveDecisionStatus,
  OutcomeType,
  PetitionOutcomeType,
  PetitionState,
  PublicPetitionRecord,
} from "@hu/types";

import { formatUtcCalendarDate } from "../language/format-utc-calendar-date";
import { ApiRequestError } from "../../lib/api-client";

const STATUS = "author.petition.public.status";
const DOCUMENT = "author.petition.public.document";

/**
 * Section anchors keep the slugs the English titles used to produce
 * (`petition-status`, heading `section-petition-status`), so existing links
 * and the section tracker are unaffected by translation.
 */
export const PETITION_STATUS_SECTIONS = [
  { id: "petition-status", labelKey: "petitionEditing.tabs.status" },
  { id: "petition-subject", labelKey: `${STATUS}.sections.subject` },
  { id: "decision-context", labelKey: "author.decisionSession.fields.context" },
  { id: "signature", labelKey: `${STATUS}.sections.signature` },
  { id: "support-metrics", labelKey: `${STATUS}.sections.supportMetrics` },
  { id: "petition-outcome", labelKey: `${STATUS}.sections.outcome` },
  { id: "contribution-recognition", labelKey: `${STATUS}.sections.contribution` },
  { id: "next-meaningful-action", labelKey: "sidebar.participation.nextMeaningfulAction" },
  { id: "related-links", labelKey: `${STATUS}.sections.relatedLinks` },
] as const;

export type PetitionStatusSectionId = (typeof PETITION_STATUS_SECTIONS)[number]["id"];

export function petitionStatusSectionLabelKey(id: PetitionStatusSectionId): string {
  return PETITION_STATUS_SECTIONS.find((section) => section.id === id)?.labelKey ?? id;
}

/** `WorkspaceSectionNav` targets the section heading (`section-<id>`). */
export function petitionStatusNavItems(
  translate: (key: string) => string,
): Array<{ readonly id: string; readonly label: string }> {
  return PETITION_STATUS_SECTIONS.map((section) => ({
    id: `section-${section.id}`,
    label: translate(section.labelKey),
  }));
}

export const PETITION_STATE_LABEL_KEYS: Readonly<Record<PetitionState, string>> = {
  Draft: `${STATUS}.states.draft`,
  Ready: `${STATUS}.states.ready`,
  Published: `${STATUS}.states.published`,
  Open: `${STATUS}.states.open`,
  Closed: `${DOCUMENT}.statusClosed`,
  Archived: `${DOCUMENT}.statusArchived`,
};

export const COLLECTIVE_DECISION_STATUS_LABEL_KEYS: Readonly<
  Record<CollectiveDecisionStatus, string>
> = {
  Draft: `${STATUS}.decision.statuses.draft`,
  Scheduled: `${STATUS}.decision.statuses.scheduled`,
  Active: `${STATUS}.decision.statuses.active`,
  Closed: `${STATUS}.decision.statuses.closed`,
  Completed: `${STATUS}.decision.statuses.completed`,
  Archived: `${STATUS}.decision.statuses.archived`,
  Cancelled: `${STATUS}.decision.statuses.cancelled`,
};

export const DECISION_OUTCOME_LABEL_KEYS: Readonly<Record<OutcomeType, string>> = {
  Approved: `${STATUS}.decision.outcomes.approved`,
  Rejected: `${STATUS}.decision.outcomes.rejected`,
  Selected: `${STATUS}.decision.outcomes.selected`,
  Prioritized: `${STATUS}.decision.outcomes.prioritized`,
};

export const PETITION_OUTCOME_LABEL_KEYS: Readonly<Record<PetitionOutcomeType, string>> = {
  Active: `${STATUS}.outcome.types.active`,
  ThresholdReached: `${STATUS}.outcome.thresholdReached`,
  Closed: `${DOCUMENT}.statusClosed`,
  Archived: `${DOCUMENT}.statusArchived`,
};

function ownKey(keys: Readonly<Record<string, string>>, token: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(keys, token) ? keys[token] : undefined;
}

/** Display label for a raw token; unknown tokens are shown as-is. */
export function translateToken(
  translate: (key: string) => string,
  keys: Readonly<Record<string, string>>,
  token: string,
): string {
  const key = ownKey(keys, token);
  return key ? translate(key) : token;
}

/**
 * The API's outcome explanation is a fixed English sentence per outcome type,
 * so the type selects the message. Types without one read "Not available".
 */
export const PETITION_OUTCOME_EXPLANATION_KEYS: Readonly<
  Partial<Record<PetitionOutcomeType, string>>
> = {
  Active: `${STATUS}.outcome.explanations.active`,
  Closed: `${STATUS}.outcome.explanations.closed`,
  Archived: `${STATUS}.outcome.explanations.archived`,
};

export function petitionOutcomeExplanationKey(outcomeType: string): string {
  return (
    ownKey(PETITION_OUTCOME_EXPLANATION_KEYS as Record<string, string>, outcomeType) ??
    `${STATUS}.overview.notAvailable`
  );
}

/** Why signing is unavailable, from the Petition status. */
export function signatureNotOpenKey(status: PetitionState): string {
  if (status === "Draft" || status === "Ready") {
    return "petitionSignature.notOpenPreparing";
  }
  return status === "Published"
    ? "petitionSignature.notOpenPublished"
    : "petitionSignature.notOpenEnded";
}

const SYNTHETIC_DECISION = `${STATUS}.decision.synthetic`;

/** Labels for the bookkeeping decision's option values; ids and values are never changed. */
export const SYNTHETIC_DECISION_OPTION_LABEL_KEYS: Readonly<Record<string, string>> = {
  Approve: `${SYNTHETIC_DECISION}.options.approve`,
  Reject: `${SYNTHETIC_DECISION}.options.reject`,
};

/**
 * Publishing a Petition records a bookkeeping Collective Decision with the id
 * `decision-<petitionId>` for the Petition's own Initiative. It carries no
 * community ballot, and its English text is generated from a fixed template.
 */
export function isPetitionSyntheticDecision(
  decision: Pick<CollectiveDecision, "decisionId" | "decisionSubjectType" | "decisionSubjectId">,
  petition: Pick<PublicPetitionRecord, "petitionId" | "collectiveDecisionId" | "subject">,
): boolean {
  return (
    decision.decisionId === `decision-${petition.petitionId}` &&
    decision.decisionId === petition.collectiveDecisionId &&
    decision.decisionSubjectType === "Initiative" &&
    decision.decisionSubjectId === petition.subject.initiativeId
  );
}

export interface PetitionDecisionText {
  readonly synthetic: boolean;
  readonly question: string;
  readonly explanation: string;
  /** null while the decision has no winning option. */
  readonly winningOption: string | null;
}

/**
 * Display text for the Petition's Collective Decision. Only the verified
 * bookkeeping decision is re-rendered from WEB_UI templates (and only when
 * the Initiative title is known); any other decision keeps its own text.
 */
export function petitionDecisionText(input: {
  readonly decision: CollectiveDecision;
  readonly petition: Pick<PublicPetitionRecord, "petitionId" | "collectiveDecisionId" | "subject">;
  readonly initiativeTitle: string | null;
  readonly translate: (key: string, values?: Record<string, string>) => string;
}): PetitionDecisionText {
  const { decision, translate } = input;
  const synthetic = isPetitionSyntheticDecision(decision, input.petition);
  const winningOptionId = decision.decisionResult?.winningOptionId;
  const option =
    winningOptionId === undefined || winningOptionId === null
      ? null
      : decision.ballot.options.find((candidate) => candidate.optionId === winningOptionId);
  const optionKey =
    synthetic && option ? ownKey(SYNTHETIC_DECISION_OPTION_LABEL_KEYS, option.value) : undefined;
  const winningOption =
    option === null
      ? null
      : option === undefined
        ? translate(`${STATUS}.decision.unknownOption`)
        : optionKey
          ? translate(optionKey)
          : option.label;

  const initiativeTitle = input.initiativeTitle?.trim();
  const templated = synthetic && Boolean(initiativeTitle);
  const values = { initiativeTitle: initiativeTitle ?? "" };

  return {
    synthetic,
    question: templated
      ? translate(`${SYNTHETIC_DECISION}.question`, values)
      : decision.ballot.question,
    explanation:
      templated && decision.outcome
        ? translate(`${SYNTHETIC_DECISION}.explanation`, values)
        : (decision.outcome?.explanation ?? ""),
    winningOption,
  };
}

export const PETITION_PIPELINE_STAGES = [
  { stage: "initiative", labelKey: "stages.initiative" },
  { stage: "analysis", labelKey: "stages.analysis" },
  { stage: "collective_decision", labelKey: "stages.collective_decision" },
  { stage: "petition", labelKey: "stages.petition" },
  { stage: "implementation_commitment", labelKey: `${STATUS}.pipeline.implementationCommitment` },
  { stage: "implementation", labelKey: `${STATUS}.pipeline.implementation` },
  { stage: "impact", labelKey: `${STATUS}.pipeline.impact` },
] as const;

export type PetitionPipelineStage = (typeof PETITION_PIPELINE_STAGES)[number]["stage"];

export function petitionPipelineStageStateKey(stage: PetitionPipelineStage): string {
  const stages = PETITION_PIPELINE_STAGES.map((entry) => entry.stage);
  const current = stages.indexOf("petition");
  const index = stages.indexOf(stage);
  if (index === current) {
    return "hero.currentStage";
  }
  return index < current ? `${STATUS}.pipeline.complete` : `${STATUS}.pipeline.notYetActive`;
}

export function supportStatusSummaryKey(status: PetitionState): string | null {
  switch (status) {
    case "Draft":
    case "Ready":
      return `${STATUS}.supportSummary.preparing`;
    case "Published":
      return `${STATUS}.supportSummary.publishedNotOpen`;
    case "Open":
      return `${STATUS}.supportSummary.open`;
    case "Closed":
      return `${STATUS}.supportSummary.closed`;
    case "Archived":
      return `${DOCUMENT}.statusArchived`;
    default:
      return null;
  }
}

export interface NextMeaningfulActionKeys {
  readonly titleKey: string;
  readonly detailKey: string;
}

export function nextMeaningfulActionKeys(
  status: PetitionState,
  viewerHasSigned: boolean,
): NextMeaningfulActionKeys {
  const action = (name: string, titleKey = `${STATUS}.nextAction.${name}.title`) => ({
    titleKey,
    detailKey: `${STATUS}.nextAction.${name}.detail`,
  });

  if (status === "Draft" || status === "Ready") {
    return action("preparing");
  }
  if (status === "Published") {
    return action(viewerHasSigned ? "publishedSigned" : "publishedUnsigned");
  }
  if (status === "Open") {
    return viewerHasSigned
      ? action("openSigned")
      : action("openUnsigned", "petitionSignature.sign");
  }
  if (status === "Closed" || status === "Archived") {
    return action("ended");
  }
  return action("fallback");
}

export type SignatureAction = "sign" | "withdraw";

/**
 * A localized message for a failed sign / withdraw request, chosen from the
 * HTTP status and the action — never from the API's English message text.
 */
export function signatureActionErrorKey(error: unknown, action: SignatureAction): string {
  const status = error instanceof ApiRequestError ? error.status : null;
  switch (status) {
    case 401:
      return "petitionSignature.errors.signInAgain";
    case 403:
      return action === "sign"
        ? "petitionSignature.errors.notEligible"
        : "petitionSignature.errors.withdrawNotAllowed";
    case 404:
      return "petitionSignature.errors.petitionUnavailable";
    case 409:
      return "petitionSignature.errors.statusChanged";
    default:
      return action === "sign" ? "petitionSignature.recordFailed" : "petitionSignature.withdrawFailed";
  }
}

function intlLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? "en";
  } catch {
    return "en";
  }
}

/** Calendar date in the app locale, identical on the server and in the browser. */
export function formatPetitionDate(
  locale: string,
  value: string | null | undefined,
  month: "long" | "short" = "long",
): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return formatUtcCalendarDate(intlLocale(locale), date, month);
}

export function formatPetitionNumber(locale: string, value: number): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** `score` is a 0–100 readiness score. */
export function formatPetitionPercent(locale: string, score: number): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(score / 100);
}

export function formatPetitionList(locale: string, items: readonly string[]): string {
  return new Intl.ListFormat(intlLocale(locale), { style: "short", type: "unit" }).format(items);
}
