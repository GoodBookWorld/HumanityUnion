/**
 * R2/S3 user-defined object metadata proving which migrationExecutionId
 * created a destination object. Never includes credentials or PII.
 *
 * AWS SDK Metadata keys are stored lowercase; values are plain strings.
 */

import { ProductionInitiativeMigrationError } from "./errors.js";

export const R2_MIGRATION_OWNERSHIP_METADATA_KEYS = {
  executionId: "hu-mig-execution-id",
  marker: "hu-mig-marker",
} as const;

/** Immutable marker/version for objects written by this migration path. */
export const R2_MIGRATION_OWNERSHIP_MARKER =
  "production-initiative-media-v1" as const;

export type MigrationObjectOwnershipProof =
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

export interface DestinationObjectInspection {
  contentLength: number;
  contentType: string | null;
  checksumSHA256: string;
  /** Raw user-defined metadata (sanitized; ownership keys only retained in proof). */
  ownership: MigrationObjectOwnershipProof;
  rawOwnershipExecutionId: string | null;
  rawOwnershipMarker: string | null;
}

/** Build PutObject Metadata for a newly created migration-owned object. */
export function buildMigrationOwnershipMetadata(
  migrationExecutionId: string,
): Record<string, string> {
  if (!migrationExecutionId.startsWith("mig_")) {
    throw new ProductionInitiativeMigrationError(
      "migrationExecutionId required for ownership metadata.",
      "MEDIA_OWNERSHIP_METADATA_INVALID",
    );
  }
  return {
    [R2_MIGRATION_OWNERSHIP_METADATA_KEYS.executionId]: migrationExecutionId,
    [R2_MIGRATION_OWNERSHIP_METADATA_KEYS.marker]: R2_MIGRATION_OWNERSHIP_MARKER,
  };
}

/**
 * Parse HeadObject/GetObject Metadata into an ownership proof.
 * Exact migrationExecutionId match + expected marker required for "owned".
 */
export function parseMigrationOwnershipMetadata(
  metadata: Record<string, string> | undefined | null,
  expectedMigrationExecutionId: string,
): MigrationObjectOwnershipProof {
  const normalized = normalizeMetadataMap(metadata);
  const executionId =
    normalized[R2_MIGRATION_OWNERSHIP_METADATA_KEYS.executionId] ?? null;
  const marker = normalized[R2_MIGRATION_OWNERSHIP_METADATA_KEYS.marker] ?? null;

  if (!executionId) {
    return { kind: "unproven" };
  }
  if (
    executionId === expectedMigrationExecutionId &&
    marker === R2_MIGRATION_OWNERSHIP_MARKER
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

export function ownershipProofFromMetadata(
  metadata: Record<string, string> | undefined | null,
): {
  rawOwnershipExecutionId: string | null;
  rawOwnershipMarker: string | null;
} {
  const normalized = normalizeMetadataMap(metadata);
  return {
    rawOwnershipExecutionId:
      normalized[R2_MIGRATION_OWNERSHIP_METADATA_KEYS.executionId] ?? null,
    rawOwnershipMarker:
      normalized[R2_MIGRATION_OWNERSHIP_METADATA_KEYS.marker] ?? null,
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

/** True only when R2 metadata positively proves this exact execution owns the object. */
export function isProvenOwnedByMigration(
  ownership: MigrationObjectOwnershipProof,
): boolean {
  return ownership.kind === "owned";
}
