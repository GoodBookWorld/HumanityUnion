import type {
  ParticipationPipelinePublicProjection,
  ParticipationPublicStatisticsProjection,
} from "@hu/types";

import { WORLD_PARTICIPATION_PIPELINE_PUBLIC_PROJECTION } from "./bootstrap-pipeline";
import { WORLD_PARTICIPATION_PUBLIC_STATISTICS_PROJECTION } from "./bootstrap-statistics";

export async function getWorldParticipationPublicStatisticsProjection(): Promise<ParticipationPublicStatisticsProjection> {
  return WORLD_PARTICIPATION_PUBLIC_STATISTICS_PROJECTION;
}

export async function getWorldParticipationPipelinePublicProjection(): Promise<ParticipationPipelinePublicProjection> {
  return WORLD_PARTICIPATION_PIPELINE_PUBLIC_PROJECTION;
}
