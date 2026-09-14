import type { Document } from "mongodb";

import {
  type CollectionCatalogEntry,
  getCollectionCatalogEntry,
} from "./collection-plan.js";
import { ProductionInitiativeMigrationError } from "./errors.js";

export type MigrationPrimaryIdentityMode = "single" | "composite";

export interface ResolvedMigrationPrimaryIdentity {
  collection: string;
  mode: MigrationPrimaryIdentityMode;
  fields: readonly string[];
  /** Destination collision / absence filter (never includes Mongo ObjectId _id as domain identity). */
  filter: Record<string, unknown>;
  /** Deterministic report/verifier key (fields joined by "::"). */
  recordId: string;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Resolve declared catalog identity for a collection.
 * - compositePrimaryIdFields: all fields required (AND filter)
 * - else primaryIdFields[0]: single-field primary
 */
export function getDeclaredPrimaryIdentityFields(
  entry: CollectionCatalogEntry | undefined,
): { mode: MigrationPrimaryIdentityMode; fields: readonly string[] } | null {
  if (!entry) return null;
  if (entry.compositePrimaryIdFields && entry.compositePrimaryIdFields.length > 0) {
    return { mode: "composite", fields: entry.compositePrimaryIdFields };
  }
  if (entry.primaryIdFields && entry.primaryIdFields.length > 0) {
    return { mode: "single", fields: [entry.primaryIdFields[0]!] };
  }
  return null;
}

/**
 * Build destination primary filter + deterministic recordId from catalog identity.
 * Fail closed when declared fields are missing — never silently collapse composite → initiativeId.
 */
export function resolveMigrationPrimaryIdentity(input: {
  collection: string;
  doc: Document;
}): ResolvedMigrationPrimaryIdentity {
  const entry = getCollectionCatalogEntry(input.collection);
  const declared = getDeclaredPrimaryIdentityFields(entry);

  if (declared) {
    const filter: Record<string, unknown> = {};
    const parts: string[] = [];
    for (const field of declared.fields) {
      const value = asNonEmptyString(input.doc[field]);
      if (!value) {
        throw new ProductionInitiativeMigrationError(
          `Missing primary identity field "${field}" for ${input.collection} (${declared.mode})`,
          "MISSING_PRIMARY_KEY",
        );
      }
      filter[field] = value;
      parts.push(value);
    }
    return {
      collection: input.collection,
      mode: declared.mode,
      fields: declared.fields,
      filter,
      recordId: parts.join("::"),
    };
  }

  // Legacy fallbacks for collections without catalog primary metadata (membership special-cases).
  if (asNonEmptyString(input.doc.userId) && input.collection === "memberships") {
    const userId = asNonEmptyString(input.doc.userId)!;
    return {
      collection: input.collection,
      mode: "single",
      fields: ["userId"],
      filter: { userId },
      recordId: userId,
    };
  }
  if (asNonEmptyString(input.doc.applicationId)) {
    const applicationId = asNonEmptyString(input.doc.applicationId)!;
    return {
      collection: input.collection,
      mode: "single",
      fields: ["applicationId"],
      filter: { applicationId },
      recordId: applicationId,
    };
  }
  if (asNonEmptyString(input.doc.contributionId)) {
    const contributionId = asNonEmptyString(input.doc.contributionId)!;
    return {
      collection: input.collection,
      mode: "single",
      fields: ["contributionId"],
      filter: { contributionId },
      recordId: contributionId,
    };
  }
  if (asNonEmptyString(input.doc.initiativeId)) {
    const initiativeId = asNonEmptyString(input.doc.initiativeId)!;
    return {
      collection: input.collection,
      mode: "single",
      fields: ["initiativeId"],
      filter: { initiativeId },
      recordId: initiativeId,
    };
  }

  throw new ProductionInitiativeMigrationError(
    `Cannot build primary filter for ${input.collection}`,
    "MISSING_PRIMARY_KEY",
  );
}

/** Stable collision key across planned inserts. */
export function primaryIdentityCollisionKey(
  identity: Pick<ResolvedMigrationPrimaryIdentity, "collection" | "recordId">,
): string {
  return `${identity.collection}::${identity.recordId}`;
}

export interface IntraBatchPrimaryCollision {
  collection: string;
  recordId: string;
  count: number;
  collisionKey: string;
}

/**
 * Fail-closed detection: two planned source records must not share one destination primary identity.
 */
export function findIntraBatchPrimaryCollisions(
  rows: ReadonlyArray<{ collection: string; doc: Document }>,
): IntraBatchPrimaryCollision[] {
  const counts = new Map<
    string,
    { collection: string; recordId: string; count: number }
  >();
  for (const row of rows) {
    const identity = resolveMigrationPrimaryIdentity(row);
    const key = primaryIdentityCollisionKey(identity);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, {
        collection: identity.collection,
        recordId: identity.recordId,
        count: 1,
      });
    }
  }
  return [...counts.entries()]
    .filter(([, row]) => row.count > 1)
    .map(([collisionKey, row]) => ({
      collection: row.collection,
      recordId: row.recordId,
      count: row.count,
      collisionKey,
    }));
}

export function assertNoIntraBatchPrimaryCollisions(
  rows: ReadonlyArray<{ collection: string; doc: Document }>,
): void {
  const collisions = findIntraBatchPrimaryCollisions(rows);
  if (collisions.length === 0) return;
  const sample = collisions
    .slice(0, 5)
    .map((c) => `${c.collisionKey}×${c.count}`)
    .join("; ");
  throw new ProductionInitiativeMigrationError(
    `Intra-batch primary identity collision before writes: ${sample}`,
    "INTRA_BATCH_PRIMARY_COLLISION",
  );
}
