import type { BlogCapability, PlatformCapabilityId } from "@hu/types";

/**
 * Maps legacy BlogCapability bundle values to canonical PlatformCapabilityId values.
 * Compatibility only — Blog grants remain authoritative for Blog until migration.
 */
export function mapBlogCapabilityToPlatformIds(
  capability: BlogCapability,
): readonly PlatformCapabilityId[] {
  switch (capability) {
    case "author_applicant":
      return [];
    case "author":
      return ["blog.author"];
    case "trusted_author":
      return ["blog.author", "blog.trusted_author", "blog.publish"];
    case "editor":
      return [
        "blog.author",
        "blog.review",
        "blog.publish",
        "blog.comment.moderate",
        "blog.author_application.review",
      ];
    case "administrator":
      return [
        "blog.author",
        "blog.trusted_author",
        "blog.review",
        "blog.publish",
        "blog.comment.moderate",
        "blog.author_application.review",
        "blog.capability.manage",
        "platform.admin",
        "platform.capability.manage",
        "platform.audit.read",
        "platform.settings.manage",
        "platform.ops.health.read",
        "safety.review",
      ];
    default:
      return [];
  }
}

export function expandBlogCapabilitiesToPlatformIds(
  capabilities: Iterable<BlogCapability>,
): Set<PlatformCapabilityId> {
  const result = new Set<PlatformCapabilityId>();
  for (const capability of capabilities) {
    for (const id of mapBlogCapabilityToPlatformIds(capability)) {
      result.add(id);
    }
  }
  return result;
}
