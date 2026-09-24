/**
 * Step 15D.5.1 — MyPublicationsTable ordinary Participant Publishing chrome.
 * Deterministic. No Gemini. No staging writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isParticipantWebUiRequiredPath } from "@hu/types";

import { assessWebUiCatalogReadinessForLocale } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  collectStringPaths,
  loadBundledEnglishWebUiMessagePack,
  loadBundledWebUiMessagePackFromFs,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../../..");
const webSrc = join(repoRoot, "apps/web/src");

function readWeb(rel: string): string {
  return readFileSync(join(webSrc, rel), "utf8");
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
  transform?: (value: string) => string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const pathKey of paths) {
    const value = readPath(english, pathKey);
    if (typeof value !== "string") {
      continue;
    }
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
    cursor[segments[segments.length - 1]!] = transform ? transform(value) : value;
  }
  return out;
}

describe("Step 15D.5.1 — MyPublicationsTable Participant Publishing chrome", () => {
  beforeEach(() => {
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
  });

  afterEach(() => {
    resetWebUiMessagePackStoreForTests();
  });

  it("1 ordinary MyPublicationsTable chrome has no hardcoded English", () => {
    const src = readWeb("features/blog/components/MyPublicationsTable.tsx");
    assert.match(src, /useTranslations\("workspace\.publishingPage"\)/);
    assert.match(src, /t\("myPublications\.title"\)/);
    assert.match(src, /t\("actions\.edit"\)/);
    assert.match(src, /resolvePublishingListStatusLabel/);
    assert.match(src, /resolveBlogCategoryDisplayName/);
    assert.match(src, /useLocale\(\)/);
    assert.match(src, /formatCompactDate\([^,]+, locale\)/);
    assert.doesNotMatch(src, /["']My Publications["']/);
    assert.doesNotMatch(src, /["']Loading publications…["']/);
    assert.doesNotMatch(src, /["']Publish now["']/);
    assert.doesNotMatch(src, /["']Cancel schedule["']/);
    assert.doesNotMatch(src, /["']Start correction\?["']/);
    assert.doesNotMatch(src, /DateTimeFormat\("en"/);
    // Dynamic publication titles stay record-owned.
    assert.match(src, /\{post\.title\}/);
  });

  it("2–3 myPublications WEB_UI paths are Participant-required; editorial trees stay excluded", () => {
    assert.equal(
      isParticipantWebUiRequiredPath("workspace.publishingPage.myPublications.title"),
      true,
    );
    assert.equal(
      isParticipantWebUiRequiredPath("workspace.publishingPage.myPublications.columns.actions"),
      true,
    );
    assert.equal(
      isParticipantWebUiRequiredPath("workspace.publishingPage.actions.editCorrect"),
      true,
    );
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorialPage.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorialReview"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorPanel.title"), false);
  });

  it("4–5 dynamic titles stay out of WEB_UI; uk/ar/zh-Hant bundle myPublications", () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const myPaths = collectStringPaths(english).filter((pathKey) =>
      pathKey.startsWith("workspace.publishingPage.myPublications."),
    );
    assert.equal(myPaths.length, 20);
    assert.ok(myPaths.every((pathKey) => isParticipantWebUiRequiredPath(pathKey)));

    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const pack = loadBundledWebUiMessagePackFromFs(locale);
      assert.ok(pack, locale);
      const title = readPath(pack as never, "workspace.publishingPage.myPublications.title");
      assert.equal(typeof title, "string", locale);
      assert.notEqual(title, "My Publications", locale);
    }
  });

  it("6–7 remote pack missing myPublications is not Participant-ready; Admin 100% blocked", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const required = collectStringPaths(english).filter((pathKey) =>
      isParticipantWebUiRequiredPath(pathKey),
    );
    const withoutMyPublications = required.filter(
      (pathKey) => !pathKey.startsWith("workspace.publishingPage.myPublications."),
    );
    assert.ok(withoutMyPublications.length < required.length);

    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: projectPaths(english, withoutMyPublications, (value) => `[ka] ${value}`) as never,
      sourceNote: "participant pack missing myPublications",
    });
    const readiness = await assessWebUiCatalogReadinessForLocale({
      locale: "ka",
      scope: "participant",
    });
    assert.equal(readiness.dataReady, false);
    assert.equal(readiness.requiredKeyCount, required.length);
    assert.equal(readiness.missingKeyCount, required.length - withoutMyPublications.length);
    assert.ok(
      readiness.sampleMissingPaths.every((path) =>
        path.startsWith("workspace.publishingPage.myPublications."),
      ),
    );

    const progress = readWeb(
      "features/administration/admin-languages-localization-progress.ts",
    );
    assert.match(
      progress,
      /readiness\.webUi\.dataReady && readiness\.participantWebUi\.dataReady/,
    );
  });

  it("8–9 uk/ar/zh-Hant Participant readiness stays green with myPublications", async () => {
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const readiness = await assessWebUiCatalogReadinessForLocale({
        locale,
        scope: "participant",
      });
      assert.equal(readiness.dataReady, true, locale);
      assert.equal(readiness.missingKeyCount, 0, locale);
    }
  });
});
