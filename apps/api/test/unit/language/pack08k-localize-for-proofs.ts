/**
 * Pack 08K — test-only PublicLocalizedPresentation localize helper.
 *
 * Mirrors the contract of
 * `apps/api/src/modules/language/public-localized-presentation.ts`.
 * When that module lands, proof tests should swap to importing
 * `localizePublicPresentation` from the language module and delete this mirror
 * (or keep it only as a fallback).
 */

import { createHash } from "node:crypto";

import {
  PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  isPublicProtectedValue,
  type PublicLocalizedPresentation,
  type PublicPresentationIdentity,
  type PublicPresentationNode,
} from "@hu/types";

export function collectAutoTranslatableNodes(
  tree: PublicPresentationNode,
  path = "",
): Array<{ path: string; value: string }> {
  if (tree == null) {
    return [];
  }
  if (typeof tree === "string") {
    return path ? [{ path, value: tree }] : [];
  }
  if (isPublicProtectedValue(tree)) {
    return [];
  }
  if (Array.isArray(tree)) {
    const out: Array<{ path: string; value: string }> = [];
    tree.forEach((entry, index) => {
      const childPath = path ? `${path}[${index}]` : `[${index}]`;
      out.push(...collectAutoTranslatableNodes(entry, childPath));
    });
    return out;
  }
  if (typeof tree === "object") {
    const out: Array<{ path: string; value: string }> = [];
    for (const [key, value] of Object.entries(tree)) {
      const childPath = path ? `${path}.${key}` : key;
      out.push(...collectAutoTranslatableNodes(value as PublicPresentationNode, childPath));
    }
    return out;
  }
  return [];
}

export function fingerprintPublicPresentation(tree: PublicPresentationNode): string {
  const auto = collectAutoTranslatableNodes(tree);
  const payload = JSON.stringify(auto.map((n) => [n.path, n.value]));
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function readPathTranslation(
  translations: Readonly<Record<string, string>> | undefined,
  path: string,
): string | undefined {
  if (!translations) {
    return undefined;
  }
  const value = translations[path];
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  return value;
}

export function applyPublicPresentationTranslations(
  tree: PublicPresentationNode,
  translations: Readonly<Record<string, string>>,
  path = "",
): PublicPresentationNode {
  if (tree == null) {
    return tree;
  }
  if (typeof tree === "string") {
    if (!path) {
      return tree;
    }
    return readPathTranslation(translations, path) ?? tree;
  }
  if (isPublicProtectedValue(tree)) {
    // Preserve protected wrappers byte-identical (same object identity).
    return tree;
  }
  if (Array.isArray(tree)) {
    return tree.map((entry, index) => {
      const childPath = path ? `${path}[${index}]` : `[${index}]`;
      return applyPublicPresentationTranslations(entry, translations, childPath);
    });
  }
  if (typeof tree === "object") {
    const next: Record<string, PublicPresentationNode> = {};
    for (const [key, value] of Object.entries(tree)) {
      const childPath = path ? `${path}.${key}` : key;
      next[key] = applyPublicPresentationTranslations(
        value as PublicPresentationNode,
        translations,
        childPath,
      );
    }
    return next;
  }
  return tree;
}

function countProtectedNodes(tree: PublicPresentationNode): number {
  if (tree == null) {
    return 0;
  }
  if (isPublicProtectedValue(tree)) {
    return 1;
  }
  if (typeof tree === "string") {
    return 0;
  }
  if (Array.isArray(tree)) {
    return tree.reduce((sum, entry) => sum + countProtectedNodes(entry), 0);
  }
  if (typeof tree === "object") {
    return Object.values(tree).reduce(
      (sum, value) => sum + countProtectedNodes(value as PublicPresentationNode),
      0,
    );
  }
  return 0;
}

export function localizePublicPresentation(input: {
  identity: PublicPresentationIdentity;
  sourceLanguage: string;
  targetLanguage: string;
  presentation: PublicPresentationNode;
  translations?: Readonly<Record<string, string>>;
  stalePaths?: ReadonlySet<string> | readonly string[];
  isMachineTranslated?: boolean;
}): PublicLocalizedPresentation {
  const autoNodes = collectAutoTranslatableNodes(input.presentation);
  const staleSet =
    input.stalePaths == null
      ? new Set<string>()
      : input.stalePaths instanceof Set
        ? input.stalePaths
        : new Set(input.stalePaths);

  if (input.sourceLanguage === input.targetLanguage) {
    return {
      identity: input.identity,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      sourceVersion: fingerprintPublicPresentation(input.presentation),
      presentation: input.presentation,
      coverage: {
        status: "SOURCE_LANGUAGE",
        semanticNodeCount: autoNodes.length,
        localizedNodeCount: autoNodes.length,
        canonicalFallbackNodeCount: 0,
        protectedNodeCount: countProtectedNodes(input.presentation),
        staleNodeCount: 0,
        canonicalFallbackPaths: [],
      },
      isMachineTranslated: false,
      canViewOriginal: false,
    };
  }

  const fallbackPaths: string[] = [];
  let localizedNodeCount = 0;
  let staleNodeCount = 0;

  for (const node of autoNodes) {
    const translated = readPathTranslation(input.translations, node.path);
    if (translated != null) {
      localizedNodeCount += 1;
      if (staleSet.has(node.path)) {
        staleNodeCount += 1;
      }
    } else {
      fallbackPaths.push(node.path);
    }
  }

  let status: PublicLocalizedPresentation["coverage"]["status"];
  if (staleNodeCount > 0) {
    status = "STALE";
  } else if (fallbackPaths.length > 0) {
    status = "FALLBACK_CANONICAL";
  } else {
    status = "COMPLETE";
  }

  const localizedTree = applyPublicPresentationTranslations(
    input.presentation,
    input.translations ?? {},
  );

  return {
    identity: input.identity,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    sourceVersion: fingerprintPublicPresentation(input.presentation),
    presentation: localizedTree,
    coverage: {
      status,
      semanticNodeCount: autoNodes.length,
      localizedNodeCount,
      canonicalFallbackNodeCount: fallbackPaths.length,
      protectedNodeCount: countProtectedNodes(input.presentation),
      staleNodeCount,
      canonicalFallbackPaths: fallbackPaths,
    },
    isMachineTranslated: input.isMachineTranslated ?? true,
    canViewOriginal: true,
  };
}

export function buildPresentationIdentity(
  sourceKind: string,
  sourceRecordId: string,
): PublicPresentationIdentity {
  return {
    sourceKind,
    sourceRecordId,
    presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  };
}

/** Build a full path→translated map for every AUTO node (deterministic proof text). */
export function buildFullProofTranslations(
  tree: PublicPresentationNode,
  localeTag = "uk",
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of collectAutoTranslatableNodes(tree)) {
    out[node.path] = `[${localeTag}] ${node.value}`;
  }
  return out;
}
