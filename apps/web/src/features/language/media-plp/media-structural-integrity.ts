/**
 * Reset 03E.3 — Media localization structural completeness (test/dev authority).
 *
 * Derived from:
 * - rendered MediaSemanticNode markers (semanticPath / messageKey)
 * - canonical entity AUTO paths
 * - build input path sets
 * - localized presentation path presence
 * - apply/projection path sets
 *
 * Do NOT maintain a hand inventory of expected field strings.
 */

import type { LocalizationStructuralIntegritySubreason } from "@hu/types";

import type { MediaSemanticNodeRecord } from "./media-semantic-contract";
import { collectRenderedMediaSemanticNodes } from "./media-rendered-coverage";

export type MediaStructuralCardinality = {
  readonly RENDERED_TRANSLATABLE_PATHS: number;
  readonly CANONICAL_SOURCE_PATHS: number;
  readonly BUILD_INPUT_PATHS: number;
  readonly LOCALIZED_OUTPUT_PATHS: number;
  readonly APPLIED_PRESENTATION_PATHS: number;
  readonly RENDERED_WITHOUT_SOURCE: number;
  readonly SOURCE_WITHOUT_BUILD: number;
  readonly BUILD_WITHOUT_OUTPUT: number;
  readonly OUTPUT_WITHOUT_APPLY: number;
  readonly APPLY_WITHOUT_RENDER: number;
  readonly CANONICAL_RENDER_BYPASS: number;
  readonly STRUCTURAL_MISMATCH_COUNT: number;
  readonly STRUCTURAL_INTEGRITY_STATUS: "PASSED" | "FAILED";
  readonly STRUCTURAL_INTEGRITY_VERSION: "LSI.1";
  readonly reasons: readonly LocalizationStructuralIntegritySubreason[];
  readonly failingPaths: readonly string[];
};

export type MediaStructuralEntityShape = {
  readonly entityType: string;
  readonly entityId: string;
  readonly canonicalSourcePaths: readonly string[];
  readonly buildInputPaths: readonly string[];
  readonly localizedOutputPaths: readonly string[];
  readonly appliedPresentationPaths: readonly string[];
};

function isTechnicalPath(path: string): boolean {
  return path === "id" || path.endsWith(".id");
}

function prosePaths(paths: readonly string[]): string[] {
  return [...new Set(paths.filter((p) => !isTechnicalPath(p)))];
}

/**
 * Compare one entity's rendered PLP paths against real structural sets.
 */
