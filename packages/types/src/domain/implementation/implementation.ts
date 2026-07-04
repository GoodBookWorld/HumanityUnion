import type { Achievement } from "./achievement.js";
import type { CollectiveProgress } from "./collective-progress.js";
import type { Completion } from "./completion.js";
import type { CompletionAssessment } from "./completion-assessment.js";
import type { CompletionIndicator } from "./completion-indicator.js";
import type { Evidence } from "./evidence.js";
import type {
  CollectiveDecisionId,
  FrozenPolicyId,
  ImplementationCommitmentId,
  ImplementationId,
  InitiativeId,
  PetitionId,
} from "./identifiers.js";
import type { ImplementationPhase } from "./implementation-phase.js";
import type { ImplementationStatus } from "./implementation-status.js";
import type { Milestone } from "./milestone.js";
import type { ProgressIndicator } from "./progress-indicator.js";
import type { ProgressSnapshot } from "./progress-snapshot.js";

/** Aggregate root for Stage 7 — Implementation. */
export interface Implementation {
  implementationId: ImplementationId;
  initiativeId: InitiativeId;
  collectiveDecisionId: CollectiveDecisionId;
  petitionId: PetitionId;
  implementationCommitmentId: ImplementationCommitmentId;
  frozenPolicyId: FrozenPolicyId;
  status: ImplementationStatus;
  subjectTitle: string;
  subjectSummary: string;
  createdAt: string;
  updatedAt: string;
  implementationPhases: ImplementationPhase[];
  milestones: Milestone[];
  achievements: Achievement[];
  evidence: Evidence[];
  collectiveProgress: CollectiveProgress;
  completionAssessment: CompletionAssessment;
  completion: Completion;
  progressIndicator: ProgressIndicator;
  completionIndicator: CompletionIndicator;
  progressSnapshots: ProgressSnapshot[];
}
