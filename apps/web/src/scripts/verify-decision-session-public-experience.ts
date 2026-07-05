import { apiPublicProjectionProvider } from "../features/public-projection-engine/providers/api-public-projection-provider";
import { bootstrapPublicProjectionProvider } from "../features/public-projection-engine/providers/bootstrap-public-projection-provider";
import { resolvePublicProjectionProvider } from "../features/public-projection-engine/resolve-public-projection-provider";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const worldStats = await bootstrapPublicProjectionProvider.getParticipationStatistics({
    scope: "world",
  });
  assert(worldStats !== null, "Bootstrap world statistics should remain available");

  const communityExperience =
    await bootstrapPublicProjectionProvider.getCommunityExperienceProjections(
      "nelson-community-garden",
    );
  assert(communityExperience !== null, "Bootstrap community experience should remain available");

  const countryExperience =
    await bootstrapPublicProjectionProvider.getCountryExperienceProjections("canada");
  assert(countryExperience !== null, "Bootstrap country experience should remain available");

  const regionExperience =
    await bootstrapPublicProjectionProvider.getRegionExperienceProjections("british-columbia");
  assert(regionExperience !== null, "Bootstrap region experience should remain available");

  const previousProvider = process.env.PUBLIC_PROJECTION_PROVIDER;
  process.env.PUBLIC_PROJECTION_PROVIDER = "api";

  const apiProvider = resolvePublicProjectionProvider();
  assert(apiProvider.mode === "api", "API projection provider should resolve");

  const apiCommunityShell =
    await apiPublicProjectionProvider.getCommunityExperienceProjections("nelson-community-garden");
  assert(apiCommunityShell !== null, "API provider should retain bootstrap community shell");

  process.env.PUBLIC_PROJECTION_PROVIDER = previousProvider ?? "bootstrap";
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Public experience verification FAILED: ${message}`);
  process.exit(1);
});
