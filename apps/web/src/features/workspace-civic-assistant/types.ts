import type {
  Initiative,
  WorkspaceAssistantCapability,
  WorkspaceAssistantContextSnapshot,
} from "@hu/types";

export interface WorkspaceAssistantContext {
  initiativeId: string;
  initiativeTitle: string;
  lifecyclePhase: Initiative["lifecyclePhase"];
  currentSection: string;
  currentSectionLabel: string;
  currentCivicStage: string | null;
  nextAvailableStep: string | null;
  relatedRecordsCount: number;
  visibilityLabel: "Workspace (private)" | "Public record available";
  contextSummary: string;
}

export interface WorkspaceSuggestedAction {
  id: string;
  label: string;
  capability: WorkspaceAssistantCapability;
}

export function toWorkspaceAssistantContextSnapshot(
  context: WorkspaceAssistantContext,
): WorkspaceAssistantContextSnapshot {
  return {
    initiativeId: context.initiativeId,
    initiativeTitle: context.initiativeTitle,
    lifecyclePhase: context.lifecyclePhase,
    currentSection: context.currentSection,
    currentSectionLabel: context.currentSectionLabel,
    currentCivicStage: context.currentCivicStage,
    nextAvailableStep: context.nextAvailableStep,
    relatedRecordsCount: context.relatedRecordsCount,
    visibilityLabel: context.visibilityLabel,
    contextSummary: context.contextSummary,
  };
}
