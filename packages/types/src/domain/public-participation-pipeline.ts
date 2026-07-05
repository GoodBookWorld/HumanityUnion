import type { PublicGeographicScope } from "./public-participation-statistics.js";

export type ParticipationPipelineStageId =
  | "initiative"
  | "collaborative-analysis"
  | "collective-decision"
  | "petition"
  | "implementation-commitment"
  | "implementation";

export interface ParticipationPipelineStageCount {
  stageId: ParticipationPipelineStageId;
  label: string;
  count: number;
}

export interface ParticipationPipelinePublicProjection {
  scope: PublicGeographicScope;
  scopeLabel: string;
  stages: ParticipationPipelineStageCount[];
  generatedAt: string;
  source: "bootstrap" | "projection";
}
