/**
 * Step 13A — public-reader WEB_UI readiness is one locale-independent contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import {
  deriveLanguageLocalizationReadinessState,
  emptyLanguageLocalizationCountBucket,
  isPublicReaderWebUiRequiredPath,
  PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES,
} from "@hu/types";

import { assessWebUiCatalogReadinessForLocale } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
  collectStringPaths,
  loadBundledEnglishWebUiMessagePack,
  loadBundledWebUiMessagePackFromFs,
  validateWebUiMessageTreeAgainstEnglish,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../../..");

const PREVIOUS_PUBLIC_CHROME_PREFIXES = [
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

function matchesPrefix(pathKey: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathKey === prefix.slice(0, -1) || pathKey.startsWith(prefix),
  );
}

function readPath(messages: Record<string, unknown>, dottedPath: string): unknown {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function projectPaths(
  english: Record<string, unknown>,
  paths: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const pathKey of paths) {
    const value = readPath(english, pathKey);
    const segments = pathKey.split(".");
    let cursor: Record<string, unknown> = out;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]!;
      const next = cursor[segment];
      if (next == null || typeof next !== "object" || Array.isArray(next)) {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1]!] = value;
  }
  return out;
}

describe("public-reader WEB_UI readiness scope", () => {
  beforeEach(() => {
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
  });

  it("keeps one locale-independent required-scope contract", () => {
    const scope = readFileSync(
      join(repoRoot, "packages/types/src/domain/public-reader-web-ui-scope.ts"),
      "utf8",
    );
    const assess = readFileSync(
      join(
        repoRoot,
        "apps/api/src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.ts",
      ),
      "utf8",
    );
    const web = readFileSync(
      join(repoRoot, "apps/web/src/features/language/public-catalog-readiness.ts"),
      "utf8",
    );
    assert.match(assess, /isPublicReaderWebUiRequiredPath/);
    assert.doesNotMatch(assess, /PUBLIC_CHROME_PREFIXES/);
    assert.match(web, /PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES/);
    for (const src of [scope, assess, web]) {
      assert.doesNotMatch(src, /\blocale\s*===?\s*["'](?:ka|he)["']/);
      assert.doesNotMatch(src, /\b(?:ka|he)\.json\b/);
    }
    assert.ok(PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES.length > 10);
    assert.equal(
      PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES.some((prefix) => prefix === "initiativeExperience."),
      false,
    );
  });

  it("requires public reader keys and excludes author/steward workspace keys", () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const all = collectStringPaths(english);
    const previous = all.filter((pathKey) =>
      matchesPrefix(pathKey, PREVIOUS_PUBLIC_CHROME_PREFIXES),
    );
    const required = all.filter((pathKey) => isPublicReaderWebUiRequiredPath(pathKey));

    assert.ok(required.includes("navigation.home"));
    assert.ok(
      required.some((pathKey) => pathKey.startsWith("initiativeExperience.sidebar.")),
    );
    assert.ok(
      required.some((pathKey) =>
        pathKey.startsWith("initiativeExperience.author.collectiveDecision.public."),
      ),
    );
    assert.ok(
      required.some((pathKey) => pathKey.startsWith("initiativeExperience.author.petition.fields.")),
    );
    assert.equal(
      required.some((pathKey) => pathKey.startsWith("initiativeExperience.author.sidebar.")),
      false,
    );
    assert.equal(
      required.some((pathKey) => pathKey.startsWith("initiativeExperience.manage.")),
      false,
    );
    assert.equal(
      required.some((pathKey) => pathKey.startsWith("initiativeExperience.author.actions.")),
      false,
    );
    assert.ok(previous.length > required.length);
    assert.ok(previous.some((pathKey) => pathKey.startsWith("initiativeExperience.author.sidebar.")));
  });

  it("keeps excluded keys valid in the English catalog and in full packs", () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const englishReport = validateWebUiMessageTreeAgainstEnglish(english as never);
    assert.equal(englishReport.rejectedUnknownPaths.length, 0);

    const authorOnly = validateWebUiMessageTreeAgainstEnglish({
      initiativeExperience: {
        author: {
          sidebar: {
            assistantTitle: "Author sidebar",
          },
        },
        manage: {
          title: "Manage",
        },
      },
    } as never);
    assert.equal(authorOnly.rejectedUnknownPaths.length, 0);
    assert.ok(authorOnly.acceptedKeyCount >= 2);

    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const pack = loadBundledWebUiMessagePackFromFs(locale);
      assert.ok(pack, locale);
      const report = validateWebUiMessageTreeAgainstEnglish(pack as never);
      assert.equal(report.rejectedUnknownPaths.length, 0, locale);
    }
  });

  it("lets an arbitrary future locale satisfy public readiness without author keys", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const required = collectStringPaths(english).filter((pathKey) =>
      isPublicReaderWebUiRequiredPath(pathKey),
    );
    const publicOnly = projectPaths(english, required);
    await upsertWebUiMessagePack({
      locale: "eo",
      status: "published",
      messages: publicOnly as never,
      sourceNote: "public-reader fixture",
    });

    const ready = await assessWebUiCatalogReadinessForLocale({ locale: "eo" });
    assert.equal(ready.dataReady, true);
    assert.equal(ready.missingKeyCount, 0);
    assert.equal(ready.requiredKeyCount, required.length);

    const withoutAuthor = readPath(
      publicOnly,
      "initiativeExperience.author.sidebar.assistantTitle",
    );
    assert.equal(withoutAuthor, undefined);

    delete (publicOnly.navigation as { home?: string }).home;
    await upsertWebUiMessagePack({
      locale: "eo",
      status: "published",
      messages: publicOnly as never,
    });
    const missingPublic = await assessWebUiCatalogReadinessForLocale({ locale: "eo" });
    assert.equal(missingPublic.dataReady, false);
    assert.ok(missingPublic.missingKeyCount >= 1);
    assert.ok(missingPublic.sampleMissingPaths.includes("navigation.home"));
  });

  it("uses the same required count for ka, he, and any other locale with no pack", async () => {
    const ka = await assessWebUiCatalogReadinessForLocale({ locale: "ka" });
    const he = await assessWebUiCatalogReadinessForLocale({ locale: "he" });
    const eo = await assessWebUiCatalogReadinessForLocale({ locale: "eo" });
    assert.equal(ka.dataReady, false);
    assert.equal(he.dataReady, false);
    assert.equal(ka.requiredKeyCount, he.requiredKeyCount);
    assert.equal(he.requiredKeyCount, eo.requiredKeyCount);
    assert.equal(ka.missingKeyCount, ka.requiredKeyCount);
    assert.ok(ka.requiredKeyCount > 0);
  });

  it("keeps bundled en, uk, ar, and zh-Hant public-reader ready", async () => {
    for (const locale of ["en", "uk", "ar", "zh-Hant"] as const) {
      const readiness = await assessWebUiCatalogReadinessForLocale({ locale });
      assert.equal(readiness.dataReady, true, locale);
      assert.equal(readiness.missingKeyCount, 0, locale);
    }
  });

  it("does not change the non-WEB_UI readiness gate", () => {
    const empty = emptyLanguageLocalizationCountBucket();
    const base = {
      enabled: true,
      contentTranslationEnabled: true,
      controlledVocabularyPresentationReady: true,
      ct: empty,
      plpMedia: empty,
    };
    assert.equal(
      deriveLanguageLocalizationReadinessState({ ...base, webUiDataReady: false }),
      "DATA_NOT_READY",
    );
    assert.equal(
      deriveLanguageLocalizationReadinessState({ ...base, webUiDataReady: true }),
      "READY",
    );
  });
});
