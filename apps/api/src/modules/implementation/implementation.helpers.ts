import type {
  Achievement,
  Completion,
  CompletionAssessment,
  CompletionIndicator,
  CollectiveProgress,
  Evidence,
  EvidenceAttachment,
  EvidenceKind,
  EvidenceLink,
  EvidenceReference,
  Implementation,
  ImplementationPhase,
  ImplementationStatus,
  Milestone,
  ProgressIndicator,
  ProgressSnapshot,
} from "@hu/types";

const ALLOWED_TRANSITIONS: Record<ImplementationStatus, ImplementationStatus[]> = {
  Planned: ["Started"],
  Started: ["InProgress"],
  InProgress: ["Completed"],
  Completed: ["Archived"],
  Archived: [],
};

const PREPARATORY_STATES: ImplementationStatus[] = ["Planned", "Started"];

const STRUCTURE_EDIT_STATES: ImplementationStatus[] = ["Planned", "Started", "InProgress"];

const RECORDING_STATES: ImplementationStatus[] = ["Started", "InProgress"];

export function cloneImplementation(implementation: Implementation): Implementation {
  return structuredClone(implementation);
}

export function assertValidTransition(
  currentStatus: ImplementationStatus,
  nextStatus: ImplementationStatus,
): void {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];

  if (!allowed.includes(nextStatus)) {
    throw new Error(`Transition from "${currentStatus}" to "${nextStatus}" is not allowed.`);
  }
}

export function assertMutableImplementation(status: ImplementationStatus): void {
  if (status === "Archived") {
    throw new Error("Archived Implementations are read-only.");
  }
}

export function assertPreparatoryImplementation(status: ImplementationStatus): void {
  if (!PREPARATORY_STATES.includes(status)) {
    throw new Error("Only Planned or Started implementations can be updated in preparatory mode.");
  }
}

export function assertStructureEditAllowed(status: ImplementationStatus): void {
  if (!STRUCTURE_EDIT_STATES.includes(status)) {
    throw new Error("Phase and milestone structure cannot be modified in this lifecycle state.");
  }
}

export function assertRecordingAllowed(status: ImplementationStatus): void {
  if (!RECORDING_STATES.includes(status)) {
    throw new Error("Achievements and evidence may only be recorded while implementation is Started or In Progress.");
  }
}

export function createEmptyCollectiveProgress(now = new Date().toISOString()): CollectiveProgress {
  return {
    totalAchievements: 0,
    completedPhaseCount: 0,
    completedMilestoneCount: 0,
    requiredMilestonesSatisfiedCount: 0,
    requiredMilestonesTotalCount: 0,
    optionalMilestonesSatisfiedCount: 0,
    aggregateProgressSummary: "No collective achievements recorded yet.",
    derivedAt: now,
  };
}

export function createEmptyCompletionAssessment(now = new Date().toISOString()): CompletionAssessment {
  return {
    assessmentReached: false,
    satisfiedCriteria: [],
    unsatisfiedCriteria: [],
    evaluatedAt: now,
    explanation: "Completion assessment will be derived when milestones and achievements exist.",
  };
}

export function createEmptyCompletion(now = new Date().toISOString()): Completion {
  return {
    completionReached: false,
    derivedAt: now,
    explanation: "Implementation completion has not been derived yet.",
  };
}

export function createEmptyProgressIndicator(now = new Date().toISOString()): ProgressIndicator {
  return {
    headline: "Collective progress has not been recorded yet.",
    requiredMilestoneProgressLabel: "Required milestones not yet evaluated.",
    derivedAt: now,
  };
}

export function createEmptyCompletionIndicator(now = new Date().toISOString()): CompletionIndicator {
  return {
    completionReached: false,
    headline: "Implementation is not yet complete.",
    requiredCriteriaProgressLabel: "Required completion criteria not yet evaluated.",
    derivedAt: now,
  };
}

function getAchievementsForMilestone(
  implementation: Implementation,
  milestoneId: string,
): Achievement[] {
  return implementation.achievements.filter((achievement) => achievement.milestoneId === milestoneId);
}

function getMilestonesForPhase(implementation: Implementation, phaseId: string): Milestone[] {
  return implementation.milestones.filter(
    (milestone) => milestone.implementationPhaseId === phaseId,
  );
}

function phaseContainsRequiredMilestone(implementation: Implementation, phase: ImplementationPhase): boolean {
  return getMilestonesForPhase(implementation, phase.implementationPhaseId).some(
    (milestone) => milestone.requirementType === "Required",
  );
}

