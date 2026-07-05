import type { ImplementationId, ImplementationPhaseId, MilestoneId } from "./identifiers.js";
import type { MilestoneRequirementType } from "./milestone-requirement-type.js";
import type { MilestoneStatus } from "./milestone-status.js";

/** Defined collective checkpoint toward Implementation completion. */
export interface Milestone {
  milestoneId: MilestoneId;
  implementationId: ImplementationId;
  implementationPhaseId: ImplementationPhaseId;
  title: string;
  description: string;
  requirementType: MilestoneRequirementType;
  status: MilestoneStatus;
  sequenceOrder: number;
  createdAt: string;
  updatedAt: string;
  satisfiedAt: string | null;
}
