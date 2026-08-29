import type { Document } from "mongodb";

import {
  CANONICAL_INITIATIVE_EXPECTATIONS,
  EXCLUDED_PRODUCTION_INITIATIVE_IDS,
  FORBIDDEN_TYPO_AI_COMMON_GOOD_ID,
  isExcludedInitiativeId,
  isForbiddenTypoAiCommonGoodId,
} from "./constants.js";
import type { CandidateInitiativeRow, PreflightVerdict } from "./types.js";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Build candidate Initiative row from a Mongo document (or null if missing).
 * Preserves lifecycleProfile as stored — including null/undefined — never invents STANDARD.
 */
export function buildCandidateInitiativeRow(input: {
  expected: (typeof CANONICAL_INITIATIVE_EXPECTATIONS)[number];
  doc: Document | null;
}): CandidateInitiativeRow {
  const { expected, doc } = input;
  if (!doc) {
    return {
      initiativeId: expected.initiativeId,
      present: false,
      idEqualsInitiativeId: null,
      stewardId: null,
      title: null,
      status: null,
      visibilityPolicy: null,
      lifecyclePhase: null,
      lifecycleProfile: undefined,
      createdAt: null,
      updatedAt: null,
      titleMatch: null,
      stewardMatch: null,
      excluded: isExcludedInitiativeId(expected.initiativeId),
      forbiddenTypo: isForbiddenTypoAiCommonGoodId(expected.initiativeId),
    };
  }

  const initiativeId = asString(doc.initiativeId) ?? asString(doc._id);
  const idField = asString(doc._id);
  const idEqualsInitiativeId =
    Boolean(initiativeId) && Boolean(idField) && initiativeId === idField;

  // Preserve as stored: if key absent → undefined; if explicitly null → null.
  const lifecycleProfile =
    "lifecycleProfile" in doc
      ? (doc.lifecycleProfile as string | null)
      : undefined;

  const visibility =
    doc.visibility && typeof doc.visibility === "object"
      ? (doc.visibility as Record<string, unknown>)
      : null;

  const title = asString(doc.title);
  const stewardId = asString(doc.stewardId);

  return {
    initiativeId: expected.initiativeId,
    present: true,
    idEqualsInitiativeId,
    stewardId,
    title,
    status: asString(doc.status),
    visibilityPolicy: asString(visibility?.policy),
    lifecyclePhase: asString(doc.lifecyclePhase),
    lifecycleProfile,
    createdAt: asString(doc.createdAt),
    updatedAt: asString(doc.updatedAt),
    titleMatch: title === expected.title,
    stewardMatch: stewardId === expected.stewardMemberId,
    excluded: false,
    forbiddenTypo: false,
  };
}

export function evaluateInitiativeVerdict(
  rows: CandidateInitiativeRow[],
): { verdict: PreflightVerdict; blockers: string[] } {
  const blockers: string[] = [];

  if (rows.length !== CANONICAL_INITIATIVE_EXPECTATIONS.length) {
    blockers.push(
      `Expected ${CANONICAL_INITIATIVE_EXPECTATIONS.length} candidate rows, got ${rows.length}`,
    );
  }

  for (const excluded of EXCLUDED_PRODUCTION_INITIATIVE_IDS) {
    if (rows.some((r) => r.initiativeId === excluded && r.present)) {
      blockers.push(`Excluded Initiative present in candidates: ${excluded}`);
    }
  }

  if (rows.some((r) => r.initiativeId === FORBIDDEN_TYPO_AI_COMMON_GOOD_ID)) {
    blockers.push(
      `Forbidden typo ID ${FORBIDDEN_TYPO_AI_COMMON_GOOD_ID} must never be used (correct: initiative-1785693642422)`,
    );
  }

  for (const row of rows) {
    if (!row.present) {
      blockers.push(`Missing Initiative root: ${row.initiativeId}`);
      continue;
    }
    if (row.idEqualsInitiativeId !== true) {
      blockers.push(`${row.initiativeId}: require _id === initiativeId`);
    }
    if (row.titleMatch !== true) {
      blockers.push(`${row.initiativeId}: title mismatch`);
    }
    if (row.stewardMatch !== true) {
      blockers.push(`${row.initiativeId}: stewardId mismatch`);
    }
  }

  return { verdict: blockers.length === 0 ? "PASS" : "FAIL", blockers };
}

/** Pure allow-list helpers for unit tests. */
export function assertAllowListRejectsBootstrapAndTest2(ids: readonly string[]): string[] {
  const blockers: string[] = [];
  for (const id of ids) {
    if (isExcludedInitiativeId(id)) {
      blockers.push(`Excluded Initiative must not be in allow-list: ${id}`);
    }
    if (isForbiddenTypoAiCommonGoodId(id)) {
      blockers.push(`Forbidden typo AI Common Good ID: ${id}`);
    }
  }
  return blockers;
}

export function assertExactNineAllowList(ids: readonly string[]): string[] {
  const blockers: string[] = [];
  const expected = CANONICAL_INITIATIVE_EXPECTATIONS.map((e) => e.initiativeId);
  if (ids.length !== 9) {
    blockers.push(`Allow-list must contain exactly 9 IDs (got ${ids.length})`);
  }
  for (const id of expected) {
    if (!ids.includes(id)) blockers.push(`Missing canonical ID: ${id}`);
  }
  for (const id of ids) {
    if (!expected.includes(id as (typeof expected)[number])) {
      blockers.push(`Unexpected ID in allow-list: ${id}`);
    }
  }
  return blockers;
}
