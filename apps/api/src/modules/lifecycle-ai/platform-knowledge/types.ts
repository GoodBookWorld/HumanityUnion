import type { HumanityUnionAssistantSurfaceId } from "@hu/types";

/**
 * Pack 05 — canonical Humanity Union Platform Knowledge model.
 * Structured, versionable modules; never one enormous hardcoded dump.
 */

export type PlatformKnowledgeCategory =
  | "platform_identity"
  | "participant_member"
  | "workspace"
  | "profile"
  | "preferences"
  | "initiatives"
  | "discussion"
  | "collaboration"
  | "allies"
  | "messages"
  | "notifications"
  | "reminders"
  | "lifecycle"
  | "participation"
  | "privacy"
  | "media"
  | "safety"
  | "civic_archive"
  | "assistant_capabilities"
  | "commitments_tracking"
  | "community_intelligence"
  | "blog";

export interface PlatformKnowledgeModule {
  readonly moduleId: string;
  readonly category: PlatformKnowledgeCategory;
  readonly label: string;
  /** Short label for session UI topic lists. */
  readonly topicLabel: string;
  readonly keywords: readonly string[];
  /** Surfaces that should bias retrieval toward this module. */
  readonly surfaces: readonly HumanityUnionAssistantSurfaceId[] | "all";
  readonly content: string;
  readonly relatedModuleIds?: readonly string[];
}

export interface RetrievePlatformKnowledgeInput {
  readonly instructions?: string;
  readonly surfaceId?: string;
  readonly stageId?: string | null;
  readonly operation?: string;
  /** Hard cap on modules attached to a single prompt. */
  readonly maxModules?: number;
}

export interface RetrievedPlatformKnowledge {
  readonly platformKnowledgeVersion: string;
  readonly modules: readonly PlatformKnowledgeModule[];
  readonly moduleIds: readonly string[];
  /** Bounded text block for the system prompt. */
  readonly promptBlock: string;
}
