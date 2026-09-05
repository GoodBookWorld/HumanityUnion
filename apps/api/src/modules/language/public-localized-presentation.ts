/**
 * Pack 08K — PublicLocalizedPresentation engine (API).
 *
 * Plain strings are AUTO_TRANSLATABLE. Protection is explicit wrappers only —
 * never inferred from property names.
 */

import { createHash } from "node:crypto";

import type {
  PublicLocalizedPresentation,
  PublicLocalizedPresentationCoverage,
  PublicLocalizationCoverageStatus,
  PublicPresentationIdentity,
  PublicPresentationNode,
} from "@hu/types";
import {
  PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  isPublicProtectedValue,
} from "@hu/types";

export type PublicAutoTranslatableNode = { path: string; value: string };

function isPlainObject(value: unknown): value is Record<string, PublicPresentationNode> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectInto(
  tree: PublicPresentationNode,
  keyPath: string,
  out: PublicAutoTranslatableNode[],
): void {
  if (tree === null || tree === undefined) {
    return;
  }
  if (typeof tree === "string") {
    if (keyPath && tree.trim()) {
      out.push({ path: keyPath, value: tree });
    }
    return;
  }
  if (isPublicProtectedValue(tree)) {
    return;
  }
  if (Array.isArray(tree)) {
    tree.forEach((entry, index) => {
      collectInto(entry, keyPath ? `${keyPath}[${index}]` : `[${index}]`, out);
    });
    return;
  }
  if (isPlainObject(tree)) {
    for (const [key, value] of Object.entries(tree)) {
      collectInto(value, keyPath ? `${keyPath}.${key}` : key, out);
    }
  }
}

/** Collect AUTO_TRANSLATABLE string paths (plain strings only). */
export function collectAutoTranslatableNodes(
  tree: PublicPresentationNode,
): Array<{ path: string; value: string }> {
  const out: PublicAutoTranslatableNode[] = [];
  collectInto(tree, "", out);
  return out;
}

/** Fingerprint of all auto-translatable values for sourceVersion. */
export function fingerprintPublicPresentation(tree: PublicPresentationNode): string {
  const material = JSON.stringify(collectAutoTranslatableNodes(tree));
  const hash = createHash("sha256").update(material).digest("hex").slice(0, 16);
  return `v-${hash}`;
}

/** Apply translated path→string map onto tree; preserve protected wrappers byte-identical. */
export function applyPublicPresentationTranslations(
  tree: PublicPresentationNode,
  translations: Readonly<Record<string, string>>,
  keyPath = "",
): PublicPresentationNode {
  if (tree === null || tree === undefined) {
    return tree;
  }
  if (isPublicProtectedValue(tree)) {
    return tree;
  }
  if (typeof tree === "string") {
    if (keyPath && Object.prototype.hasOwnProperty.call(translations, keyPath)) {
      const next = translations[keyPath];
      if (typeof next === "string" && next.trim()) {
        return next;
      }
    }
    return tree;
  }
  if (Array.isArray(tree)) {
    return tree.map((entry, index) =>
      applyPublicPresentationTranslations(
        entry,
        translations,
        keyPath ? `${keyPath}[${index}]` : `[${index}]`,
      ),
    );
  }
  if (isPlainObject(tree)) {
    const next: Record<string, PublicPresentationNode> = {};
    for (const [key, value] of Object.entries(tree)) {
      next[key] = applyPublicPresentationTranslations(
        value,
        translations,
        keyPath ? `${keyPath}.${key}` : key,
      );
    }
    return next;
  }
  return tree;
}

function toStalePathSet(
  stalePaths?: ReadonlySet<string> | readonly string[],
): ReadonlySet<string> {
  if (!stalePaths) {
    return new Set();
  }
  if (stalePaths instanceof Set) {
    return stalePaths;
  }
  return new Set(stalePaths);
}

function countProtectedNodes(tree: PublicPresentationNode): number {
  if (tree === null || tree === undefined) {
    return 0;
  }
  if (typeof tree === "string") {
    return 0;
  }
  if (isPublicProtectedValue(tree)) {
    return 1;
  }
  if (Array.isArray(tree)) {
    return tree.reduce((sum, entry) => sum + countProtectedNodes(entry), 0);
  }
  if (isPlainObject(tree)) {
    return Object.values(tree).reduce((sum, value) => sum + countProtectedNodes(value), 0);
  }
  return 0;
}

function resolveCoverageStatus(input: {
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly canonicalFallbackNodeCount: number;
  readonly staleNodeCount: number;
}): PublicLocalizationCoverageStatus {
  if (input.sourceLanguage === input.targetLanguage) {
    return "SOURCE_LANGUAGE";
  }
  if (input.staleNodeCount > 0) {
    return "STALE";
  }
  if (input.canonicalFallbackNodeCount > 0) {
    return "FALLBACK_CANONICAL";
  }
  return "COMPLETE";
}

/**
 * Build PublicLocalizedPresentation.
 * - sourceLanguage === targetLanguage → SOURCE_LANGUAGE, COMPLETE-equivalent coverage
 * - For each auto node: if translations[path] present and non-empty → localized
 * - missing → canonical fallback
 * - COMPLETE only if canonicalFallbackNodeCount===0 && staleNodeCount===0
 * - STALE if any stale paths used; NEVER count stale as COMPLETE
 * - Do not use property-name heuristics for protection
 */
