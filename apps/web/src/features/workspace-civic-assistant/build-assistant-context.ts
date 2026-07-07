import type { CivicIntegrationView } from "@hu/types";
import type { Initiative } from "@hu/types";

import type { WorkspaceAssistantContext } from "./types";
import { getSectionContextLabel } from "./section-actions";

function formatStageLabel(stageId: string | null | undefined): string | null {
  if (!stageId) {
    return null;
  }

  return stageId.replace(/_/g, " ");
}

function buildVisibilityLabel(
  initiative: Initiative | null,
): WorkspaceAssistantContext["visibilityLabel"] {
  if (!initiative) {
    return "Workspace (private)";
  }

  if (initiative.lifecyclePhase === "draft") {
    return "Workspace (private)";
  }

  return "Public record available";
}

function buildContextSummary(input: {
  initiative: Initiative | null;
  sectionTitle: string;
  integrationView: CivicIntegrationView | null;
}): string {
  const sectionLabel = getSectionContextLabel(input.sectionTitle, input.initiative);
  const initiativeTitle = input.initiative?.title ?? "No initiative selected";
  const stage = formatStageLabel(input.integrationView?.pipelineStatus.currentStageId ?? null);
  const nextStep = input.integrationView?.pipelineStatus.nextAvailableStep ?? null;

  if (!input.initiative) {
    return "Select an initiative to receive contextual assistant guidance.";
  }

  if (nextStep) {
    return `You are working on "${initiativeTitle}" in ${sectionLabel}. The civic pipeline shows ${stage ?? "early progress"} with next step: ${nextStep}.`;
  }

  return `You are working on "${initiativeTitle}" in ${sectionLabel}. The civic pipeline shows ${stage ?? "early progress"}.`;
}

export function buildAssistantContext(input: {
  initiative: Initiative | null;
  currentSection: string;
  integrationView: CivicIntegrationView | null;
}): WorkspaceAssistantContext {
  const initiative = input.initiative;

  return {
    initiativeId: initiative?.initiativeId ?? "",
    initiativeTitle: initiative?.title ?? "No initiative selected",
    lifecyclePhase: initiative?.lifecyclePhase ?? "draft",
    currentSection: input.currentSection,
    currentSectionLabel: getSectionContextLabel(input.currentSection, initiative),
    currentCivicStage: formatStageLabel(
      input.integrationView?.pipelineStatus.currentStageId ?? null,
    ),
    nextAvailableStep: input.integrationView?.pipelineStatus.nextAvailableStep ?? null,
    relatedRecordsCount: input.integrationView?.relatedRecords.length ?? 0,
    visibilityLabel: buildVisibilityLabel(initiative),
    contextSummary: buildContextSummary({
      initiative,
      sectionTitle: input.currentSection,
      integrationView: input.integrationView,
    }),
  };
}
