import type {
  Implementation,
  ImplementationPhase,
  ImplementationStatus,
  Milestone,
} from "@hu/types";

export const BOOTSTRAP_PARTICIPANT_ID = "member-bootstrap-001";

export const PIPELINE_STAGES = [
  "Initiative",
  "Collaborative Analysis",
  "Collective Decision",
  "Petition",
  "Implementation Commitment",
  "Implementation",
  "Impact",
] as const;

export function formatImplementationDate(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatImplementationDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getPipelineStageStatus(stage: (typeof PIPELINE_STAGES)[number]): string {
  const currentIndex = PIPELINE_STAGES.indexOf("Implementation");

  if (stage === "Implementation") {
    return "Current stage";
  }

  const stageIndex = PIPELINE_STAGES.indexOf(stage);

  if (stageIndex < currentIndex) {
    return "Complete";
  }

  return "Not yet active";
}

export function getLifecycleSummary(status: ImplementationStatus): string {
  switch (status) {
    case "Planned":
      return "Preparing implementation structure and references";
    case "Started":
      return "Opened for collective execution recording";
    case "InProgress":
      return "Active — recording collective achievements";
    case "Completed":
      return "Execution record closed successfully";
    case "Archived":
      return "Archived historical record";
    default:
      return status;
  }
}

export function getStatusRecordingSummary(status: ImplementationStatus): string {
  if (status === "Planned" || status === "Started") {
    return "Collective progress will appear when achievements are recorded during active implementation.";
  }

  if (status === "InProgress") {
    return "Authoritative achievement recording is active for this implementation.";
  }

  if (status === "Completed" || status === "Archived") {
    return "This record is read-only. Derived progress and completion values are stabilized.";
  }

  return "Lifecycle state determines when derived progress claims are authoritative.";
}

export function sortPhases(phases: ImplementationPhase[]): ImplementationPhase[] {
  return [...phases].sort((left, right) => left.sequenceOrder - right.sequenceOrder);
}

export function getCurrentPhase(implementation: Implementation): ImplementationPhase | null {
  const ordered = sortPhases(implementation.implementationPhases);
  const openPhase = ordered.find((phase) => phase.status !== "Complete");

  if (openPhase) {
    return openPhase;
  }

  return ordered.at(-1) ?? null;
}

export function getCompletedPhases(implementation: Implementation): ImplementationPhase[] {
  return sortPhases(implementation.implementationPhases).filter(
    (phase) => phase.status === "Complete",
  );
}

export function getUpcomingPhases(implementation: Implementation): ImplementationPhase[] {
  return sortPhases(implementation.implementationPhases).filter(
    (phase) => phase.status !== "Complete",
  );
}

export function getMilestonesForPhase(
  implementation: Implementation,
  phaseId: string,
): Milestone[] {
  return implementation.milestones
    .filter((milestone) => milestone.implementationPhaseId === phaseId)
    .sort((left, right) => left.sequenceOrder - right.sequenceOrder);
}

export function getMilestoneTitle(
  implementation: Implementation,
  milestoneId: string,
): string {
  return (
    implementation.milestones.find((milestone) => milestone.milestoneId === milestoneId)?.title ??
    milestoneId
  );
}

export function getRequiredMilestones(implementation: Implementation): Milestone[] {
  return implementation.milestones.filter((milestone) => milestone.requirementType === "Required");
}

export function getOptionalMilestones(implementation: Implementation): Milestone[] {
  return implementation.milestones.filter((milestone) => milestone.requirementType === "Optional");
}

export function getSatisfiedMilestones(implementation: Implementation): Milestone[] {
  return implementation.milestones.filter((milestone) => milestone.status === "Satisfied");
}

export function getRemainingRequiredMilestones(implementation: Implementation): Milestone[] {
  return getRequiredMilestones(implementation).filter(
    (milestone) => milestone.status !== "Satisfied",
  );
}

export function getRemainingOptionalMilestones(implementation: Implementation): Milestone[] {
  return getOptionalMilestones(implementation).filter(
    (milestone) => milestone.status !== "Satisfied",
  );
}

export function getOpenMilestones(implementation: Implementation): Milestone[] {
  return [...implementation.milestones]
    .filter((milestone) => milestone.status !== "Satisfied")
    .sort((left, right) => left.sequenceOrder - right.sequenceOrder);
}

export function canRecordAchievement(implementation: Implementation): boolean {
  return (
    (implementation.status === "Started" || implementation.status === "InProgress") &&
    getOpenMilestones(implementation).length > 0
  );
}

export function getAchievementRecordingUnavailableReason(
  implementation: Implementation,
): string | null {
  if (implementation.status === "Planned") {
    return "Achievement recording opens after implementation is started.";
  }

  if (implementation.status === "Completed" || implementation.status === "Archived") {
    return "This implementation record is read-only.";
  }

  if (implementation.milestones.length === 0) {
    return "Define milestones before recording achievements.";
  }

  if (getOpenMilestones(implementation).length === 0) {
    return "All milestones are satisfied. No additional achievements may be recorded against them.";
  }

  if (implementation.status !== "Started" && implementation.status !== "InProgress") {
    return "Achievement recording is not available in this lifecycle state.";
  }

  return null;
}

export function getAchievementsForEvidenceAttachment(implementation: Implementation) {
  return [...implementation.achievements].sort(
    (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
  );
}

export function canAttachEvidence(implementation: Implementation): boolean {
  return (
    (implementation.status === "Started" || implementation.status === "InProgress") &&
    implementation.achievements.length > 0
  );
}

export function getEvidenceAttachmentUnavailableReason(
  implementation: Implementation,
): string | null {
  if (implementation.status === "Planned") {
    return "Evidence may be attached after implementation recording is opened.";
  }

  if (implementation.status === "Completed" || implementation.status === "Archived") {
    return "This implementation record is read-only.";
  }

  if (implementation.achievements.length === 0) {
    return "Record a collective achievement before attaching supporting evidence.";
  }

  if (implementation.status !== "Started" && implementation.status !== "InProgress") {
    return "Evidence attachment is not available in this lifecycle state.";
  }

  return null;
}

export function achievementHasEvidence(implementation: Implementation, achievementId: string): boolean {
  return implementation.evidence.some((entry) => entry.achievementId === achievementId);
}

export function getEvidenceForAchievement(
  implementation: Implementation,
  achievementId: string,
) {
  return implementation.evidence.filter((entry) => entry.achievementId === achievementId);
}

export interface NextMeaningfulObservation {
  title: string;
  detail: string;
}

export function deriveNextMeaningfulObservation(
  implementation: Implementation,
): NextMeaningfulObservation {
  const { status, progressSnapshots, completion, collectiveProgress } = implementation;

  if (status === "Archived") {
    return {
      title: "Implementation is archived",
      detail: "This implementation record is read-only and preserved for institutional memory.",
    };
  }

  if (status === "Completed" || completion.completionReached) {
    return {
      title: "Implementation is now complete",
      detail: "This record is read-only. Derived completion criteria have been satisfied.",
    };
  }

  if (progressSnapshots.length >= 2) {
    const latest = progressSnapshots.at(-1)!;
    const previous = progressSnapshots.at(-2)!;

    if (latest.requiredMilestonesSatisfiedCount > previous.requiredMilestonesSatisfiedCount) {
      const delta =
        latest.requiredMilestonesSatisfiedCount - previous.requiredMilestonesSatisfiedCount;

      return {
        title: "Collective progress increased",
        detail: `${delta} additional required milestone(s) are now satisfied since the previous recorded state.`,
      };
    }

    if (latest.milestonesSatisfiedCount > previous.milestonesSatisfiedCount) {
      return {
        title: "A milestone has been completed",
        detail: "Recorded collective achievements satisfied an additional milestone.",
      };
    }

    if (latest.collectiveProgressSummary !== previous.collectiveProgressSummary) {
      return {
        title: "Collective progress summary changed",
        detail: latest.collectiveProgressSummary,
      };
    }
  }

  const currentPhase = getCurrentPhase(implementation);
  const completedPhases = getCompletedPhases(implementation);

  if (
    currentPhase &&
    currentPhase.status === "Complete" &&
    completedPhases.length === 1 &&
    status === "InProgress"
  ) {
    return {
      title: "Implementation entered a new phase",
      detail: `Phase "${currentPhase.title}" is complete. Review upcoming phase structure for remaining milestones.`,
    };
  }

  if (status === "Started") {
    return {
      title: "Implementation recording has started",
      detail:
        "This record is open for collective execution. Achievements will update derived progress when recorded.",
    };
  }

  if (status === "Planned") {
    return {
      title: "Implementation is being prepared",
      detail:
        "Structure and references are being defined. Collective progress will appear when recording becomes active.",
    };
  }

  if (implementation.evidence.length > 0 && collectiveProgress.totalAchievements > 0) {
    return {
      title: "Evidence supports recorded achievements",
      detail:
        "Supporting material is attached to one or more achievements. Evidence supports transparency — it does not establish objective truth.",
    };
  }

  if (collectiveProgress.totalAchievements === 0 && status === "InProgress") {
    return {
      title: "No collective achievements recorded yet",
      detail:
        "This implementation is active. Derived progress will appear when achievements are recorded.",
    };
  }

  return {
    title: "Review current collective progress",
    detail: implementation.progressIndicator.headline,
  };
}

export interface AssistantGuidance {
  summary: string;
  highlights: string[];
  suggestion: string;
}

export function deriveAssistantGuidance(implementation: Implementation): AssistantGuidance {
  const { status, collectiveProgress, completionAssessment, completion, progressIndicator } =
    implementation;
  const observation = deriveNextMeaningfulObservation(implementation);
  const achievements = [...implementation.achievements].sort(
    (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
  );

  const highlights: string[] = [
    `Lifecycle state: ${status} — ${getLifecycleSummary(status)}.`,
    `Derived progress: ${progressIndicator.requiredMilestoneProgressLabel}`,
    "Progress and completion are derived from recorded achievements — never manually edited.",
  ];

  if (achievements.length > 0) {
    highlights.push(
      `Latest recorded achievement: "${achievements[0]?.title}" toward milestone "${getMilestoneTitle(implementation, achievements[0]?.milestoneId ?? "")}".`,
    );
  } else {
    highlights.push("No collective achievements have been recorded yet.");
  }

  if (implementation.evidence.length > 0) {
    highlights.push(
      `${implementation.evidence.length} evidence item(s) support recorded achievements. Evidence supports transparency — it does not certify truth.`,
    );
  }

  if (completionAssessment.assessmentReached) {
    highlights.push("All required milestones are satisfied by recorded collective achievements.");
  } else if (status === "InProgress" || status === "Completed") {
    highlights.push(completionAssessment.explanation);
  }

  if (completion.completionReached) {
    highlights.push("Derived implementation completion has been reached.");
  }

  return {
    summary:
      "This assistant explains implementation status, derived progress, achievements and evidence. It never approves, records, coordinates or assigns work.",
    highlights,
    suggestion: observation.detail,
  };
}
