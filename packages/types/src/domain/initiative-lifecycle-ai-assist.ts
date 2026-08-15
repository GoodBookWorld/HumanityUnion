import type { InitiativeLifecyclePresentationMode } from "./initiative-lifecycle-presentation.js";
import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";

/**
 * Initiative Lifecycle AI Assist — provider-independent contracts.
 *
 * Results are always *suggestions*. The Author must take an explicit action
 * to copy text into their draft, then Save → Preview → Publish. Nothing here
 * writes to a domain's persisted draft or publishes automatically.
 */

export type InitiativeLifecycleAiAssistOperation =
  | "generate_draft"
  | "regenerate_section"
  | "improve_wording"
  | "identify_missing_information"
  | "identify_contradictions"
  | "summarize_source_themes"
  | "explain"
  | "answer_question";

export const INITIATIVE_LIFECYCLE_AI_ASSIST_OPERATIONS: readonly InitiativeLifecycleAiAssistOperation[] =
  [
    "generate_draft",
    "regenerate_section",
    "improve_wording",
    "identify_missing_information",
    "identify_contradictions",
    "summarize_source_themes",
    "explain",
    "answer_question",
  ] as const;

/** Provider-independent seam id — never a vendor SDK type. */
export type LifecycleAiProviderId = "deterministic" | "gemini" | (string & {});

/**
 * Safe development diagnostic — confirms which provider handled a request.
 * Never includes API keys, secrets, or system prompts.
 */
export interface LifecycleAiProviderDiagnostics {
  readonly configuredProvider: LifecycleAiProviderId;
  readonly activeProviderId: LifecycleAiProviderId;
  readonly providerReady: boolean;
  /**
   * Pack 05 — which canonical platform knowledge corpus version informed the answer.
   * Development diagnostics only; not shown to ordinary users.
   */
  readonly platformKnowledgeVersion?: string;
  /**
   * Pack 05 — module ids retrieved for this request (bounded retrieval).
   * Development diagnostics only.
   */
  readonly retrievedKnowledgeModuleIds?: readonly string[];
  /** Production Hardening Pack 01 — prompt version ids used for this request (dev only). */
  readonly promptVersions?: readonly string[];
  /** Estimated prompt size in characters (dev only; never includes raw prompts). */
  readonly estimatedPromptChars?: number;
  /** Rough token estimate for cost control (dev only). */
  readonly estimatedPromptTokens?: number;
  readonly retryCount?: number;
  readonly responseDurationMs?: number;
  readonly surfaceId?: string;
  readonly presentationMode?: string;
  readonly conversationHistoryTurns?: number;
}

export interface InitiativeLifecycleAiAssistRequest {
  readonly initiativeId: string;
  readonly stageId: InitiativeLifecycleStageId;
  readonly operation: InitiativeLifecycleAiAssistOperation;
  readonly requestedByParticipantId: string;
  /** Optional section identifier for section-scoped operations (e.g. `regenerate_section`). */
  readonly targetSectionId?: string;
  /** Free-text guidance the Author supplied for this request, if any. */
  readonly instructions?: string;
  /**
   * Optional public draft excerpts the Author already has open (never private
   * chats, credentials, or personal messages).
   */
  readonly currentDraftExcerpt?: string;
}

export interface InitiativeLifecycleAiAssistSuggestion {
  readonly suggestionId: string;
  readonly targetSectionId: string | null;
  readonly suggestedText: string;
  /** Human-readable provenance note. Never hidden from the Author. */
  readonly provenanceNote: string;
}

export interface InitiativeLifecycleAiAssistResult {
  readonly requestId: string;
  readonly initiativeId: string;
  readonly stageId: InitiativeLifecycleStageId;
  readonly operation: InitiativeLifecycleAiAssistOperation;
  readonly generatedAt: string;
  readonly suggestions: readonly InitiativeLifecycleAiAssistSuggestion[];
  readonly providerId: LifecycleAiProviderId;
  /**
   * True only for explicit placeholder / unavailable-provider responses.
   * Real Gemini or deterministic suggestion payloads set this to false.
   */
  readonly isPlaceholder: boolean;
  /**
   * Always false by contract — AI never publishes or mutates civic records.
   * Surfaced so clients can assert the invariant without trusting UI alone.
   */
  readonly autoApplied: false;
  readonly autoPublished: false;
  /** Present only when Lifecycle AI diagnostics are enabled (development). */
  readonly diagnostics?: LifecycleAiProviderDiagnostics;
}

/**
 * Session context the AI Assistant modal shows immediately on open
 * (Part 2) — built server-side from Author identity + stage projection.
 */
export interface LifecycleAiAssistantSessionContext {
  readonly participantDisplayName: string;
  readonly initiativeId: string;
  readonly initiativeTitle: string;
  readonly stageId: InitiativeLifecycleStageId;
  readonly stageLabel: string;
  readonly presentationMode: InitiativeLifecyclePresentationMode;
  readonly availableSourceLabels: readonly string[];
  readonly allowedOperations: readonly InitiativeLifecycleAiAssistOperation[];
  readonly allowedActionLabels: readonly string[];
  readonly humanityUnionPrinciples: readonly string[];
  readonly providerId: LifecycleAiProviderId;
  readonly providerReady: boolean;
  /** Present only when Lifecycle AI diagnostics are enabled (development). */
  readonly diagnostics?: LifecycleAiProviderDiagnostics;
}