export function syncDerivedMilestoneAndPhaseStatuses(implementation: Implementation, now: string): void {
  for (const milestone of implementation.milestones) {
    const achievementCount = getAchievementsForMilestone(implementation, milestone.milestoneId).length;

    if (achievementCount > 0 && milestone.status !== "Satisfied") {
      milestone.status = "Satisfied";
      milestone.satisfiedAt = milestone.satisfiedAt ?? now;
      milestone.updatedAt = now;
    }
  }

  for (const phase of implementation.implementationPhases) {
    const phaseMilestones = getMilestonesForPhase(implementation, phase.implementationPhaseId);

    if (phaseMilestones.length === 0) {
      continue;
    }

    const allSatisfied = phaseMilestones.every((milestone) => milestone.status === "Satisfied");

    if (allSatisfied && phase.status !== "Complete") {
      phase.status = "Complete";
      phase.updatedAt = now;
    } else if (!allSatisfied && phase.status === "Complete") {
      phase.status = "Open";
      phase.updatedAt = now;
    }
  }
}

export function calculateCollectiveProgress(
  implementation: Implementation,
  now = new Date().toISOString(),
): CollectiveProgress {
  const requiredMilestones = implementation.milestones.filter(
    (milestone) => milestone.requirementType === "Required",
  );
  const optionalMilestones = implementation.milestones.filter(
    (milestone) => milestone.requirementType === "Optional",
  );
  const satisfiedMilestones = implementation.milestones.filter(
    (milestone) => milestone.status === "Satisfied",
  );
  const requiredSatisfied = requiredMilestones.filter((milestone) => milestone.status === "Satisfied");
  const optionalSatisfied = optionalMilestones.filter((milestone) => milestone.status === "Satisfied");
  const completedPhases = implementation.implementationPhases.filter(
    (phase) => phase.status === "Complete",
  );

  let aggregateProgressSummary = "No collective achievements recorded yet.";

  if (implementation.achievements.length > 0) {
    aggregateProgressSummary = `${implementation.achievements.length} collective achievement(s) recorded; ${satisfiedMilestones.length} of ${implementation.milestones.length} milestones satisfied.`;
  }

  return {
    totalAchievements: implementation.achievements.length,
    completedPhaseCount: completedPhases.length,
    completedMilestoneCount: satisfiedMilestones.length,
    requiredMilestonesSatisfiedCount: requiredSatisfied.length,
    requiredMilestonesTotalCount: requiredMilestones.length,
    optionalMilestonesSatisfiedCount: optionalSatisfied.length,
    aggregateProgressSummary,
    derivedAt: now,
  };
}

export function calculateCompletionAssessment(
  implementation: Implementation,
  now = new Date().toISOString(),
): CompletionAssessment {
  const requiredMilestones = implementation.milestones.filter(
    (milestone) => milestone.requirementType === "Required",
  );
  const satisfiedCriteria = requiredMilestones
    .filter((milestone) => milestone.status === "Satisfied")
    .map((milestone) => milestone.milestoneId);
  const unsatisfiedCriteria = requiredMilestones
    .filter((milestone) => milestone.status !== "Satisfied")
    .map((milestone) => milestone.milestoneId);
  const assessmentReached =
    requiredMilestones.length > 0 && unsatisfiedCriteria.length === 0;

  return {
    assessmentReached,
    satisfiedCriteria,
    unsatisfiedCriteria,
    evaluatedAt: now,
    explanation: assessmentReached
      ? "All required milestones are satisfied by recorded collective achievements."
      : requiredMilestones.length === 0
        ? "No required milestones are defined for completion assessment."
        : "Required milestones remain unsatisfied by recorded collective achievements.",
  };
}

export function calculateCompletion(
  implementation: Implementation,
  assessment: CompletionAssessment,
  now = new Date().toISOString(),
): Completion {
  const requiredPhases = implementation.implementationPhases.filter((phase) =>
    phaseContainsRequiredMilestone(implementation, phase),
  );
  const completedRequiredPhases = requiredPhases.filter((phase) => phase.status === "Complete");
  const phasesComplete =
    requiredPhases.length === 0 ||
    completedRequiredPhases.length === requiredPhases.length;
  const completionReached =
    assessment.assessmentReached &&
    phasesComplete &&
    ["InProgress", "Completed"].includes(implementation.status);

  return {
    completionReached,
    derivedAt: now,
    explanation: completionReached
      ? "Derived completion criteria are satisfied for required milestones and required phases."
      : !assessment.assessmentReached
        ? assessment.explanation
        : !phasesComplete
          ? "Required phases remain incomplete relative to milestone satisfaction."
          : "Implementation completion becomes authoritative during active collective recording.",
  };
}

