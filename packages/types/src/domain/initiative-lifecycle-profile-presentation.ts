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
  /** PUBLIC_CHOICE: profile-specific CD meaning without renaming stage id. */
  readonly collectiveDecisionResultLabel: string | null;
  /** Hide misleading STANDARD "Stage X of Y" ordinals. */
  readonly showLifecycleStageOrdinal: boolean;
}

const PUBLIC_CHOICE_COMMUNITY_ASSOCIATION_HELPER =
  "Enter the name of the election or public choice. Examples: “New York City Mayoral Election” or “Kelowna City Council Election”.";

/** Pack 04 — Public Choice election creation guidance (no ballot-mode selector). */
export const PUBLIC_CHOICE_ELECTION_CREATE_HELPER =
  "Create the election first. Registered Participants can add candidates on the election page after publication.";

/** @deprecated Pack 04 — use PUBLIC_CHOICE_ELECTION_CREATE_HELPER. */
export const PUBLIC_CHOICE_SELECT_ONE_BALLOT_HELPER = PUBLIC_CHOICE_ELECTION_CREATE_HELPER;

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
      /** Pack 04 — candidate Select/Recall lives on Overview; Discussion is comments only. */
      discussionShowsVoteBallot: false,
      discussionShowsStandardParticipationActions: false,
      collectiveDecisionIsResultOnly: true,
      collectiveDecisionResultLabel: "Election Results",
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
    collectiveDecisionResultLabel: null,
    showLifecycleStageOrdinal: true,
  };
}

/**
 * Fix 07B — participant-facing current stage for PUBLIC_CHOICE.
 * Domain route still includes Civic Archive; visible/presentation lifecycle
 * never reports Archive as the current stage (clamp to Collective Decision).
 */
export function resolveParticipantFacingCurrentStageId(
  currentStageId: string,
  lifecycleProfile?: InitiativeLifecycleProfile | string | null,
): string {
  const profile = resolveInitiativeLifecycleProfile(lifecycleProfile);
  if (profile === "PUBLIC_CHOICE" && currentStageId === "archive") {
    return "collective_decision";
  }
  return currentStageId;
}
