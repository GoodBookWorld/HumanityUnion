import type { InitiativeCoverMedia } from "./initiative-cover-media.js";

export interface WorldInitiativeCardProjection {
  initiativeId: string;
  title: string;
  summary: string;
  activityArea: string;
  geographyLabel: string;
  imageUrl?: string;
  /** UX Evolution Pack 03 — public-safe (verificationReasonCode always stripped); approved media only. */
  coverMedia?: InitiativeCoverMedia;
  startDate?: string;
  completionDate?: string;
  publicStatus: string;
  currentStageLabel?: string;
  publicInitiativeHref: string;
  publishedAt: string;
  supportSummary?: {
    likes: number;
    dislikes: number;
  };
}

export interface WorldInitiativesPublicProjection {
  scope: "world";
  scopeLabel: string;
  source: "projection";
  generatedAt: string;
  initiatives: WorldInitiativeCardProjection[];
}
