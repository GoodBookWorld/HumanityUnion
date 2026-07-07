import type { Initiative } from "@hu/types";

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
}
