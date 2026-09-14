/**
 * Pack 1.1 — Retire participant generate-on-read.
 * Public reads are cache-only; missing/stale → canonical; never POST /generate.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveLocalizedPresentation } from "./resolve-localized-presentation.js";
import { resolvePublicContentTranslationDisplay } from "./resolve-public-content-translation-display.js";
import { shouldAttemptOnDemandContentTranslation } from "./public-translation-presentation-lifecycle.js";
import { resolveBlogPostPresentation } from "../blog/resolve-blog-post-presentation.js";
import { resolveDiscussionCommentPresentation } from "../public-initiative-experience/resolve-discussion-comment-presentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const apiRoot = path.resolve(here, "../../../../api");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readApi(relative: string): string {
  return readFileSync(path.join(apiRoot, relative), "utf8");
}

const canonical = { title: "Title EN", summary: "Summary EN" };

describe("Pack 1.1 — retire participant generate-on-read", () => {
  it("A. CURRENT cache hit displays translation and never generates", async () => {
    const calls: string[] = [];
    const result = await resolveLocalizedPresentation({
      request: {
        sourceKind: "initiative",
        sourceRecordId: "init-1",
        displayLanguage: "uk",
        ready: true,
        translationPreference: "preferred",
        enableOnDemandGenerate: true,
      },
      canonicalFields: canonical,
      deps: {
        resolveTranslatedContent: async () => {
          calls.push("resolve");
          return {
            presentationMode: "preferred_translation",
            content: { title: "Заголовок UK", summary: "Опис UK" },
            activeLanguage: "uk",
            originalLanguage: "en",
            originalContent: canonical,
            translation: null,
            isMachineTranslated: true,
            isStale: false,
            canViewOriginal: true,
            canViewTranslation: false,
          };
        },
        generateContentTranslation: async () => {
          calls.push("generate");
          throw new Error("must not generate");
        },
      },
    });
    assert.deepEqual(calls, ["resolve"]);
    assert.equal(result.presentationMode, "preferred_translation");
    assert.equal(result.fields.title, "Заголовок UK");
  });

  it("B. Missing CT falls back to canonical and never generates", async () => {
    const calls: string[] = [];
    const result = await resolveLocalizedPresentation({
      request: {
        sourceKind: "petition",
        sourceRecordId: "p-1",
        displayLanguage: "uk",
        ready: true,
        translationPreference: "preferred",
        enableOnDemandGenerate: true,
      },
      canonicalFields: canonical,
      deps: {
        resolveTranslatedContent: async () => {
          calls.push("resolve");
          return {
            presentationMode: "original",
            content: canonical,
            activeLanguage: "en",
            originalLanguage: "en",
            originalContent: canonical,
            translation: null,
            isMachineTranslated: false,
            isStale: false,
            canViewOriginal: false,
            canViewTranslation: false,
          };
        },
        generateContentTranslation: async () => {
          calls.push("generate");
          throw new Error("must not generate");
        },
      },
    });
    assert.deepEqual(calls, ["resolve"]);
    assert.equal(result.presentationMode, "original");
    assert.equal(result.fields.title, "Title EN");
  });

  it("C. Stale CT falls back to canonical and never generates", async () => {
    const calls: string[] = [];
    const result = await resolvePublicContentTranslationDisplay({
      sourceKind: "initiative",
      sourceRecordId: "init-stale",
      readingContext: {
        ready: true,
        readingLanguage: "uk",
        translationPreference: "preferred",
      },
      deps: {
        resolveTranslatedContent: async () => {
          calls.push("resolve");
          return {
            presentationMode: "original",
            content: canonical,
            activeLanguage: "en",
            originalLanguage: "en",
            originalContent: canonical,
            translation: null,
            isMachineTranslated: false,
            isStale: true,
            canViewOriginal: false,
            canViewTranslation: false,
          };
        },
        generateContentTranslation: async () => {
          calls.push("generate");
          throw new Error("must not generate");
        },
      },
    });
    assert.deepEqual(calls, ["resolve"]);
    assert.equal(result?.presentationMode, "original");
    assert.equal(result?.isStale, true);
  });

  it("D–E. Language switch / hydration gate never attempts on-demand generate", () => {
    assert.equal(
      shouldAttemptOnDemandContentTranslation({
        ready: true,
        translationPreference: "preferred",
        readingLanguage: "uk",
        resolvePresentationMode: "original",
        originalLanguage: "en",
        isStale: false,
        isPartial: true,
      }),
      false,
    );
  });

  it("blog + discussion miss never call generate", async () => {
    const calls: Array<"resolve" | "generate"> = [];
    const deps = {
      resolveTranslatedContent: async () => {
        calls.push("resolve");
        return {
          presentationMode: "original" as const,
          content: { title: "EN", excerpt: "EN", content: "<p>EN</p>", body: "EN" },
          activeLanguage: "en" as const,
          originalLanguage: "en" as const,
          originalContent: { title: "EN", excerpt: "EN", content: "<p>EN</p>", body: "EN" },
          translation: null,
          isMachineTranslated: false,
          isStale: false,
          canViewOriginal: false,
          canViewTranslation: false,
        };
      },
      generateContentTranslation: async () => {
        calls.push("generate");
        throw new Error("must not generate");
      },
    };

    await resolveBlogPostPresentation(
      {
        postId: "blog-1",
        canonical: { title: "EN", excerpt: "EN", contentHtml: "<p>EN</p>" },
        displayLanguage: "uk",
        ready: true,
        translationPreference: "preferred",
      },
      deps,
    );
    await resolveDiscussionCommentPresentation(
      {
        commentId: "c-1",
        canonicalBody: "EN",
        displayLanguage: "uk",
        ready: true,
        translationPreference: "preferred",
      },
      deps,
    );
    assert.equal(calls.length > 0, true);
    assert.equal(
      calls.filter((c) => c === "generate").length,
      0,
    );
  });

  it("F. automatic_warm consumer path remains in API", () => {
    const warm = readApi("src/modules/language/content-translation-warm-consumer.ts");
    assert.match(warm, /automatic_warm/);
    assert.match(warm, /getOrCreateContentTranslation/);
  });

  it("POST /translations/generate is retired (410)", () => {
    const routes = readApi("src/modules/language/language.routes.ts");
    assert.match(routes, /status\(410\)/);
    assert.match(routes, /On-demand content translation is retired/);
    assert.doesNotMatch(routes, /generateIfMissing:\s*true/);
  });

  it("G. Brand / Legal / WEB_UI ownership not routed through CT generate", () => {
    const brand = readWeb("features/brand-localization/resolve-brand-for-metadata.ts");
    assert.doesNotMatch(brand, /generateContentTranslation|content_translations/);
    const legal = readWeb("features/legal/resolve-legal-document-presentation.ts");
    assert.doesNotMatch(legal, /generateContentTranslation/);
    const fields = readWeb("features/language/components/PublicTranslatedFields.tsx");
    assert.doesNotMatch(fields, /generateContentTranslation/);
    assert.match(fields, /resolveTranslatedContent/);
  });

  it("shared public paths no longer call generateContentTranslation", () => {
    const files = [
      "features/language/resolve-localized-presentation.ts",
      "features/language/resolve-public-content-translation-display.ts",
      "features/language/components/PublicTranslatedFields.tsx",
      "features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
      "features/civic-media-center/components/use-trusted-media-explanations-overlay.ts",
      "features/blog/resolve-blog-post-presentation.ts",
      "features/public-initiative-experience/resolve-discussion-comment-presentation.ts",
      "features/public-initiative-experience/components/LifecycleTranslatedRecordCard.tsx",
    ];
    for (const file of files) {
      const src = readWeb(file);
      assert.doesNotMatch(
        src,
        /generateContentTranslation\s*\(/,
        `${file} must not invoke generateContentTranslation`,
      );
    }
  });

  it("PARTIAL CURRENT still per-field falls back to canonical", async () => {
    const result = await resolveLocalizedPresentation({
      request: {
        sourceKind: "collaborative_analysis",
        sourceRecordId: "ca-partial",
        displayLanguage: "uk",
        ready: true,
        translationPreference: "preferred",
      },
      canonicalFields: { title: "Title EN", summary: "Summary EN" },
      deps: {
        resolveTranslatedContent: async () => ({
          presentationMode: "preferred_translation",
          content: { title: "Заголовок UK" },
          activeLanguage: "uk",
          originalLanguage: "en",
          originalContent: { title: "Title EN", summary: "Summary EN" },
          translation: null,
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: false,
        }),
        generateContentTranslation: async () => {
          throw new Error("must not generate");
        },
      },
    });
    assert.equal(result.fields.title, "Заголовок UK");
    assert.equal(result.fields.summary, "Summary EN");
  });
});
