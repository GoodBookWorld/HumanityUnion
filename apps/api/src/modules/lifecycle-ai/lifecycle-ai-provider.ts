import type {
  InitiativeLifecycleAiAssistOperation,
  InitiativeLifecycleAiAssistResult,
  InitiativeLifecycleAiAssistSuggestion,
  InitiativeLifecycleStageId,
  LifecycleAiProviderId,
} from "@hu/types";

/**
 * Part 1 / Part 7 — provider-independent Lifecycle AI seam.
 * Callers never import Gemini, Mistral, Cohere, etc. directly.
 */
export interface LifecycleAiProviderPrompt {
  readonly systemPrompt: string;
  readonly userPrompt: string;
}

export interface LifecycleAiProviderRequest {
  readonly initiativeId: string;
  readonly stageId: InitiativeLifecycleStageId;
  readonly stageLabel: string;
  readonly operation: InitiativeLifecycleAiAssistOperation;
  readonly participantDisplayName: string;
  readonly initiativeTitle: string;
  readonly presentationMode: string;
  readonly availableSourceLabels: readonly string[];
  readonly instructions?: string;
  readonly currentDraftExcerpt?: string;
  readonly targetSectionId?: string;
  readonly sourceContextSummary: string;
  readonly prompt: LifecycleAiProviderPrompt;
  /** Pack 02 — optional surface specialization metadata for platform-wide sessions. */
  readonly surfaceId?: string;
  readonly featureLabel?: string;
  readonly specializationInstructions?: string;
  /**
   * Pack 05 — bounded retrieved platform knowledge for this request.
   * When omitted, buildLifecycleAiPrompt retrieves from instructions/surface/stage.
   */
  readonly platformKnowledgePrompt?: string;
  readonly platformKnowledgeVersion?: string;
  /** Language Architecture Pack 01 — preferred Assistant response language. */
  readonly preferredResponseLanguage?: string;
  readonly interfaceLanguage?: string;
  readonly sourceContentLanguage?: string | null;
  /** Production Hardening Pack 01 — bounded temporary conversation memory. */
  readonly conversationHistory?: readonly {
    readonly role: "assistant" | "participant";
    readonly text: string;
  }[];
}

export interface LifecycleAiProvider {
  readonly providerId: LifecycleAiProviderId;
  assist(request: LifecycleAiProviderRequest): Promise<{
    readonly suggestions: readonly InitiativeLifecycleAiAssistSuggestion[];
    readonly isPlaceholder: boolean;
  }>;
}

export type { InitiativeLifecycleAiAssistResult };
