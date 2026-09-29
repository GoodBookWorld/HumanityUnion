/**
 * Per-leaf WEB_UI reuse for preparation.
 * Whole-catalog adoption stays atomic. Valid leaves can still be kept.
 * Seed catalogs are preparation inputs, not a second runtime authority.
 */

import type { WebUiLeafReuseSource, WebUiMessageTree } from "@hu/types";

import { describeStructureMismatch } from "./web-ui-message-pack.validate.js";

export const WEB_UI_PARTIAL_REUSE_CONTRACT = "partial_reuse_v1" as const;

const BRAND_MACHINE_SENTINEL = "__HU_BRAND_SITE_NAME__";
const PROTECTION_MARK = "⟦w";

export type WebUiLeafReuseClass =
  | "VALID_REUSABLE"
  | "MISSING"
  | "EMPTY"
  | "STALE"
  | "STRUCTURALLY_INVALID";

export type WebUiLeafReuseCandidate = {
  readonly source: WebUiLeafReuseSource;
  readonly value: unknown;
  /**
   * False when a recorded source fingerprint does not match the current
   * English corpus. Structure alone must not reuse that candidate.
   * Packaged and bundled catalogs have no per-leaf source version; their
   * compatibility is the structural contract against the current English leaf.
   */
  readonly sourceHashCompatible: boolean;
};

export type WebUiLeafReuseDecision = {
  readonly classification: WebUiLeafReuseClass;
  readonly value: string | null;
  readonly source: WebUiLeafReuseSource | null;
};

export function readWebUiPackSourceHash(sourceNote: string | null | undefined): string | null {
  const match = /sourceHash=([a-f0-9]{64})/.exec(sourceNote ?? "");
  return match?.[1] ?? null;
}

export function readWebUiMessagePath(messages: unknown, dottedPath: string): unknown {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Same presentation contract publication requires: placeholders, ICU balance,
 * rich-text tags, and no unresolved protection sentinels.
 */
export function isWebUiLeafStructurallyReusable(english: string, localized: string): boolean {
  if (localized.includes(BRAND_MACHINE_SENTINEL) || localized.includes(PROTECTION_MARK)) {
    return false;
  }
  return describeStructureMismatch(english, localized) == null;
}

/**
 * First compatible structurally valid candidate wins.
 * Mongo, then packaged, then bundled. Invalid text never blocks a later valid leaf.
 */
export function classifyWebUiLeafForReuse(input: {
  readonly english: string;
  readonly candidates: readonly WebUiLeafReuseCandidate[];
}): WebUiLeafReuseDecision {
  let sawEmpty = false;
  let sawInvalid = false;
  let sawStale = false;
  let sawValue = false;

  for (const candidate of input.candidates) {
    if (typeof candidate.value !== "string") {
      continue;
    }
    sawValue = true;
    if (candidate.value.trim().length === 0) {
      sawEmpty = true;
      continue;
    }
    if (!candidate.sourceHashCompatible) {
      sawStale = true;
      continue;
    }
    if (!isWebUiLeafStructurallyReusable(input.english, candidate.value)) {
      sawInvalid = true;
      continue;
    }
    return {
      classification: "VALID_REUSABLE",
      value: candidate.value,
      source: candidate.source,
    };
  }

  if (!sawValue) {
    return { classification: "MISSING", value: null, source: null };
  }
  if (sawInvalid) {
    return { classification: "STRUCTURALLY_INVALID", value: null, source: null };
  }
  if (sawEmpty) {
    return { classification: "EMPTY", value: null, source: null };
  }
  if (sawStale) {
    return { classification: "STALE", value: null, source: null };
  }
  return { classification: "MISSING", value: null, source: null };
}

export function classifyWebUiCatalogLeaves(input: {
  readonly englishFlat: Readonly<Record<string, string>>;
  readonly mongo: WebUiMessageTree | null;
  readonly mongoSourceHashCompatible: boolean;
  readonly packaged: WebUiMessageTree | null;
  readonly bundled: WebUiMessageTree | null;
}): Map<string, WebUiLeafReuseDecision> {
  const decisions = new Map<string, WebUiLeafReuseDecision>();
  for (const pathKey of Object.keys(input.englishFlat).sort()) {
    const candidates: WebUiLeafReuseCandidate[] = [];
    if (input.mongo) {
      candidates.push({
        source: "MONGO_PUBLISHED",
        value: readWebUiMessagePath(input.mongo, pathKey),
        sourceHashCompatible: input.mongoSourceHashCompatible,
      });
    }
    if (input.packaged) {
      candidates.push({
        source: "PACKAGED",
        value: readWebUiMessagePath(input.packaged, pathKey),
        sourceHashCompatible: true,
      });
    }
    if (input.bundled) {
      candidates.push({
        source: "BUNDLED",
        value: readWebUiMessagePath(input.bundled, pathKey),
        sourceHashCompatible: true,
      });
    }
    decisions.set(
      pathKey,
      classifyWebUiLeafForReuse({
        english: input.englishFlat[pathKey] ?? "",
        candidates,
      }),
    );
  }
  return decisions;
}
