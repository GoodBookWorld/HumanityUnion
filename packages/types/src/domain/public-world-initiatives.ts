import type { InitiativeCoverMedia } from "./initiative-cover-media.js";
import type { InitiativeLifecycleProfile } from "./initiative-lifecycle-profile.js";
import type { PublicChoiceElectionVotingStatus } from "./public-choice-ballot-mode.js";

export interface WorldInitiativeCardProjection {
  initiativeId: string;
  title: string;
  summary: string;
  activityArea: string;
  geographyLabel: string;
  /** RESET 05 — codes for locale-aware GEOGRAPHY display (not machine-translated labels). */
  countryCode?: string;
  regionCode?: string;
  communitySlug?: string;
  imageUrl?: string;
  /** UX Evolution Pack 03 — public-safe (verificationReasonCode always stripped); approved media only. */
  coverMedia?: InitiativeCoverMedia;
  startDate?: string;
  completionDate?: string;
  publicStatus: string;
  currentStageLabel?: string;
  publicInitiativeHref: string;
  publishedAt: string;
  /**
   * RESET 05B — PUBLIC_CHOICE election display name (from metadata.communityAssociation).
   * MACHINE_CONTENT / PLP — not geography.
   */
  electionName?: string;
  supportSummary?: {
    likes: number;
    dislikes: number;
  };
  /** Pack 09F2 — Country discovery rails. */
  lifecycleProfile?: InitiativeLifecycleProfile;
  electionVotingStatus?: PublicChoiceElectionVotingStatus;
  electionVotingStatusLabel?: string;
  candidateCount?: number;
  administrativelyBlocked?: boolean;
}

export interface WorldInitiativesPublicProjection {
  scope: "world";
  scopeLabel: string;
  source: "projection";
  generatedAt: string;
  initiatives: WorldInitiativeCardProjection[];
}