export function evaluateMediaEntityStructuralParity(input: {
  readonly renderedPaths: readonly string[];
  readonly shape: MediaStructuralEntityShape;
}): {
  readonly mismatches: LocalizationStructuralIntegritySubreason[];
  readonly failingPaths: string[];
  readonly counts: Omit<
    MediaStructuralCardinality,
    "STRUCTURAL_INTEGRITY_STATUS" | "STRUCTURAL_INTEGRITY_VERSION" | "reasons" | "failingPaths"
  >;
} {
  const rendered = prosePaths(input.renderedPaths);
  const source = prosePaths(input.shape.canonicalSourcePaths);
  const build = prosePaths(input.shape.buildInputPaths);
  const output = prosePaths(input.shape.localizedOutputPaths);
  const applied = prosePaths(input.shape.appliedPresentationPaths);

  const sourceSet = new Set(source);
  const buildSet = new Set(build);
  const outputSet = new Set(output);
  const appliedSet = new Set(applied);
  const renderedSet = new Set(rendered);

  const mismatches = new Set<LocalizationStructuralIntegritySubreason>();
  const failingPaths: string[] = [];

  let renderedWithoutSource = 0;
  let sourceWithoutBuild = 0;
  let buildWithoutOutput = 0;
  let outputWithoutApply = 0;
  let applyWithoutRender = 0;
  let canonicalBypass = 0;

  for (const path of rendered) {
    if (!sourceSet.has(path)) {
      renderedWithoutSource += 1;
      failingPaths.push(path);
      mismatches.add("RENDERED_PATH_NOT_IN_CANONICAL_LOCALIZATION_SOURCE");
    } else if (!buildSet.has(path)) {
      failingPaths.push(path);
      mismatches.add("RENDERED_PATH_NOT_IN_BUILD_INPUT");
    }
  }

  for (const path of source) {
    if (!buildSet.has(path)) {
      sourceWithoutBuild += 1;
      failingPaths.push(path);
      mismatches.add("SOURCE_WITHOUT_BUILD");
    }
  }

  for (const path of build) {
    if (!outputSet.has(path)) {
      buildWithoutOutput += 1;
      failingPaths.push(path);
      mismatches.add("BUILD_PATH_NOT_IN_PRESENTATION_SCHEMA");
      mismatches.add("BUILD_WITHOUT_OUTPUT");
    }
  }

  for (const path of output) {
    if (!appliedSet.has(path)) {
      outputWithoutApply += 1;
      failingPaths.push(path);
      mismatches.add("PRESENTATION_PATH_NOT_APPLIED");
      mismatches.add("OUTPUT_WITHOUT_APPLY");
    }
  }

  for (const path of applied) {
    if (!renderedSet.has(path) && sourceSet.has(path)) {
      // Soft: applied path not observed in this particular render (optional / not mounted).
      applyWithoutRender += 1;
    }
  }

  // Renderer canonical bypass: path is in source+build but missing from applied while rendered
  // under PLP ownership with CANONICAL_FALLBACK is handled by coverage RESULT; here detect
  // applied hole for a rendered path.
  for (const path of rendered) {
    if (sourceSet.has(path) && buildSet.has(path) && !appliedSet.has(path)) {
      canonicalBypass += 1;
      failingPaths.push(path);
      mismatches.add("RENDERER_CANONICAL_BYPASS");
    }
  }

  const STRUCTURAL_MISMATCH_COUNT =
    renderedWithoutSource +
    sourceWithoutBuild +
    buildWithoutOutput +
    outputWithoutApply +
    canonicalBypass;

  return {
    mismatches: [...mismatches],
    failingPaths: [...new Set(failingPaths)],
    counts: {
      RENDERED_TRANSLATABLE_PATHS: rendered.length,
      CANONICAL_SOURCE_PATHS: source.length,
      BUILD_INPUT_PATHS: build.length,
      LOCALIZED_OUTPUT_PATHS: output.length,
      APPLIED_PRESENTATION_PATHS: applied.length,
      RENDERED_WITHOUT_SOURCE: renderedWithoutSource,
      SOURCE_WITHOUT_BUILD: sourceWithoutBuild,
      BUILD_WITHOUT_OUTPUT: buildWithoutOutput,
      OUTPUT_WITHOUT_APPLY: outputWithoutApply,
      APPLY_WITHOUT_RENDER: applyWithoutRender,
      CANONICAL_RENDER_BYPASS: canonicalBypass,
      STRUCTURAL_MISMATCH_COUNT,
    },
  };
}

/**
 * Aggregate structural parity across entities + UI dictionary markers from HTML.
 */
