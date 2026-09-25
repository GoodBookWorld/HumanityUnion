/**
 * Closure 07 / Step 15D.2 — WEB_UI catalog readiness for one Registry locale (API-side).
 * Uses the same effective pack source as runtime (bundled FS → published remote).
 * Registry/fixture-driven locales — no hardcoded production allowlist.
 */

import {
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
  type LanguageWebUiReadinessSlice,
  type WebUiMessageTree,
} from "@hu/types";

import { resolveEffectiveWebUiMessagePack } from "../../web-ui-message-packs/resolve-effective-web-ui-message-pack.js";
import {
  collectStringPaths,
  loadBundledEnglishWebUiMessagePack,
} from "../../web-ui-message-packs/web-ui-message-pack.validate.js";

type MessagePack = Record<string, unknown>;

function readPathValue(messages: MessagePack, dottedPath: string): unknown {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export type WebUiCatalogReadinessScope = "public" | "participant";

/**
 * Assess a concrete WEB_UI message tree against the English foundation (no pack resolve).
 * Used by packaged-catalog adoption and published-authority checks.
 */
export function assessWebUiMessageTreeReadiness(input: {
  readonly messages: WebUiMessageTree;
  readonly requiredPaths?: readonly string[];
  readonly flagEnglishIdenticalAsFallback?: boolean;
  readonly scope?: WebUiCatalogReadinessScope;
}): LanguageWebUiReadinessSlice {
  let english: MessagePack;
  try {
    english = loadBundledEnglishWebUiMessagePack();
  } catch {
    return {
      engineReady: true,
      dataReady: false,
      requiredKeyCount: 0,
      missingKeyCount: 1,
      emptyKeyCount: 0,
      englishFallbackKeyCount: 0,
      sampleMissingPaths: ["(english foundation catalog missing)"],
    };
  }

  const pathPredicate =
    input.scope === "participant"
      ? isParticipantWebUiRequiredPath
      : isPublicReaderWebUiRequiredPath;
  const requiredPaths =
    input.requiredPaths ??
    collectStringPaths(english).filter((pathKey) => pathPredicate(pathKey));

  const target = input.messages as MessagePack;
  const flagIdentical = input.flagEnglishIdenticalAsFallback ?? false;
  let missingKeyCount = 0;
  let emptyKeyCount = 0;
  let englishFallbackKeyCount = 0;
  const sampleMissingPaths: string[] = [];

  for (const pathKey of requiredPaths) {
    const englishValue = readPathValue(english, pathKey);
    const value = readPathValue(target, pathKey);
    if (value === undefined) {
      missingKeyCount += 1;
      if (sampleMissingPaths.length < 12) sampleMissingPaths.push(pathKey);
      continue;
    }
    if (typeof value !== "string") {
      missingKeyCount += 1;
      if (sampleMissingPaths.length < 12) sampleMissingPaths.push(pathKey);
      continue;
    }
    if (value.trim().length === 0) {
      emptyKeyCount += 1;
      if (sampleMissingPaths.length < 12) sampleMissingPaths.push(pathKey);
      continue;
    }
    if (
      flagIdentical &&
      typeof englishValue === "string" &&
      englishValue.trim().length > 0 &&
      value === englishValue
    ) {
      englishFallbackKeyCount += 1;
      if (sampleMissingPaths.length < 12) sampleMissingPaths.push(pathKey);
    }
  }

  return {
    engineReady: true,
    dataReady:
      missingKeyCount === 0 && emptyKeyCount === 0 && englishFallbackKeyCount === 0,
    requiredKeyCount: requiredPaths.length,
    missingKeyCount,
    emptyKeyCount,
    englishFallbackKeyCount,
    sampleMissingPaths,
  };
}

/**
 * Assess WEB_UI catalog readiness for a target locale.
 * Default scope is public-reader (`isPublicReaderWebUiRequiredPath`).
 * Participant scope uses `isParticipantWebUiRequiredPath` (Step 15D.2).
 */
export async function assessWebUiCatalogReadinessForLocale(input: {
  readonly locale: string;
  readonly englishLocale?: string;
  readonly requiredPaths?: readonly string[];
  readonly flagEnglishIdenticalAsFallback?: boolean;
  readonly scope?: WebUiCatalogReadinessScope;
}): Promise<LanguageWebUiReadinessSlice> {
  const englishLocale = input.englishLocale ?? "en";
  if (englishLocale !== "en") {
    let english: MessagePack;
    try {
      english =
        ((await resolveEffectiveWebUiMessagePack(englishLocale))?.messages as MessagePack) ??
        loadBundledEnglishWebUiMessagePack();
    } catch {
      return {
        engineReady: true,
        dataReady: false,
        requiredKeyCount: 0,
        missingKeyCount: 1,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 0,
        sampleMissingPaths: ["(english foundation catalog missing)"],
      };
    }
    const pathPredicate =
      input.scope === "participant"
        ? isParticipantWebUiRequiredPath
        : isPublicReaderWebUiRequiredPath;
    const requiredPaths =
      input.requiredPaths ??
      collectStringPaths(english).filter((pathKey) => pathPredicate(pathKey));
    const effective = await resolveEffectiveWebUiMessagePack(input.locale);
    if (!effective) {
      return {
        engineReady: true,
        dataReady: false,
        requiredKeyCount: requiredPaths.length,
        missingKeyCount: requiredPaths.length,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 0,
        sampleMissingPaths: requiredPaths.slice(0, 12),
      };
    }
    return assessWebUiMessageTreeReadiness({
      messages: effective.messages,
      requiredPaths,
      flagEnglishIdenticalAsFallback: input.flagEnglishIdenticalAsFallback,
      scope: input.scope,
    });
  }

  const effective = await resolveEffectiveWebUiMessagePack(input.locale);
  if (!effective) {
    let requiredKeyCount = 0;
    try {
      const english = loadBundledEnglishWebUiMessagePack();
      const pathPredicate =
        input.scope === "participant"
          ? isParticipantWebUiRequiredPath
          : isPublicReaderWebUiRequiredPath;
      requiredKeyCount = (
        input.requiredPaths ??
        collectStringPaths(english).filter((pathKey) => pathPredicate(pathKey))
      ).length;
    } catch {
      requiredKeyCount = 0;
    }
    return {
      engineReady: true,
      dataReady: false,
      requiredKeyCount,
      missingKeyCount: Math.max(requiredKeyCount, 1),
      emptyKeyCount: 0,
      englishFallbackKeyCount: 0,
      sampleMissingPaths:
        requiredKeyCount > 0 ? ["(no effective WEB_UI pack)"] : ["(english foundation catalog missing)"],
    };
  }

  return assessWebUiMessageTreeReadiness({
    messages: effective.messages,
    requiredPaths: input.requiredPaths,
    flagEnglishIdenticalAsFallback: input.flagEnglishIdenticalAsFallback,
    scope: input.scope,
  });
}

/** Convenience: Participant WEB_UI readiness for one locale. */
export async function assessParticipantWebUiCatalogReadinessForLocale(input: {
  readonly locale: string;
  readonly englishLocale?: string;
  readonly requiredPaths?: readonly string[];
  readonly flagEnglishIdenticalAsFallback?: boolean;
}): Promise<LanguageWebUiReadinessSlice> {
  return assessWebUiCatalogReadinessForLocale({ ...input, scope: "participant" });
}
