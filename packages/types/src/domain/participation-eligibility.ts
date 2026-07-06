import type { MemberStatus } from "./member.js";
import type {
  InitiativeCollectiveDecisionStatus,
  ParticipationScope,
} from "./initiative-collective-decision.js";
import type {
  ParticipationAreaSlugTriple,
  ParticipationAreaTransition,
  ParticipationAreaVerificationStatus,
} from "./participation-area.js";

export type ParticipationEligibilityReasonCode =
  | "eligible"
  | "not_registered"
  | "inactive_participant"
  | "decision_not_open"
  | "outside_decision_window"
  | "already_voted"
  | "missing_participation_area"
  | "country_mismatch"
  | "region_mismatch"
  | "community_mismatch"
  | "pending_area_change_not_effective";

export type ParticipationTransparencyCohort = "verified" | "unverified";

export interface InitiativeParticipationScopeMetadata {
  countrySlug: string;
  regionSlug: string;
  communitySlug: string;
  isGlobal: boolean;
}

export interface DecisionParticipationEligibilityInput {
  participantId: string;
  isRegistered: boolean;
  participantStatus: MemberStatus | "unregistered";
  activeParticipationArea: ParticipationAreaSlugTriple | null;
  verificationStatus: ParticipationAreaVerificationStatus;
  pendingTransition: ParticipationAreaTransition | null;
  decisionParticipationScope: ParticipationScope;
  initiativeScopeMetadata: InitiativeParticipationScopeMetadata;
  decisionStatus: InitiativeCollectiveDecisionStatus;
  openedAt?: string;
  closesAt: string;
  currentTime: string;
  priorVoteExists: boolean;
}

export interface DecisionParticipationEligibilityResult {
  eligible: boolean;
  reasonCode: ParticipationEligibilityReasonCode;
  explanation: string;
  transparencyCohort: ParticipationTransparencyCohort;
}

export function getTransparencyCohort(
  verificationStatus: ParticipationAreaVerificationStatus,
): ParticipationTransparencyCohort {
  return verificationStatus;
}

export function isParticipationAreaMatch(
  participationScope: ParticipationScope,
  participantArea: ParticipationAreaSlugTriple,
  initiativeScopeMetadata: InitiativeParticipationScopeMetadata,
): boolean {
  if (participationScope === "world" || initiativeScopeMetadata.isGlobal) {
    return true;
  }

  if (participationScope === "country") {
    return participantArea.countrySlug === initiativeScopeMetadata.countrySlug;
  }

  if (participationScope === "region") {
    return (
      participantArea.countrySlug === initiativeScopeMetadata.countrySlug &&
      participantArea.regionSlug === initiativeScopeMetadata.regionSlug
    );
  }

  return (
    participantArea.countrySlug === initiativeScopeMetadata.countrySlug &&
    participantArea.regionSlug === initiativeScopeMetadata.regionSlug &&
    participantArea.communitySlug === initiativeScopeMetadata.communitySlug
  );
}

function isWithinDecisionWindow(
  openedAt: string | undefined,
  closesAt: string,
  currentTime: string,
): boolean {
  const now = Date.parse(currentTime);
  const closeTime = Date.parse(closesAt);

  if (Number.isNaN(now) || Number.isNaN(closeTime)) {
    return false;
  }

  if (now > closeTime) {
    return false;
  }

  if (!openedAt) {
    return false;
  }

  const openTime = Date.parse(openedAt);

  if (Number.isNaN(openTime)) {
    return false;
  }

  return now >= openTime;
}

function resolveScopeMismatchReason(
  participationScope: ParticipationScope,
  participantArea: ParticipationAreaSlugTriple,
  initiativeScopeMetadata: InitiativeParticipationScopeMetadata,
): Exclude<ParticipationEligibilityReasonCode, "eligible"> {
  if (participantArea.countrySlug !== initiativeScopeMetadata.countrySlug) {
    return "country_mismatch";
  }

  if (participationScope === "country") {
    return "community_mismatch";
  }

  if (participantArea.regionSlug !== initiativeScopeMetadata.regionSlug) {
    return "region_mismatch";
  }

  if (participationScope === "region") {
    return "community_mismatch";
  }

  return "community_mismatch";
}

