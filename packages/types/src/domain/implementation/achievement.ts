import type { AchievementId, ImplementationId, MilestoneId, ParticipantId } from "./identifiers.js";

/** Recorded collective accomplishment advancing or satisfying a Milestone. */
export interface Achievement {
  achievementId: AchievementId;
  implementationId: ImplementationId;
  milestoneId: MilestoneId;
  title: string;
  summary: string;
  recordedAt: string;
  /** Operational accountability metadata — excluded from public projection by default. */
  recordedByParticipantId: ParticipantId;
  createdAt: string;
  updatedAt: string;
}
