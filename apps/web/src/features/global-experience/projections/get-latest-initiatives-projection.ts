import { loadGlobalExperienceProjections } from "../../public-projection-engine";

/** @deprecated Use `loadGlobalExperienceProjections` from `public-projection-engine`. */
export async function getWorldLatestInitiativesPublicProjection() {
  const { latestInitiatives } = await loadGlobalExperienceProjections();
  return latestInitiatives;
}
