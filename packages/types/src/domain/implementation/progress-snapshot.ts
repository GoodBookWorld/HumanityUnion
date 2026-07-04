/** Point-in-time derived representation of Collective Progress. */
export interface ProgressSnapshot {
  snapshotAt: string;
  collectiveProgressSummary: string;
  milestonesSatisfiedCount: number;
  milestonesTotalCount: number;
  requiredMilestonesSatisfiedCount: number;
  derivedAt: string;
}
