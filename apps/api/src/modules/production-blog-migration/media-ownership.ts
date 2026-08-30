/**
 * R2 object ownership metadata for Blog migration.
 * Independent of production-initiative-migration (distinct marker).
 */

import { ProductionBlogMigrationError } from "./errors.js";

export const BLOG_R2_OWNERSHIP_METADATA_KEYS = {
  executionId: "hu-mig-execution-id",
  marker: "hu-mig-marker",
} as const;

export const BLOG_R2_OWNERSHIP_MARKER = "production-blog-media-v1" as const;

export type BlogMigrationObjectOwnershipProof =
  | {
      kind: "owned";
      migrationExecutionId: string;
      marker: string;
    }
  | {
      kind: "foreign";
      migrationExecutionId: string;
      marker: string | null;
    }
  | {
      kind: "unproven";
    };

export function buildBlogMigrationOwnershipMetadata(
  migrationExecutionId: string,
): Record<string, string> {
  if (!migrationExecutionId.startsWith("mig_")) {
    throw new ProductionBlogMigrationError(
      "migrationExecutionId required for Blog ownership metadata.",
      "MEDIA_OWNERSHIP_METADATA_INVALID",
    );
  }
  return {
    [BLOG_R2_OWNERSHIP_METADATA_KEYS.executionId]: migrationExecutionId,
    [BLOG_R2_OWNERSHIP_METADATA_KEYS.marker]: BLOG_R2_OWNERSHIP_MARKER,
  };
}

function normalizeMetadataMap(
  metadata: Record<string, string> | undefined | null,
): Record<string, string> {
  if (!metadata) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value !== "string") continue;
    out[key.trim().toLowerCase()] = value.trim();
  }
  return out;
}

export function parseBlogMigrationOwnershipMetadata(
  metadata: Record<string, string> | undefined | null,
  expectedMigrationExecutionId: string,
): BlogMigrationObjectOwnershipProof {
  const normalized = normalizeMetadataMap(metadata);
  const executionId =
    normalized[BLOG_R2_OWNERSHIP_METADATA_KEYS.executionId] ?? null;
  const marker = normalized[BLOG_R2_OWNERSHIP_METADATA_KEYS.marker] ?? null;

  if (!executionId) {
    return { kind: "unproven" };
  }
  if (
    executionId === expectedMigrationExecutionId &&
    marker === BLOG_R2_OWNERSHIP_MARKER
  ) {
    return {
      kind: "owned",
      migrationExecutionId: executionId,
      marker,
    };
  }
  return {
    kind: "foreign",
    migrationExecutionId: executionId,
    marker,
  };
}

export function blogOwnershipProofFromMetadata(
  metadata: Record<string, string> | undefined | null,
): {
  rawOwnershipExecutionId: string | null;
  rawOwnershipMarker: string | null;
} {
  const normalized = normalizeMetadataMap(metadata);
  return {
    rawOwnershipExecutionId:
      normalized[BLOG_R2_OWNERSHIP_METADATA_KEYS.executionId] ?? null,
    rawOwnershipMarker: normalized[BLOG_R2_OWNERSHIP_METADATA_KEYS.marker] ?? null,
  };
}

export function isProvenOwnedByBlogMigration(
  ownership: BlogMigrationObjectOwnershipProof,
): boolean {
  return ownership.kind === "owned";
}
