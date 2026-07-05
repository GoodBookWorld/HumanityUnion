import type { ParticipationPipelinePublicProjection } from "@hu/types";

export const WORLD_PARTICIPATION_PIPELINE_PUBLIC_PROJECTION: ParticipationPipelinePublicProjection =
  {
    scope: "world",
    scopeLabel: "World",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    stages: [
      { stageId: "initiative", label: "Initiative", count: 3 },
      { stageId: "collaborative-analysis", label: "Collaborative Analysis", count: 2 },
      { stageId: "collective-decision", label: "Collective Decision", count: 1 },
      { stageId: "petition", label: "Petition", count: 1 },
      { stageId: "implementation-commitment", label: "Implementation Commitment", count: 1 },
      { stageId: "implementation", label: "Implementation", count: 1 },
    ],
  };
