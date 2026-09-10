/**
 * Closure 07 — WEB_UI catalog readiness for one Registry locale (API-side).
 * Mirrors Closure 06 readiness semantics against bundled message packs.
 * Registry/fixture-driven locales — no hardcoded production allowlist.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { LanguageWebUiReadinessSlice } from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));
// apps/api/src/modules/language/language-localization-activation → apps/web/.../messages
const MESSAGES_DIR = path.resolve(
  here,
  "../../../../../web/src/features/i18n/messages",
);

type MessagePack = Record<string, unknown>;

const PUBLIC_CHROME_PREFIXES = [
  "common.",
  "navigation.",
  "actuc.",
  "membershipPublic.",
  "institutionsPublic.",
  "publicHome.",
  "blogPublic.",
  "knowledgePublic.",
  "civicMediaPublic.",
  "volunteerPublic.",
  "contactPublic.",
  "legalPublic.",
  "initiativeExperience.",
] as const;

function loadMessagePack(locale: string): MessagePack | null {
  try {
    return JSON.parse(
      readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8"),
    ) as MessagePack;
  } catch {
    return null;
  }
}

function collectStringPaths(messages: MessagePack, prefix = ""): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(messages)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      paths.push(pathKey);
      continue;
    }
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...collectStringPaths(value as MessagePack, pathKey));
    }
  }
  return paths;
}

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

/**
 * Assess required public WEB_UI chrome for a target locale.
 * Missing bundled catalog ⇒ not data-ready (honest).
 */
export function assessWebUiCatalogReadinessForLocale(input: {
  readonly locale: string;
  readonly englishLocale?: string;
  readonly requiredPaths?: readonly string[];
  readonly flagEnglishIdenticalAsFallback?: boolean;
}): LanguageWebUiReadinessSlice {
  const englishLocale = input.englishLocale ?? "en";
  const english = loadMessagePack(englishLocale);
  if (!english) {
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

  const target = loadMessagePack(input.locale);
  const requiredPaths =
    input.requiredPaths ??
    collectStringPaths(english).filter((pathKey) =>
      PUBLIC_CHROME_PREFIXES.some(
        (prefix) =>
          pathKey === prefix.slice(0, -1) || pathKey.startsWith(prefix),
      ),
    );

  if (!target) {
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