function buildMismatchExplanation(reasonCode: ParticipationEligibilityReasonCode): string {
  switch (reasonCode) {
    case "country_mismatch":
      return "Participant Participation Area country does not match the decision scope.";
    case "region_mismatch":
      return "Participant Participation Area region does not match the decision scope.";
    case "community_mismatch":
      return "Participant Participation Area community does not match the decision scope.";
    default:
      return "Participant Participation Area does not match the decision scope.";
  }
}

function buildIneligibleResult(
  reasonCode: Exclude<ParticipationEligibilityReasonCode, "eligible">,
  explanation: string,
  transparencyCohort: ParticipationTransparencyCohort,
): DecisionParticipationEligibilityResult {
  return {
    eligible: false,
    reasonCode,
    explanation,
    transparencyCohort,
  };
}

export function evaluateDecisionParticipationEligibility(
  input: DecisionParticipationEligibilityInput,
): DecisionParticipationEligibilityResult {
  const transparencyCohort = getTransparencyCohort(input.verificationStatus);

  if (!input.isRegistered) {
    return buildIneligibleResult(
      "not_registered",
      "Only registered participants may participate in collective decisions.",
      transparencyCohort,
    );
  }

  if (input.participantStatus !== "active") {
    return buildIneligibleResult(
      "inactive_participant",
      "Participant must be active to participate in collective decisions.",
      transparencyCohort,
    );
  }

  if (input.decisionStatus !== "opened") {
    return buildIneligibleResult(
      "decision_not_open",
      "Collective decision is not open for participation.",
      transparencyCohort,
    );
  }

  if (!isWithinDecisionWindow(input.openedAt, input.closesAt, input.currentTime)) {
    return buildIneligibleResult(
      "outside_decision_window",
      "Participation is only allowed while the collective decision is open.",
      transparencyCohort,
    );
  }

  if (input.priorVoteExists) {
    return buildIneligibleResult(
      "already_voted",
      "Each participant may cast only one vote per collective decision.",
      transparencyCohort,
    );
  }

  if (!input.activeParticipationArea?.countrySlug) {
    return buildIneligibleResult(
      "missing_participation_area",
      "Participant must declare a Participation Area before participating.",
      transparencyCohort,
    );
  }

  const pendingTransition = input.pendingTransition;

  if (
    pendingTransition &&
    pendingTransition.status === "pending" &&
    Date.parse(input.currentTime) < Date.parse(pendingTransition.effectiveAt)
  ) {
    const pendingWouldMatch = isParticipationAreaMatch(
      input.decisionParticipationScope,
      pendingTransition.toArea,
      input.initiativeScopeMetadata,
    );
    const activeMatches = isParticipationAreaMatch(
      input.decisionParticipationScope,
      input.activeParticipationArea,
      input.initiativeScopeMetadata,
    );

    if (pendingWouldMatch && !activeMatches) {
      return buildIneligibleResult(
        "pending_area_change_not_effective",
        "Pending Participation Area change is not effective yet. Eligibility uses the current active area.",
        transparencyCohort,
      );
    }
  }

  if (
    !isParticipationAreaMatch(
      input.decisionParticipationScope,
      input.activeParticipationArea,
      input.initiativeScopeMetadata,
    )
  ) {
    const mismatchReason = resolveScopeMismatchReason(
      input.decisionParticipationScope,
      input.activeParticipationArea,
      input.initiativeScopeMetadata,
    );

    return buildIneligibleResult(
      mismatchReason,
      buildMismatchExplanation(mismatchReason),
      transparencyCohort,
    );
  }

  return {
    eligible: true,
    reasonCode: "eligible",
    explanation: "Participant is eligible to participate in this collective decision.",
    transparencyCohort,
  };
}
