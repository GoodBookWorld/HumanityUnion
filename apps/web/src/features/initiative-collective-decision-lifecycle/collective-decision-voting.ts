import type {
  InitiativeDecisionVoteChoice,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";

/** Canonical ballot choices — must match API validators exactly. */
export const INITIATIVE_DECISION_VOTE_CHOICES = [
  "support",
  "do_not_support",
  "abstain",
] as const satisfies readonly InitiativeDecisionVoteChoice[];

export function labelInitiativeDecisionVoteChoice(
  choice: InitiativeDecisionVoteChoice | "candidate",
): string {
  switch (choice) {
    case "support":
      return "Support";
    case "do_not_support":
      return "Do not support";
    case "abstain":
      return "Abstain";
    case "candidate":
      return "Candidate";
    default: {
      const _exhaustive: never = choice;
      return _exhaustive;
    }
  }
}

/**
 * Public Choice Experience Pack 01 — display labels with optional Russian
 * localization. Canonical vote identity remains `support` | `do_not_support` |
 * `abstain` (never display text).
 */
export function localizedInitiativeDecisionVoteChoice(
  choice: InitiativeDecisionVoteChoice,
  locale: string = typeof navigator !== "undefined" ? navigator.language : "en",
): string {
  const isRu = locale.toLowerCase().startsWith("ru");
  if (!isRu) {
    return labelInitiativeDecisionVoteChoice(choice);
  }

  switch (choice) {
    case "support":
      return "Поддерживаю";
    case "do_not_support":
      return "Не поддерживаю";
    case "abstain":
      return "Воздержался";
    default: {
      const _exhaustive: never = choice;
      return _exhaustive;
    }
  }
}

/**
 * Client-side mirror of `assertDecisionAcceptsVotes` for UX gating only.
 * Backend remains authoritative on cast/update.
 */
export function isCollectiveDecisionVotingWindowOpen(
  projection: Pick<PublicInitiativeCollectiveDecisionProjection, "status" | "openedAt" | "closesAt">,
  nowMs: number = Date.now(),
): boolean {
  if (projection.status !== "opened") {
    return false;
  }

  if (!projection.openedAt || Date.parse(projection.openedAt) > nowMs) {
    return false;
  }

  if (Date.parse(projection.closesAt) < nowMs) {
    return false;
  }

  return true;
}

export function describeCollectiveDecisionVotingUnavailable(
  projection: Pick<
    PublicInitiativeCollectiveDecisionProjection,
    "status" | "openedAt" | "closesAt" | "closedAt" | "cancelledAt"
  >,
  nowMs: number = Date.now(),
): string | null {
  if (projection.status === "cancelled") {
    return "This Collective Decision was cancelled. Voting is not available.";
  }

  if (projection.status === "closed") {
    return "This Collective Decision is closed. Voting is no longer available.";
  }

  if (projection.status !== "opened") {
    return "Voting is not available for this Collective Decision.";
  }

  if (!projection.openedAt || Date.parse(projection.openedAt) > nowMs) {
    return "The voting window is not open yet.";
  }

  if (Date.parse(projection.closesAt) < nowMs) {
    return "The voting window has closed.";
  }

  return null;
}
