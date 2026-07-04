/** Derived aggregate measure of collective implementation advancement. */
export interface CollectiveProgress {
  totalAchievements: number;
  completedPhaseCount: number;
  completedMilestoneCount: number;
  requiredMilestonesSatisfiedCount: number;
  requiredMilestonesTotalCount: number;
  optionalMilestonesSatisfiedCount: number;
  aggregateProgressSummary: string;
  derivedAt: string;
}