export function localizePublicPresentation(input: {
  identity: PublicPresentationIdentity;
  sourceLanguage: string;
  targetLanguage: string;
  presentation: PublicPresentationNode;
  translations?: Readonly<Record<string, string>>;
  stalePaths?: ReadonlySet<string> | readonly string[];
  isMachineTranslated?: boolean;
}): PublicLocalizedPresentation {
  const translations = input.translations ?? {};
  const stalePathSet = toStalePathSet(input.stalePaths);
  const autoNodes = collectAutoTranslatableNodes(input.presentation);
  const sourceVersion = fingerprintPublicPresentation(input.presentation);
  const identity: PublicPresentationIdentity = {
    ...input.identity,
    presentationSchemaVersion:
      input.identity.presentationSchemaVersion || PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  };

  if (input.sourceLanguage === input.targetLanguage) {
    const coverage: PublicLocalizedPresentationCoverage = {
      status: "SOURCE_LANGUAGE",
      semanticNodeCount: autoNodes.length,
      localizedNodeCount: autoNodes.length,
      canonicalFallbackNodeCount: 0,
      protectedNodeCount: countProtectedNodes(input.presentation),
      staleNodeCount: 0,
      canonicalFallbackPaths: [],
    };
    return {
      identity,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      sourceVersion,
      presentation: input.presentation,
      coverage,
      isMachineTranslated: false,
      canViewOriginal: false,
    };
  }

  const canonicalFallbackPaths: string[] = [];
  let localizedNodeCount = 0;
  let staleNodeCount = 0;
  const applied: Record<string, string> = {};

  for (const node of autoNodes) {
    const translated = translations[node.path];
    if (typeof translated === "string" && translated.trim()) {
      applied[node.path] = translated;
      localizedNodeCount += 1;
      if (stalePathSet.has(node.path)) {
        staleNodeCount += 1;
      }
    } else {
      canonicalFallbackPaths.push(node.path);
    }
  }

  const canonicalFallbackNodeCount = canonicalFallbackPaths.length;
  const coverage: PublicLocalizedPresentationCoverage = {
    status: resolveCoverageStatus({
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      canonicalFallbackNodeCount,
      staleNodeCount,
    }),
    semanticNodeCount: autoNodes.length,
    localizedNodeCount,
    canonicalFallbackNodeCount,
    protectedNodeCount: countProtectedNodes(input.presentation),
    staleNodeCount,
    canonicalFallbackPaths,
  };

  return {
    identity,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    sourceVersion,
    presentation: applyPublicPresentationTranslations(input.presentation, applied),
    coverage,
    isMachineTranslated:
      input.isMachineTranslated ?? (localizedNodeCount > 0 && staleNodeCount === 0),
    canViewOriginal: true,
  };
}

/**
 * ensureLocalizedPublicPresentation — ONE entry point.
 * Async version that can accept a resolveTranslations callback.
 * For fixtures/tests with a translation map already in hand, call
 * localizePublicPresentation directly (sync).
 */
export async function ensureLocalizedPublicPresentation(input: {
  identity: PublicPresentationIdentity;
  sourceLanguage: string;
  targetLanguage: string;
  presentation: PublicPresentationNode;
  /** Returns CURRENT path translations for identity+sourceVersion+locale; null if missing */
  loadTranslations?: (args: {
    identity: PublicPresentationIdentity;
    sourceVersion: string;
    targetLanguage: string;
    autoNodes: ReadonlyArray<{ path: string; value: string }>;
  }) => Promise<{
    translations: Record<string, string>;
    stale?: boolean;
  } | null>;
  /** Schedule bounded warm for missing — fire-and-forget; never awaits Gemini */
  scheduleMissing?: (args: {
    identity: PublicPresentationIdentity;
    sourceVersion: string;
    targetLanguage: string;
    missingPaths: readonly string[];
  }) => void;
}): Promise<PublicLocalizedPresentation> {
  const autoNodes = collectAutoTranslatableNodes(input.presentation);
  const sourceVersion = fingerprintPublicPresentation(input.presentation);
  const identity: PublicPresentationIdentity = {
    ...input.identity,
    presentationSchemaVersion:
      input.identity.presentationSchemaVersion || PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  };

  if (input.sourceLanguage === input.targetLanguage) {
    return localizePublicPresentation({
      identity,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      presentation: input.presentation,
    });
  }

  let translations: Record<string, string> = {};
  let stale = false;

  if (input.loadTranslations) {
    const loaded = await input.loadTranslations({
      identity,
      sourceVersion,
      targetLanguage: input.targetLanguage,
      autoNodes,
    });
    if (loaded) {
      translations = loaded.translations;
      stale = loaded.stale === true;
    }
  }

  const missingPaths = autoNodes
    .filter((node) => {
      const value = translations[node.path];
      return !(typeof value === "string" && value.trim());
    })
    .map((node) => node.path);

  if (missingPaths.length > 0 && input.scheduleMissing) {
    input.scheduleMissing({
      identity,
      sourceVersion,
      targetLanguage: input.targetLanguage,
      missingPaths,
    });
  }

  const stalePaths = stale
    ? autoNodes
        .filter((node) => {
          const value = translations[node.path];
          return typeof value === "string" && value.trim();
        })
        .map((node) => node.path)
    : undefined;

  return localizePublicPresentation({
    identity,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    presentation: input.presentation,
    translations,
    stalePaths,
    isMachineTranslated: Object.keys(translations).length > 0 && !stale,
  });
}
