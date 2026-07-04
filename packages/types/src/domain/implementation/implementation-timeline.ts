/** Ordered timeline entry for collective execution narrative presentation. */
export interface ImplementationTimelineEntry {
  occurredAt: string;
  label: string;
  entryKind: string;
}

/** Ordered presentation model of phases, milestones, achievements and significant updates. */
export interface ImplementationTimeline {
  entries: ImplementationTimelineEntry[];
  generatedAt: string;
}
