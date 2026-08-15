import type {
  InitiativeLifecyclePresentationMode,
  InitiativeLifecycleViewerRole,
} from "./initiative-lifecycle-presentation.js";
import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";
import type {
  InitiativeLifecycleAiAssistOperation,
  LifecycleAiProviderDiagnostics,
  LifecycleAiProviderId,
} from "./initiative-lifecycle-ai-assist.js";
import type { LanguageCode } from "./language.js";

/**
 * Platform AI Assistant Pack 02 — canonical Humanity Union Assistant contracts.
 *
 * One Assistant product. Context specialization changes by surface; Gemini and
 * other vendors remain behind the existing LifecycleAiProvider seam.
 */

export type HumanityUnionAssistantSurfaceId =
  | "workspace"
  | "profile"
  | "preferences"
  | "initiatives"
  | "initiative"
  | "discussion"
  | "analysis"
  | "proposal"
  | "revision"
  | "petition"
  | "decision_session"
  | "collective_decision"
  | "commitment"
  | "tracking"
  | "official_response"
  | "public_impact"
  | "archive"
  | "notifications"
  | "messages"
  /** Blog Publishing Domain — educational guidance only; never publishes. */
  | "blog";

export const HUMANITY_UNION_ASSISTANT_SURFACE_IDS: readonly HumanityUnionAssistantSurfaceId[] = [
  "workspace",
  "profile",
  "preferences",
  "initiatives",
  "initiative",
  "discussion",
  "analysis",
  "proposal",
  "revision",
  "petition",
  "decision_session",
  "collective_decision",
  "commitment",
  "tracking",
  "official_response",
  "public_impact",
  "archive",
  "notifications",
  "messages",
  "blog",
] as const;

/**
 * Session history policy.
 * Pack 02: transient_modal_session (cleared when modal closed).
 * Production Hardening Pack 01: transient_browser_session — remembered for the
 * active browser tab/session via sessionStorage only. Never MongoDB / never DMs.
 */
export type HumanityUnionAssistantSessionHistoryPolicy =
  | "transient_modal_session"
  | "transient_browser_session";

export const HUMANITY_UNION_ASSISTANT_SESSION_HISTORY_POLICY: HumanityUnionAssistantSessionHistoryPolicy =
  "transient_browser_session";

/** One bounded conversation turn sent with an assist request (no permanent storage). */
export interface HumanityUnionAssistantConversationTurn {
  readonly role: "assistant" | "participant";
  readonly text: string;
}

export const HUMANITY_UNION_ASSISTANT_PRODUCT_NAME = "Humanity Union Assistant" as const;

export interface HumanityUnionAssistantSessionContext {
  readonly assistantName: typeof HUMANITY_UNION_ASSISTANT_PRODUCT_NAME;
  /** First-open greeting; includes the participant display name at most once. */
  readonly greeting: string;
  readonly participantDisplayName: string;
  readonly currentPageLabel: string;
  readonly currentFeatureLabel: string;
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly initiativeId: string | null;
  readonly initiativeTitle: string | null;
  readonly stageId: InitiativeLifecycleStageId | null;
  readonly stageLabel: string | null;
  readonly presentationMode: InitiativeLifecyclePresentationMode | null;
  readonly viewerRole: InitiativeLifecycleViewerRole | null;
  readonly specializationSummary: string;
  readonly suggestedQuestions: readonly string[];
  readonly availableSourceLabels: readonly string[];
  readonly allowedOperations: readonly InitiativeLifecycleAiAssistOperation[];
  readonly allowedActionLabels: readonly string[];
  readonly humanityUnionPrinciples: readonly string[];
  /** Topic labels only — full knowledge text stays server-side. */
  readonly platformKnowledgeTopics: readonly string[];
  readonly safetyPolicySummary: string;
  readonly sessionHistoryPolicy: HumanityUnionAssistantSessionHistoryPolicy;
  readonly canApplySuggestionsToDraft: boolean;
  readonly providerId: LifecycleAiProviderId;
  readonly providerReady: boolean;
  /**
   * Language Architecture Pack 01 — response / interface language context.
   * Defaults to platform language when preferences are unavailable.
   */
  readonly interfaceLanguage: LanguageCode;
  readonly preferredResponseLanguage: LanguageCode;
  /** Language of the current Initiative / stage content when known. */
  readonly sourceContentLanguage: LanguageCode | null;
  readonly diagnostics?: LifecycleAiProviderDiagnostics;
}

export interface HumanityUnionAssistantAssistRequest {
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly operation: InitiativeLifecycleAiAssistOperation;
  readonly initiativeId?: string;
  readonly stageId?: InitiativeLifecycleStageId;
  readonly pagePath?: string;
  readonly instructions?: string;
  readonly targetSectionId?: string;
  readonly currentDraftExcerpt?: string;
  /**
   * Production Hardening Pack 01 — recent in-browser session turns only.
   * Server applies max-history truncation; never persisted server-side.
   */
  readonly conversationHistory?: readonly HumanityUnionAssistantConversationTurn[];
}

export interface HumanityUnionAssistantAssistResult {
  readonly requestId: string;
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly initiativeId: string | null;
  readonly stageId: InitiativeLifecycleStageId | null;
  readonly operation: InitiativeLifecycleAiAssistOperation;
  readonly generatedAt: string;
  readonly suggestions: readonly {
    readonly suggestionId: string;
    readonly targetSectionId: string | null;
    readonly suggestedText: string;
    readonly provenanceNote: string;
  }[];
  readonly providerId: LifecycleAiProviderId;
  readonly isPlaceholder: boolean;
  readonly autoApplied: false;
  readonly autoPublished: false;
  readonly outOfScope: boolean;
  readonly diagnostics?: LifecycleAiProviderDiagnostics;
}

export function isHumanityUnionAssistantSurfaceId(
  value: unknown,
): value is HumanityUnionAssistantSurfaceId {
  return (
    typeof value === "string" &&
    (HUMANITY_UNION_ASSISTANT_SURFACE_IDS as readonly string[]).includes(value)
  );
}
