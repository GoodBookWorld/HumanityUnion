import type { ImplementationId, ImplementationPhaseId } from "./identifiers.js";
import type { PhaseStatus } from "./phase-status.js";

/** Major segment of collective execution within one Implementation. */
export interface ImplementationPhase {
  implementationPhaseId: ImplementationPhaseId;
  implementationId: ImplementationId;
  title: string;
  summary: string;
  sequenceOrder: number;
  status: PhaseStatus;
  createdAt: string;
  updatedAt: string;
}
