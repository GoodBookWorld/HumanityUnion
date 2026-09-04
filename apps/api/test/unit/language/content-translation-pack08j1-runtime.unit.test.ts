/**
 * Pack 08J.1 — API: stale CURRENT consumption + recovery discovery + scheduling proofs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolveTranslatedDisplay,
  resolveStructuredTranslatedDisplay,
} from "../../../src/modules/language/index.js";
import { CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS } from "../../../src/modules/language/content-translation-staging-warm-backfill.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readApi(relative: string): string {
  return readFileSync(path.resolve(here, "../../../", relative), "utf8");
}

describe("Pack 08J.1 — stale CURRENT consumption", () => {
  it("4–6. preferred stale translation is presented (not English reversion)", () => {
    const resolved = resolveTranslatedDisplay({
      originalContent: "Hello EN",
      originalLanguage: "en",
      preferredReadingLanguage: "uk",
      translationPreference: "preferred",
      translations: [
        {
          translationId: "t1",
          sourceKind: "collaborative_analysis",
          sourceRecordId: "ca-1",
          sourceVersion: "v-old",
          sourceLanguage: "en",
          targetLanguage: "uk",
          translatedContent: "Привіт UK",
          translationProvider: "deterministic",
          translationKind: "machine",
          createdAt: "2026-01-01T00:00:00.000Z",
          stale: true,
          freshness: "stale",
        },
      ],
    });
    assert.equal(resolved.presentationMode, "preferred_translation");
    assert.equal(resolved.content, "Привіт UK");
    assert.equal(resolved.activeLanguage, "uk");
    assert.equal(resolved.isStale, true);
  });

  it("structured bag applies new projection keys without allowlist gate", () => {
    const resolved = resolveStructuredTranslatedDisplay({
      originalFields: { title: "T", futureSemanticNote: "N" },
      originalLanguage: "en",
      preferredReadingLanguage: "uk",
      translationPreference: "preferred",
      translations: [
        {
          translationId: "t2",
          sourceKind: "initiative",
          sourceRecordId: "i-1",
          sourceVersion: "v-1",
          sourceLanguage: "en",
          targetLanguage: "uk",
          translatedContent: {
            title: "T-UK",
            futureSemanticNote: "N-UK",
          },
          translationProvider: "deterministic",
          translationKind: "machine",
          createdAt: "2026-01-01T00:00:00.000Z",
          stale: false,
          freshness: "current",
        },
      ],
    });
    assert.equal(resolved.content.title, "T-UK");
    assert.equal(resolved.content.futureSemanticNote, "N-UK");
  });
});

describe("Pack 08J.1 — recovery discovery + scheduling", () => {
  it("19. recovery kinds include blog_post and civic_media", () => {
    assert.ok(CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS.includes("blog_post"));
    assert.ok(CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS.includes("civic_media"));
    assert.ok(CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS.includes("collaborative_analysis"));
  });

  it("20. recovery CLI exits deterministically", () => {
    const script = readApi("src/scripts/warm-staging-content-translations.ts");
    assert.match(script, /process\.exit\(process\.exitCode \?\? 0\)/);
  });

  it("H. mutation scheduling covers blog + lifecycle; civic_media discoverable", () => {
    const blog = readApi("src/modules/blog/blog.service.ts");
    assert.match(blog, /scheduleContentTranslationWarmAfterMutation/);
    assert.match(blog, /sourceKind:\s*["']blog_post["']/);

    const comment = readApi("src/modules/initiative-comments/initiative-comment.service.ts");
    assert.match(comment, /scheduleContentTranslationWarmAfterMutation/);

    const loader = readApi("src/modules/language/content-translation-civic-loaders.ts");
    assert.match(loader, /trustedMediaExplanations/);
    assert.match(loader, /discoverCivicMediaTranslationRecordIds/);

    const backfill = readApi("src/modules/language/content-translation-staging-warm-backfill.ts");
    assert.match(backfill, /blog_post/);
    assert.match(backfill, /civic_media/);
  });

  it("21–22. worker concurrency + private policy preserved", () => {
    const worker = readApi("src/modules/language/content-translation-worker-concurrency.ts");
    assert.match(worker, /DEFAULT_WORKER_CONCURRENCY = 1/);
    const policy = readApi("src/modules/language/non-translatable-policy.ts");
    assert.match(policy, /stripNonTranslatableKeys|assertSafeForAutomaticTranslation/);
  });
});
