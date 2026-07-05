import type { PublicProjectionProvider } from "./provider";
import { apiPublicProjectionProvider } from "./providers/api-public-projection-provider";
import { bootstrapPublicProjectionProvider } from "./providers/bootstrap-public-projection-provider";

/**
 * Selects the active PublicProjectionProvider.
 * Capability 03 Experience pages stay unchanged when switching bootstrap → api.
 */
export function resolvePublicProjectionProvider(): PublicProjectionProvider {
  const mode = process.env.PUBLIC_PROJECTION_PROVIDER ?? "bootstrap";

  switch (mode) {
    case "api":
      return apiPublicProjectionProvider;
    case "bootstrap":
    default:
      return bootstrapPublicProjectionProvider;
  }
}
