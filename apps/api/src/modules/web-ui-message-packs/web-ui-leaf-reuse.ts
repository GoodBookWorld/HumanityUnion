/**
 * Per-leaf WEB_UI reuse for preparation.
 * A Mongo leaf is current only when its stored English fingerprint matches
 * the current authoritative English value and the localized value still
 * passes the presentation contract.
 * Packaged and bundled catalogs are bootstrap candidates. Structure match
 * alone does not prove them current.
 */

import type { WebUiLeafReuseSource, WebUiMessageTree } from "@hu/types";

import { fingerprintWebUiEnglishLeaf } from "./web-ui-draft-builder.js";
import { describeStructureMismatch } from "./web-ui-message-pack.validate.js";

export const WEB_UI_PARTIAL_REUSE_CONTRACT = "partial_reuse_v1" as const;

const BRAND_MACHINE_SENTINEL = "__HU_BRAND_SITE_NAME__";
const PROTECTION_MARK = "⟦w";

export type WebUiLeafReuseClass =
  | "REUSE_CURRENT"
  | "MISSING"
  | "STALE_SOURCE"
  | "STRUCTURE_INCOMPATIBLE"
  | "INVALID_TRANSLATION";

export type WebUiLeafReuseCandidate = {
  readonly source: WebUiLeafReuseSource;
  readonly value: unknown;
  /**
   * True only when this candidate's stored English fingerprint equals the
   * current English leaf. Packaged and bundled candidates are never proven.
   */
  readonly provenCurrent: boolean;
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

function isInvalidTranslationText(localized: string): boolean {
  return (
    localized.trim().length === 0 ||
    localized.includes(BRAND_MACHINE_SENTINEL) ||
    localized.includes(PROTECTION_MARK)
  );
}

/**
 * First proven, structurally valid candidate wins.
 * Mongo, then packaged, then bundled. Unproven text never becomes current.
 */
export function classifyWebUiLeafForReuse(input: {
  readonly english: string;
  readonly candidates: readonly WebUiLeafReuseCandidate[];
}): WebUiLeafReuseDecision {
  let sawInvalid = false;
  let sawStructure = false;
  let sawStale = false;
  let sawValue = false;

  for (const candidate of input.candidates) {
    if (typeof candidate.value !== "string") {
      continue;
    }
    sawValue = true;
    if (isInvalidTranslationText(candidate.value)) {
      sawInvalid = true;
      continue;
    }
    const structureOk = describeStructureMismatch(input.english, candidate.value) == null;
    if (candidate.provenCurrent && structureOk) {
      return {
        classification: "REUSE_CURRENT",
        value: candidate.value,
        source: candidate.source,
      };
    }
    if (!structureOk) {
      sawStructure = true;
      continue;
    }
    sawStale = true;
  }

  if (!sawValue) {
    return { classification: "MISSING", value: null, source: null };
  }
  if (sawStructure) {
    return { classification: "STRUCTURE_INCOMPATIBLE", value: null, source: null };
  }
  if (sawInvalid) {
    return { classification: "INVALID_TRANSLATION", value: null, source: null };
  }
  if (sawStale) {
    return { classification: "STALE_SOURCE", value: null, source: null };
  }
  return { classification: "MISSING", value: null, source: null };
}

export function classifyWebUiCatalogLeaves(input: {
  readonly englishFlat: Readonly<Record<string, string>>;
  readonly mongo: WebUiMessageTree | null;
  readonly mongoSourceFingerprintsByPath?: Readonly<Record<string, string>> | null;
  readonly packaged: WebUiMessageTree | null;
  readonly bundled: WebUiMessageTree | null;
}): Map<string, WebUiLeafReuseDecision> {
  const fingerprints = input.mongoSourceFingerprintsByPath ?? {};
  const decisions = new Map<string, WebUiLeafReuseDecision>();
  for (const pathKey of Object.keys(input.englishFlat).sort()) {
    const english = input.englishFlat[pathKey] ?? "";
    const currentFingerprint = fingerprintWebUiEnglishLeaf(english);
    const storedFingerprint = fingerprints[pathKey];
    const candidates: WebUiLeafReuseCandidate[] = [];
    if (input.mongo) {
      candidates.push({
        source: "MONGO_PUBLISHED",
        value: readWebUiMessagePath(input.mongo, pathKey),
        provenCurrent: storedFingerprint != null && storedFingerprint === currentFingerprint,
      });
    }
    if (input.packaged) {
      candidates.push({
        source: "PACKAGED",
        value: readWebUiMessagePath(input.packaged, pathKey),
        provenCurrent: false,
      });
    }
    if (input.bundled) {
      candidates.push({
        source: "BUNDLED",
        value: readWebUiMessagePath(input.bundled, pathKey),
        provenCurrent: false,
      });
    }
    decisions.set(
      pathKey,
      classifyWebUiLeafForReuse({
        english,
        candidates,
      }),
    );
  }
  return decisions;
}