export function calculateProgressIndicator(
  progress: CollectiveProgress,
  now = new Date().toISOString(),
): ProgressIndicator {
  const headline =
    progress.totalAchievements === 0
      ? "Collective progress has not been recorded yet."
      : progress.aggregateProgressSummary;

  const requiredMilestoneProgressLabel =
    progress.requiredMilestonesTotalCount === 0
      ? "No required milestones defined."
      : `${progress.requiredMilestonesSatisfiedCount} of ${progress.requiredMilestonesTotalCount} required milestones satisfied.`;

  return {
    headline,
    requiredMilestoneProgressLabel,
    derivedAt: now,
  };
}

export function calculateCompletionIndicator(
  completion: Completion,
  assessment: CompletionAssessment,
  now = new Date().toISOString(),
): CompletionIndicator {
  const requiredCriteriaProgressLabel =
    assessment.unsatisfiedCriteria.length === 0
      ? "All required completion criteria are satisfied."
      : `${assessment.satisfiedCriteria.length} required criteria satisfied; ${assessment.unsatisfiedCriteria.length} remain.`;

  return {
    completionReached: completion.completionReached,
    headline: completion.completionReached
      ? "Collective implementation completion has been derived."
      : "Implementation is not yet complete.",
    requiredCriteriaProgressLabel,
    derivedAt: now,
  };
}

function buildProgressSnapshot(
  implementation: Implementation,
  progress: CollectiveProgress,
  now: string,
): ProgressSnapshot {
  return {
    snapshotAt: now,
    collectiveProgressSummary: progress.aggregateProgressSummary,
    milestonesSatisfiedCount: progress.completedMilestoneCount,
    milestonesTotalCount: implementation.milestones.length,
    requiredMilestonesSatisfiedCount: progress.requiredMilestonesSatisfiedCount,
    derivedAt: now,
  };
}

function appendProgressSnapshotIfChanged(
  implementation: Implementation,
  progress: CollectiveProgress,
  now: string,
): void {
  const snapshot = buildProgressSnapshot(implementation, progress, now);
  const latest = implementation.progressSnapshots.at(-1);

  if (
    !latest ||
    latest.collectiveProgressSummary !== snapshot.collectiveProgressSummary ||
    latest.requiredMilestonesSatisfiedCount !== snapshot.requiredMilestonesSatisfiedCount
  ) {
    implementation.progressSnapshots.push(snapshot);
  }
}

export function refreshDerivedState(implementation: Implementation): void {
  const now = new Date().toISOString();

  syncDerivedMilestoneAndPhaseStatuses(implementation, now);

  implementation.collectiveProgress = calculateCollectiveProgress(implementation, now);
  implementation.completionAssessment = calculateCompletionAssessment(implementation, now);
  implementation.completion = calculateCompletion(
    implementation,
    implementation.completionAssessment,
    now,
  );
  implementation.progressIndicator = calculateProgressIndicator(
    implementation.collectiveProgress,
    now,
  );
  implementation.completionIndicator = calculateCompletionIndicator(
    implementation.completion,
    implementation.completionAssessment,
    now,
  );

  if (
    implementation.completion.completionReached &&
    implementation.status === "InProgress"
  ) {
    assertValidTransition(implementation.status, "Completed");
    implementation.status = "Completed";
  }

  if (implementation.status === "InProgress" || implementation.status === "Completed") {
    appendProgressSnapshotIfChanged(implementation, implementation.collectiveProgress, now);
  }
}

export function validateEvidencePayload(
  evidenceKind: EvidenceKind,
  reference: EvidenceReference | null | undefined,
  attachment: EvidenceAttachment | null | undefined,
  link: EvidenceLink | null | undefined,
): void {
  if (evidenceKind === "Reference" && !reference) {
    throw new Error("Evidence of kind Reference requires reference payload.");
  }

  if (evidenceKind === "Attachment" && !attachment) {
    throw new Error("Evidence of kind Attachment requires attachment payload.");
  }

  if (evidenceKind === "Link" && !link) {
    throw new Error("Evidence of kind Link requires link payload.");
  }
}

export function buildEvidenceRecord(
  evidenceId: string,
  achievementId: string,
  implementationId: string,
  evidenceKind: EvidenceKind,
  label: string,
  reference: EvidenceReference | null | undefined,
  attachment: EvidenceAttachment | null | undefined,
  link: EvidenceLink | null | undefined,
  now: string,
): Evidence {
  validateEvidencePayload(evidenceKind, reference, attachment, link);

  return {
    evidenceId,
    achievementId,
    implementationId,
    evidenceKind,
    label,
    recordedAt: now,
    createdAt: now,
    reference: evidenceKind === "Reference" ? (reference ?? null) : null,
    attachment: evidenceKind === "Attachment" ? (attachment ?? null) : null,
    link: evidenceKind === "Link" ? (link ?? null) : null,
  };
}
