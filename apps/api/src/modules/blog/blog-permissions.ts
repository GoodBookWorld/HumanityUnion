import type { AuthRole, BlogCapability } from "@hu/types";

import { findBlogCapabilityGrant } from "./persistence/blog.repository.js";

/**
 * Resolve Blog capabilities for a Participant.
 * Does not create a second identity — grants are additive on AuthIdentity.
 *
 * Platform role mapping (Pack 02):
 * - admin → administrator (+ editor, trusted_author, author)
 * - moderator → editor (+ author)
 * Explicit grants in `blog_capability_grants` remain authoritative for Authors.
 */
export async function resolveBlogCapabilities(input: {
  participantId: string;
  role?: AuthRole;
}): Promise<ReadonlySet<BlogCapability>> {
  const capabilities = new Set<BlogCapability>();
  const grant = await findBlogCapabilityGrant(input.participantId);

  for (const capability of grant?.capabilities ?? []) {
    if (
      capability === "author_applicant" ||
      capability === "author" ||
      capability === "trusted_author" ||
      capability === "editor" ||
      capability === "administrator"
    ) {
      capabilities.add(capability);
    }
  }

  if (input.role === "admin") {
    capabilities.add("administrator");
    capabilities.add("editor");
    capabilities.add("trusted_author");
    capabilities.add("author");
  }

  if (input.role === "moderator") {
    capabilities.add("editor");
    capabilities.add("author");
  }

  // Higher tiers imply Author for own drafts.
  if (
    capabilities.has("trusted_author") ||
    capabilities.has("editor") ||
    capabilities.has("administrator")
  ) {
    capabilities.add("author");
  }

  return capabilities;
}

export function hasBlogCapability(
  capabilities: ReadonlySet<BlogCapability>,
  required: BlogCapability,
): boolean {
  return capabilities.has(required);
}

export function canCreateBlogDraft(capabilities: ReadonlySet<BlogCapability>): boolean {
  return (
    capabilities.has("author") ||
    capabilities.has("trusted_author") ||
    capabilities.has("editor") ||
    capabilities.has("administrator")
  );
}

export function canDirectPublish(capabilities: ReadonlySet<BlogCapability>): boolean {
  return (
    capabilities.has("trusted_author") ||
    capabilities.has("editor") ||
    capabilities.has("administrator")
  );
}

/**
 * Pack 16G — Trusted Publishing (publish without manual review).
 * Resolved from the Author grant on every decision; never from a client flag.
 */
export async function resolvePublishWithoutManualReview(
  participantId: string,
): Promise<boolean> {
  const grant = await findBlogCapabilityGrant(participantId);
  return grant?.publishWithoutManualReview === true;
}

/** Capability-tier direct publish OR Admin-granted Trusted Publishing. */
export async function actorMayBypassManualReview(input: {
  participantId: string;
  capabilities: ReadonlySet<BlogCapability>;
}): Promise<boolean> {
  if (canDirectPublish(input.capabilities)) {
    return true;
  }
  return resolvePublishWithoutManualReview(input.participantId);
}

export function canEditorialPublish(capabilities: ReadonlySet<BlogCapability>): boolean {
  return capabilities.has("editor") || capabilities.has("administrator");
}

export function canEditOthersDrafts(capabilities: ReadonlySet<BlogCapability>): boolean {
  return capabilities.has("editor") || capabilities.has("administrator");
}

export function canArchiveAny(capabilities: ReadonlySet<BlogCapability>): boolean {
  return capabilities.has("editor") || capabilities.has("administrator");
}

export function canManageAuthorGrants(capabilities: ReadonlySet<BlogCapability>): boolean {
  return capabilities.has("administrator");
}

/** Editor or Administrator may decide Author applications (Pack 04 review seam). */
export function canReviewAuthorApplications(capabilities: ReadonlySet<BlogCapability>): boolean {
  return capabilities.has("editor") || capabilities.has("administrator");
}

export function canRestoreArchived(capabilities: ReadonlySet<BlogCapability>): boolean {
  return capabilities.has("administrator");
}
