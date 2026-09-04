/**
 * Pack 08J.1 — runtime universal translation completion acceptance.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveLocalizedPresentation } from "./resolve-localized-presentation.js";
import { applyTranslatedPresentationFields } from "./translate-presentation.js";
import { runUniversalLocalizationCoverageGate } from "./universal-localization-coverage-gate.js";
import { resolveBlogPostPresentation } from "../blog/resolve-blog-post-presentation.js";
import { resolveDiscussionCommentPresentation } from "../public-initiative-experience/resolve-discussion-comment-presentation.js";
import {
  overlayCivicMediaEditorialFromFields,
  buildCanonicalCivicMediaEditorial,
} from "../civic-media-center/components/CivicMediaTranslatedEditorial.js";
import type { CivicMediaCenterPublic } from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function fakeCivicMedia(): CivicMediaCenterPublic {
  return {
    overview: {
      title: "Overview EN",
      summary: "Summary EN",
      points: [{ id: "p1", heading: "H", body: "B" }],
    },
    selectionPrinciples: [
      {
        id: "editorial-transparency",
        title: "Principle EN",
        description: "Body EN",
        sortOrder: 1,
      },
    ],
    faq: [{ id: "f1", question: "Q", answer: "A", sortOrder: 1 }],
    initiativeFlow: {
      title: "Flow",
      summary: "Flow summary",
      diagramSvg: "",
      stages: ["S1"],
    },
    trustedMediaCategories: [],
    trustedMedia: [
      {
        id: "the-atlantic",
        name: "The Atlantic",
        country: "US",
        categoryId: "independent-investigative",
        explanation: "Trusted explanation EN",
        websiteUrl: "https://www.theatlantic.com/",
        logoUrl: "/images/media/the-atlantic.webp",
        logoLabel: "The Atlantic",
        sortOrder: 1,
      },
    ],
    factChecking: [],
    propagandaAnalysis: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("Pack 08J.1 — runtime presentation boundary", () => {
  it("1–2. Blog multi-post presentation localizes via displayLanguage", async () => {
    const posts = [
      { postId: "blog-a", title: "Alpha EN", excerpt: "A", contentHtml: "<p>A</p>" },
      { postId: "blog-b", title: "Beta EN", excerpt: "B", contentHtml: "<p>B</p>" },
    ];
    const deps = {
      resolveTranslatedContent: async ({ sourceRecordId }: { sourceRecordId: string }) => ({
        presentationMode: "preferred_translation" as const,
        content: {
          title: sourceRecordId === "blog-a" ? "Alpha UK" : "Beta UK",
          excerpt: sourceRecordId === "blog-a" ? "A-UK" : "B-UK",
          content: sourceRecordId === "blog-a" ? "<p>A-UK</p>" : "<p>B-UK</p>",
        },
        activeLanguage: "uk" as const,
        originalLanguage: "en" as const,
        originalContent: {
          title: sourceRecordId === "blog-a" ? "Alpha EN" : "Beta EN",
          excerpt: sourceRecordId === "blog-a" ? "A" : "B",
          content: sourceRecordId === "blog-a" ? "<p>A</p>" : "<p>B</p>",
        },
        translation: null,
        isMachineTranslated: true,
        isStale: false,
        canViewOriginal: true,
        canViewTranslation: false,
      }),
      generateContentTranslation: async () => {
        throw new Error("should not generate");
      },
    };

    const presented = await Promise.all(
      posts.map((post) =>
        resolveBlogPostPresentation(
          {
            postId: post.postId,
            canonical: post,
            displayLanguage: "uk",
            ready: true,
            translationPreference: "preferred",
          },
          deps,
        ),
      ),
    );
    assert.equal(presented[0]!.title, "Alpha UK");
    assert.equal(presented[1]!.title, "Beta UK");
    assert.equal(presented[0]!.presentationMode, "translated");
    assert.equal(presented[1]!.presentationMode, "translated");
  });

  it("2–3. Media principle + trusted explanation overlay from CURRENT fields", () => {
    const media = fakeCivicMedia();
    const canonical = buildCanonicalCivicMediaEditorial(media);
    assert.equal(canonical.trustedExplanationsById["the-atlantic"], "Trusted explanation EN");

    const overlaid = overlayCivicMediaEditorialFromFields(
      media,
      {
        overviewTitle: "Огляд",
        selectionPrinciples: JSON.stringify([
          { title: "Принцип UK", description: "Тіло UK" },
        ]),
        trustedMediaExplanations: JSON.stringify([
          { id: "the-atlantic", explanation: "Пояснення UK" },
        ]),
      },
      {
        activeLanguage: "uk",
        originalLanguage: "en",
        isMachineTranslated: true,
        isStale: false,
        canViewOriginal: true,
        presentationMode: "preferred_translation",
      },
    );
    assert.equal(overlaid.selectionPrinciples[0]!.title, "Принцип UK");
    assert.equal(overlaid.selectionPrinciples[0]!.description, "Тіло UK");
    assert.equal(overlaid.trustedExplanationsById["the-atlantic"], "Пояснення UK");
  });

  it("4–6. CA / Discussion / Petition consume CURRENT via generic resolver", async () => {
    const deps = {
      resolveTranslatedContent: async ({
        sourceKind,
      }: {
        sourceKind: string;
      }) => {
        const content: Record<string, string> =
          sourceKind === "discussion_comment"
            ? { body: "Коментар UK" }
            : { title: "Заголовок UK", summary: "Опис UK" };
        const originalContent: Record<string, string> =
          sourceKind === "discussion_comment"
            ? { body: "Comment EN" }
            : { title: "Title EN", summary: "Summary EN" };
        return {
          presentationMode: "preferred_translation" as const,
          content,
          activeLanguage: "uk" as const,
          originalLanguage: "en" as const,
          originalContent,
          translation: null,
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: false,
        };
      },
      generateContentTranslation: async () => {
        throw new Error("should not generate");
      },
    };

    const ca = await resolveLocalizedPresentation({
      request: {
        sourceKind: "collaborative_analysis",
        sourceRecordId: "ca-1",
        displayLanguage: "uk",
        ready: true,
        translationPreference: "preferred",
      },
      canonicalFields: { title: "Title EN", summary: "Summary EN" },
      deps,
    });
    assert.equal(ca.fields.title, "Заголовок UK");
    assert.equal(ca.activeLanguage, "uk");

    const comment = await resolveDiscussionCommentPresentation(
      {
        commentId: "c-1",
        canonicalBody: "Comment EN",
        displayLanguage: "uk",
        ready: true,
        translationPreference: "preferred",
      },
      deps,
    );
    assert.equal(comment.body, "Коментар UK");

    const petition = await resolveLocalizedPresentation({
      request: {
        sourceKind: "petition",
        sourceRecordId: "p-1",
        displayLanguage: "uk",
        ready: true,
        translationPreference: "preferred",
      },
      canonicalFields: { title: "Title EN", summary: "Summary EN" },
      deps,
    });
    assert.equal(petition.fields.summary, "Опис UK");
  });

  it("7–8. nested semantic key + future fixture localizes without allowlist", () => {
    const projected = {
      title: "Hello",
      nested: { futureSemanticNote: "Note EN", participantId: "p-1" },
    };
    const next = applyTranslatedPresentationFields(projected, {
      title: "Привіт",
      "nested.futureSemanticNote": "Нотатка UK",
      "nested.participantId": "SHOULD_NOT",
    });
    assert.equal(next.title, "Привіт");
    assert.equal(next.nested.futureSemanticNote, "Нотатка UK");
    assert.equal(next.nested.participantId, "p-1");
  });

  it("9–10. identity / technical keys preserved by walker", () => {
    const next = applyTranslatedPresentationFields(
      {
        title: "T",
        authorDisplayName: "Ada",
        email: "a@b.com",
        status: "published",
        url: "https://example.com",
      },
      {
        title: "T-UK",
        authorDisplayName: "X",
        email: "x",
        status: "x",
        url: "x",
      },
    );
    assert.equal(next.title, "T-UK");
    assert.equal(next.authorDisplayName, "Ada");
    assert.equal(next.email, "a@b.com");
    assert.equal(next.status, "published");
    assert.equal(next.url, "https://example.com");
  });

  it("15–17. locale contracts — UI displayLanguage, no Gemini in SSR modules, stale gen guard", () => {
    const blogCard = readWeb("features/blog/components/BlogPostCard.tsx");
    assert.match(blogCard, /resolvePublicContentDisplayLanguage/);
    assert.doesNotMatch(blogCard, /readingContext\.readingLanguage/);
    assert.match(blogCard, /requestGeneration/);

    const mediaEditorial = readWeb(
      "features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
    );
    assert.match(mediaEditorial, /resolvePublicContentDisplayLanguage/);
    assert.doesNotMatch(mediaEditorial, /readingContext\.readingLanguage/);

    const localized = readWeb("features/language/resolve-localized-presentation.ts");
    assert.doesNotMatch(localized, /GoogleGenerativeAI|getGenerativeModel/);
    assert.match(localized, /requestGeneration/);
  });

  it("18. compact Initiative cards remain title-only", () => {
    const mini = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    assert.match(mini, /useInitiativeCardTitlePresentation|useCivicInitiativeLocalizedTitle/);
    assert.doesNotMatch(mini, /__description|>\{.*description/);
  });

  it("K. coverage gate Pack 08J.1 zero counters", () => {
    const result = runUniversalLocalizationCoverageGate(webSrc);
    assert.equal(
      result.governedUnexpectedBypasses.length,
      0,
      result.governedUnexpectedBypasses.map((f) => `${f.file}:${f.line}:${f.pattern}`).join("\n"),
    );
    assert.equal(result.counters.UNCLASSIFIED_PARTICIPANT_TEXT, 0);
    assert.equal(result.counters.AUTO_TRANSLATION_BYPASS, 0);
    assert.equal(result.counters.RAW_CANONICAL_RENDER_BYPASS, 0);
    assert.equal(result.counters.BRAND_MACHINE_TRANSLATION_BYPASS, 0);
    assert.equal(result.counters.LEGAL_MACHINE_TRANSLATION_BYPASS, 0);
    assert.equal(result.counters.NON_TRANSLATABLE_VIOLATION, 0);
    assert.equal(result.counters.PRIVATE_DATA_TRANSLATION_ATTEMPT, 0);
  });

  it("mounted surfaces use generic boundary contracts", () => {
    assert.match(
      readWeb("features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx"),
      /PublicTranslatedFields/,
    );
    assert.match(
      readWeb("features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx"),
      /PublicTranslatedFields/,
    );
    assert.match(
      readWeb("features/public-initiative-experience/components/LifecycleTranslatedRecordCard.tsx"),
      /enableOnDemandGenerate=\{true\}/,
    );
    assert.match(
      readWeb("features/civic-media-center/components/CivicMediaCenterPageContent.tsx"),
      /trustedExplanationsById/,
    );
  });
});