export function evaluateMediaPageStructuralIntegrity(input: {
  readonly html: string;
  readonly entities: readonly MediaStructuralEntityShape[];
  readonly uiDictionaryKeysPresent?: ReadonlySet<string>;
  readonly uiDictionaryKeysExpected?: readonly string[];
  /** When true, every UI_DICTIONARY node must carry messageKey. */
  readonly strictUiDictionaryKeys?: boolean;
  /** When false, PLP nodes may omit semanticPath (legacy render fixtures). Default true. */
  readonly strictPlpSemanticPaths?: boolean;
}): MediaStructuralCardinality {
  const nodes = collectRenderedMediaSemanticNodes(input.html);
  const reasons = new Set<LocalizationStructuralIntegritySubreason>();
  const failingPaths: string[] = [];

  let totals = {
    RENDERED_TRANSLATABLE_PATHS: 0,
    CANONICAL_SOURCE_PATHS: 0,
    BUILD_INPUT_PATHS: 0,
    LOCALIZED_OUTPUT_PATHS: 0,
    APPLIED_PRESENTATION_PATHS: 0,
    RENDERED_WITHOUT_SOURCE: 0,
    SOURCE_WITHOUT_BUILD: 0,
    BUILD_WITHOUT_OUTPUT: 0,
    OUTPUT_WITHOUT_APPLY: 0,
    APPLY_WITHOUT_RENDER: 0,
    CANONICAL_RENDER_BYPASS: 0,
    STRUCTURAL_MISMATCH_COUNT: 0,
  };

  for (const node of nodes) {
    if (node.owner === "BUG_UNOWNED" || node.result === "UNOWNED") {
      reasons.add("UNOWNED_RENDERED_SEMANTIC_NODE");
      totals.STRUCTURAL_MISMATCH_COUNT += 1;
    }
    if (node.owner === "UI_DICTIONARY") {
      if (
        input.strictUiDictionaryKeys === true &&
        !node.messageKey
      ) {
        reasons.add("UI_DICTIONARY_KEY_MISSING");
        totals.STRUCTURAL_MISMATCH_COUNT += 1;
      } else if (
        node.messageKey &&
        input.uiDictionaryKeysPresent &&
        !input.uiDictionaryKeysPresent.has(node.messageKey)
      ) {
        reasons.add("UI_DICTIONARY_LOCALE_FALLBACK");
        failingPaths.push(node.messageKey);
        totals.STRUCTURAL_MISMATCH_COUNT += 1;
      }
    }
    if (
      node.owner === "PLP_ENTITY" &&
      !node.semanticPath &&
      input.strictPlpSemanticPaths !== false
    ) {
      // PLP-owned prose without a structural path cannot prove reachability.
      reasons.add("UNOWNED_RENDERED_SEMANTIC_NODE");
      totals.STRUCTURAL_MISMATCH_COUNT += 1;
    }
  }

  for (const shape of input.entities) {
    const renderedPaths = nodes
      .filter(
        (n) =>
          n.owner === "PLP_ENTITY" &&
          n.entityType === shape.entityType &&
          n.entityId === shape.entityId &&
          typeof n.semanticPath === "string",
      )
      .map((n) => n.semanticPath!);
    const parity = evaluateMediaEntityStructuralParity({
      renderedPaths,
      shape,
    });
    for (const reason of parity.mismatches) {
      reasons.add(reason);
    }
    failingPaths.push(...parity.failingPaths);
    totals = {
      RENDERED_TRANSLATABLE_PATHS:
        totals.RENDERED_TRANSLATABLE_PATHS + parity.counts.RENDERED_TRANSLATABLE_PATHS,
      CANONICAL_SOURCE_PATHS:
        totals.CANONICAL_SOURCE_PATHS + parity.counts.CANONICAL_SOURCE_PATHS,
      BUILD_INPUT_PATHS: totals.BUILD_INPUT_PATHS + parity.counts.BUILD_INPUT_PATHS,
      LOCALIZED_OUTPUT_PATHS:
        totals.LOCALIZED_OUTPUT_PATHS + parity.counts.LOCALIZED_OUTPUT_PATHS,
      APPLIED_PRESENTATION_PATHS:
        totals.APPLIED_PRESENTATION_PATHS + parity.counts.APPLIED_PRESENTATION_PATHS,
      RENDERED_WITHOUT_SOURCE:
        totals.RENDERED_WITHOUT_SOURCE + parity.counts.RENDERED_WITHOUT_SOURCE,
      SOURCE_WITHOUT_BUILD:
        totals.SOURCE_WITHOUT_BUILD + parity.counts.SOURCE_WITHOUT_BUILD,
      BUILD_WITHOUT_OUTPUT:
        totals.BUILD_WITHOUT_OUTPUT + parity.counts.BUILD_WITHOUT_OUTPUT,
      OUTPUT_WITHOUT_APPLY:
        totals.OUTPUT_WITHOUT_APPLY + parity.counts.OUTPUT_WITHOUT_APPLY,
      APPLY_WITHOUT_RENDER:
        totals.APPLY_WITHOUT_RENDER + parity.counts.APPLY_WITHOUT_RENDER,
      CANONICAL_RENDER_BYPASS:
        totals.CANONICAL_RENDER_BYPASS + parity.counts.CANONICAL_RENDER_BYPASS,
      STRUCTURAL_MISMATCH_COUNT:
        totals.STRUCTURAL_MISMATCH_COUNT + parity.counts.STRUCTURAL_MISMATCH_COUNT,
    };
  }

  // Optional expected UI keys that never rendered (strict opt-in only).
  if (input.strictUiDictionaryKeys === true && input.uiDictionaryKeysExpected) {
    for (const key of input.uiDictionaryKeysExpected) {
      const hit = nodes.some((n) => n.messageKey === key);
      if (!hit) {
        reasons.add("UI_DICTIONARY_KEY_MISSING");
        failingPaths.push(key);
        totals.STRUCTURAL_MISMATCH_COUNT += 1;
      }
    }
  }

  return {
    ...totals,
    STRUCTURAL_INTEGRITY_STATUS:
      totals.STRUCTURAL_MISMATCH_COUNT === 0 ? "PASSED" : "FAILED",
    STRUCTURAL_INTEGRITY_VERSION: "LSI.1",
    reasons: [...reasons],
    failingPaths: [...new Set(failingPaths)],
  };
}

