import type { InitiativeId } from "./initiative.js";
import type { MemberId } from "./member.js";

export type WorkspaceAssistantProviderMode = "mock" | "ai_assisted" | "hybrid";

export type WorkspaceAssistantConfidenceLevel = "not_applicable" | "low" | "medium" | "high";

/** Advisory assistant capabilities — never execute civic mutations. */
export type WorkspaceAssistantCapability =
  | "improve_title"
  | "clarify_summary"
  | "check_missing_fields"
  | "explain_compatibility_review"
  | "strengthen_evidence"
  | "identify_risks"
  | "structure_analysis"
  | "structure_proposal"
  | "draft_revision_summary"
  | "explain_decision_session"
  | "explain_decision_result"
  | "prepare_cap_summary"
  | "suggest_recipient_categories"
  | "prepare_delivery_message"
  | "summarize_official_response"
  | "prepare_accountability_event"
  | "structure_implementation_update"
  | "clarify_public_impact"
  | "prepare_archive_lessons"
  | "explain_pipeline_status"
  | "review_related_records"
  | "identify_next_step"
  | "explain_current_section";

/** Civic operations the assistant must never perform or command. */
export type WorkspaceAssistantProhibitedAction =
  | "publish_initiative"
  | "vote"
  | "change_vote"
  | "verify_response"
  | "verify_public_impact"
  | "send_cap"
  | "archive_record"
  | "decide_proposal"
  | "close_decision"
  | "create_official_claim_of_truth"
  | "perform_legal_interpretation";

export interface WorkspaceAssistantSafetyNotice {
  code: string;
  message: string;
}

export interface WorkspaceAssistantContextSnapshot {
  initiativeId: InitiativeId;
  initiativeTitle: string;
  lifecyclePhase: string;
  currentSection: string;
  currentSectionLabel: string;
  currentCivicStage: string | null;
  nextAvailableStep: string | null;
  relatedRecordsCount: number;
  visibilityLabel: string;
  contextSummary: string;
}

export interface WorkspaceAssistantAction {
  capability: WorkspaceAssistantCapability;
  label: string;
}

export interface WorkspaceAssistantRequest {
  participantId: MemberId;
  initiativeId: InitiativeId;
  currentSection: string;
  requestedAction: WorkspaceAssistantAction;
  userPrompt?: string;
  contextSnapshot: WorkspaceAssistantContextSnapshot;
  timestamp: string;
}

export interface WorkspaceAssistantResponse {
  responseId: string;
  mode: WorkspaceAssistantProviderMode;
  assistantMessage: string;
  suggestedDraft?: string;
  suggestedChecklist?: string[];
  confidenceLevel: WorkspaceAssistantConfidenceLevel;
  safetyNotices: WorkspaceAssistantSafetyNotice[];
  followUpPrompts: string[];
  prohibitedActions: WorkspaceAssistantProhibitedAction[];
  createdAt: string;
}

export const WORKSPACE_ASSISTANT_ALLOWED_CAPABILITIES: readonly WorkspaceAssistantCapability[] = [
  "improve_title",
  "clarify_summary",
  "check_missing_fields",
  "explain_compatibility_review",
  "strengthen_evidence",
  "identify_risks",
  "structure_analysis",
  "structure_proposal",
  "draft_revision_summary",
  "explain_decision_session",
  "explain_decision_result",
  "prepare_cap_summary",
  "suggest_recipient_categories",
  "prepare_delivery_message",
  "summarize_official_response",
  "prepare_accountability_event",
  "structure_implementation_update",
  "clarify_public_impact",
  "prepare_archive_lessons",
  "explain_pipeline_status",
  "review_related_records",
  "identify_next_step",
  "explain_current_section",
];

export const WORKSPACE_ASSISTANT_PROHIBITED_ACTIONS: readonly WorkspaceAssistantProhibitedAction[] =
  [
    "publish_initiative",
    "vote",
    "change_vote",
    "verify_response",
    "verify_public_impact",
    "send_cap",
    "archive_record",
    "decide_proposal",
    "close_decision",
    "create_official_claim_of_truth",
    "perform_legal_interpretation",
  ];
