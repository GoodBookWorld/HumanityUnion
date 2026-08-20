/**
 * Public Choice Experience Pack 01 — profile-aware presentation contract.
 *
 * One Initiative root + lifecycleProfile. Prefer this helper over scattering
 * ad-hoc `if (publicChoice)` checks across unrelated components.
 */

import type { InitiativeLifecycleProfile } from "./initiative-lifecycle-profile.js";
import { resolveInitiativeLifecycleProfile } from "./initiative-lifecycle-profile.js";

export interface InitiativeLifecycleProfilePresentation {
  readonly profile: InitiativeLifecycleProfile;
  readonly isPublicChoice: boolean;
  /** Shared `communityAssociation` field label. */
  readonly communityAssociationLabel: string;
  readonly communityAssociationHelper: string | null;
  readonly requireCountry: boolean;
  readonly showActivityArea: boolean;
  readonly requireActivityArea: boolean;
  /** Discussion shows ternary Public Choice ballot (Decision Vote). */
  readonly discussionShowsVoteBallot: boolean;
  /** Hide STANDARD Discussion collaboration/proposal actions. */
  readonly discussionShowsStandardParticipationActions: boolean;
  /** Collective Decision is a result surface, not a decision-building workflow. */
  readonly collectiveDecisionIsResultOnly: boolean;
  /** Hide misleading STANDARD "Stage X of Y" ordinals. */
  readonly showLifecycleStageOrdinal: boolean;
}

const PUBLIC_CHOICE_COMMUNITY_ASSOCIATION_HELPER =
  "Enter the name of the election or public choice. Examples: “New York City Mayoral Election” or “Kelowna City Council Election”.";

/** Pack 03 — SELECT_ONE creation guidance (candidates added after publish, not on this form). */
export const PUBLIC_CHOICE_SELECT_ONE_BALLOT_HELPER =
  "This creates the election. Candidates are not entered here — add them later from the election Initiative page after it is published.";

export function getInitiativeLifecycleProfilePresentation(
  profile: InitiativeLifecycleProfile | string | null | undefined,
): InitiativeLifecycleProfilePresentation {
  const resolved = resolveInitiativeLifecycleProfile(profile);
  const isPublicChoice = resolved === "PUBLIC_CHOICE";

  if (isPublicChoice) {
    return {
      profile: resolved,
      isPublicChoice: true,
      communityAssociationLabel: "Election name",
      communityAssociationHelper: PUBLIC_CHOICE_COMMUNITY_ASSOCIATION_HELPER,
      requireCountry: true,
      showActivityArea: false,
      requireActivityArea: false,
      /**
       * Pack 03 — SUPPORT_OPPOSE keeps Discussion ballot; SELECT_ONE voting
       * moves to Collective Decision (callers must gate on ballotMode).
       */
      discussionShowsVoteBallot: true,
      discussionShowsStandardParticipationActions: false,
      collectiveDecisionIsResultOnly: true,
      showLifecycleStageOrdinal: false,
    };
  }

  return {
    profile: resolved,
    isPublicChoice: false,
    communityAssociationLabel: "Community association",
    communityAssociationHelper: null,
    requireCountry: false,
    showActivityArea: true,
    requireActivityArea: true,
    discussionShowsVoteBallot: false,
    discussionShowsStandardParticipationActions: true,
    collectiveDecisionIsResultOnly: false,
    showLifecycleStageOrdinal: true,
  };
}
