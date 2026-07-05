import { publicProjectionEngine } from "../../public-projection-engine";

const WORLD_SCOPE = { scope: "world" as const };

export async function getWorldParticipationPublicStatisticsProjection() {
  const projection = await publicProjectionEngine.getParticipationStatistics(WORLD_SCOPE);

  if (!projection) {
    throw new Error("World participation statistics projection is unavailable.");
  }

  return projection;
}

export async function getWorldParticipationPipelinePublicProjection() {
  const projection = await publicProjectionEngine.getParticipationPipeline(WORLD_SCOPE);

  if (!projection) {
    throw new Error("World participation pipeline projection is unavailable.");
  }

  return projection;
}
