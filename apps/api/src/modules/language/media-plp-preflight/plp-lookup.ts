/**
 * Reset 03A / 03E.2 — one-entity PLP current-pointer lookup (indexed, read-only).
 * Never scans history. Never logs presentation prose.
 * 03E.2 may load presentation in-memory solely to compute integrity counts.
 */

import type {
  LocalizationContentIntegrityReport,
  PublicPresentationNode,
} from "@hu/types";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { markMediaPlpPreflightPlpLookup } from "./counters.js";

export type MediaPlpPreflightPlpLookup = {
  readonly PLP_CURRENT_FOUND: boolean;
  readonly PLP_STATE: string | null;
  readonly PLP_CANONICAL_VERSION: string | null;
  readonly PLP_SCHEMA_VERSION: string | null;
  readonly PLP_DOCUMENT_BYTES: number;
  readonly PLP_RECORDS_MATCHED: number;
  readonly identityCollision: boolean;
  /** In-memory only — never printed by the preflight report. */
  readonly presentation?: PublicPresentationNode | null;
  readonly contentIntegrity?: LocalizationContentIntegrityReport | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function documentBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return 0;
  }
}

function parseContentIntegrity(
  raw: unknown,
): LocalizationContentIntegrityReport | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== "CLI.1") {
    return null;
  }
  const status = asString(obj.status);
  if (
    status !== "PASSED" &&
    status !== "FAILED" &&
    status !== "NOT_APPLICABLE_EN" &&
    status !== "UNKNOWN_LEGACY"
  ) {
    return null;
  }
  return {
    version: "CLI.1",
    status,
    TRANSLATABLE_NODE_COUNT:
      typeof obj.TRANSLATABLE_NODE_COUNT === "number"
        ? obj.TRANSLATABLE_NODE_COUNT
        : 0,
    LOCALIZED_VALUE_NODE_COUNT:
      typeof obj.LOCALIZED_VALUE_NODE_COUNT === "number"
        ? obj.LOCALIZED_VALUE_NODE_COUNT
        : 0,
    CANONICAL_IDENTICAL_NODE_COUNT:
      typeof obj.CANONICAL_IDENTICAL_NODE_COUNT === "number"
        ? obj.CANONICAL_IDENTICAL_NODE_COUNT
        : 0,
    EMPTY_OR_MISSING_NODE_COUNT:
      typeof obj.EMPTY_OR_MISSING_NODE_COUNT === "number"
        ? obj.EMPTY_OR_MISSING_NODE_COUNT
        : 0,
    PROTECTED_CANONICAL_NODE_COUNT:
      typeof obj.PROTECTED_CANONICAL_NODE_COUNT === "number"
        ? obj.PROTECTED_CANONICAL_NODE_COUNT
        : 0,
    reasonCodes: Array.isArray(obj.reasonCodes)
      ? (obj.reasonCodes.filter((c) => typeof c === "string") as LocalizationContentIntegrityReport["reasonCodes"])
      : [],
    evaluatedAt: asString(obj.evaluatedAt) || new Date(0).toISOString(),
  };
}

export async function loadMediaPlpPreflightCurrent(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
}): Promise<MediaPlpPreflightPlpLookup> {
  markMediaPlpPreflightPlpLookup();
  const collection = getMongoCollection<Record<string, unknown>>(
    MONGO_COLLECTIONS.publishedLocalizedPresentationsCurrent,
  );
  const locale = input.locale.toLowerCase();
  const cursor = collection.find(
    {
      entityType: input.entityType,
      entityId: input.entityId,
      locale,
    },
    {
      projection: {
        state: 1,
        identity: 1,
        contentRevision: 1,
        snapshotId: 1,
        publishedAt: 1,
        updatedAt: 1,
        presentation: 1,
        contentIntegrity: 1,
      },
      limit: 2,
    },
  );
  const doc = (await cursor.next()) as Record<string, unknown> | null;
  const second = await cursor.next();
  if (second) {
    return {
      PLP_CURRENT_FOUND: false,
      PLP_STATE: null,
      PLP_CANONICAL_VERSION: null,
      PLP_SCHEMA_VERSION: null,
      PLP_DOCUMENT_BYTES: 0,
      PLP_RECORDS_MATCHED: 2,
      identityCollision: true,
      presentation: null,
      contentIntegrity: null,
    };
  }

  if (!doc) {
    return {
      PLP_CURRENT_FOUND: false,
      PLP_STATE: null,
      PLP_CANONICAL_VERSION: null,
      PLP_SCHEMA_VERSION: null,
      PLP_DOCUMENT_BYTES: 0,
      PLP_RECORDS_MATCHED: 0,
      identityCollision: false,
      presentation: null,
      contentIntegrity: null,
    };
  }

  const identity =
    doc.identity && typeof doc.identity === "object" && !Array.isArray(doc.identity)
      ? (doc.identity as Record<string, unknown>)
      : {};

  // Document bytes exclude presentation bodies from the reported size when possible.
  const metaOnly = {
    state: doc.state,
    identity: doc.identity,
    contentRevision: doc.contentRevision,
    snapshotId: doc.snapshotId,
    contentIntegrity: doc.contentIntegrity,
  };

  return {
    PLP_CURRENT_FOUND: true,
    PLP_STATE: asString(doc.state) || null,
    PLP_CANONICAL_VERSION: asString(identity.canonicalVersion) || null,
    PLP_SCHEMA_VERSION:
      asString(identity.localizationSchemaVersion) ||
      PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    PLP_DOCUMENT_BYTES: documentBytes(metaOnly),
    PLP_RECORDS_MATCHED: 1,
    identityCollision: false,
    presentation: (doc.presentation as PublicPresentationNode | undefined) ?? null,
    contentIntegrity: parseContentIntegrity(doc.contentIntegrity),
  };
}