/** Helper: collect string paths present in a presentation object (AUTO leaves). */
export function collectPresentationStringPaths(
  node: unknown,
  prefix = "",
): string[] {
  if (node === null || node === undefined) {
    return [];
  }
  if (typeof node === "string") {
    return prefix ? [prefix] : [];
  }
  if (Array.isArray(node)) {
    const out: string[] = [];
    node.forEach((entry, index) => {
      const next = prefix ? `${prefix}[${index}]` : `[${index}]`;
      out.push(...collectPresentationStringPaths(entry, next));
    });
    return out;
  }
  if (typeof node === "object") {
    // Skip protected wrappers ({ __publicProtected, value, category })
    const obj = node as Record<string, unknown>;
    if (obj.__publicProtected === true || obj.category === "identity" || obj.category === "technical") {
      return [];
    }
    const out: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const next = prefix ? `${prefix}.${key}` : key;
      out.push(...collectPresentationStringPaths(value, next));
    }
    return out;
  }
  return [];
}

export function formatMediaStructuralIntegrityReport(
  report: MediaStructuralCardinality,
): string {
  return [
    `STRUCTURAL_INTEGRITY_VERSION=${report.STRUCTURAL_INTEGRITY_VERSION}`,
    `STRUCTURAL_INTEGRITY_STATUS=${report.STRUCTURAL_INTEGRITY_STATUS}`,
    `RENDERED_PATH_COUNT=${report.RENDERED_TRANSLATABLE_PATHS}`,
    `SOURCE_PATH_COUNT=${report.CANONICAL_SOURCE_PATHS}`,
    `BUILD_PATH_COUNT=${report.BUILD_INPUT_PATHS}`,
    `OUTPUT_PATH_COUNT=${report.LOCALIZED_OUTPUT_PATHS}`,
    `APPLIED_PATH_COUNT=${report.APPLIED_PRESENTATION_PATHS}`,
    `STRUCTURAL_MISMATCH_COUNT=${report.STRUCTURAL_MISMATCH_COUNT}`,
    `STRUCTURAL_INTEGRITY_REASON=${report.reasons[0] ?? "OK"}`,
  ].join(" ");
}

export type { MediaSemanticNodeRecord };
