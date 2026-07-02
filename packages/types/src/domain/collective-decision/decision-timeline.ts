export interface DecisionTimeline {
  createdAt: string;
  scheduledAt: string | null;
  opensAt: string | null;
  closesAt: string | null;
  completedAt: string | null;
  archivedAt: string | null;
}
