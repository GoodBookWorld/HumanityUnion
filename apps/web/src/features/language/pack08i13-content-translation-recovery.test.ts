/**
 * Pack 08I.13 — Web presentation regressions for warm display + discussion comments.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveDiscussionCommentPresentation } from "../public-initiative-experience/resolve-discussion-comment-presentation";
import { resolvePublicContentTranslationDisplay } from "./resolve-public-content-translation-display";
import { shouldAttemptOnDemandContentTranslation } from "./public-translation-presentation-lifecycle";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Pack 08I.13 — warm display is not skipped for translationPreference none", () => {
  it("shared resolver always GET-resolves when ready; generate only when preferred", async () => {
    const calls: string[] = [];
    const display = await resolvePublicContentTranslationDisplay({
      sourceKind: "initiative",
      sourceRecordId: "initiative-1",
      readingContext: {
        ready: true,
        readingLanguage: "uk",
        translationPreference: "none",
      },
      deps: {
        resolveTranslatedContent: async () => {
          calls.push("resolve");
          return {
            presentationMode: "preferred_translation",
            content: { title: "UK title", description: "UK desc" },
            activeLanguage: "uk",
            originalLanguage: "en",
            originalContent: { title: "EN", description: "EN" },
            translation: null,
            isMachineTranslated: true,
            isStale: false,
            canViewOriginal: true,
            canViewTranslation: false,
          };
        },
        generateContentTranslation: async () => {
          calls.push("generate");
          throw new Error("should not generate when preference is none");
        },
      },
    });

    assert.deepEqual(calls, ["resolve"]);
    assert.equal(display?.presentationMode, "preferred_translation");
    assert.equal(display?.content.title, "UK title");
  });

  it("preferred miss still attempts generation", () => {
    assert.equal(
      shouldAttemptOnDemandContentTranslation({
        ready: true,
        translationPreference: "preferred",
        readingLanguage: "uk",
        resolvePresentationMode: "original",
        originalLanguage: "en",
        isStale: false,
      }),
      true,
    );
    assert.equal(
      shouldAttemptOnDemandContentTranslation({
        ready: true,
        translationPreference: "none",
        readingLanguage: "uk",
        resolvePresentationMode: "original",
        originalLanguage: "en",
        isStale: false,
      }),
      false,
    );
  });

  it("initiative/blog resolvers use shared warm-display helper", () => {
    const initiative = readWeb(
      "features/public-initiative-mini-card/resolve-initiative-card-presentation.ts",
    );
    const blog = readWeb("features/blog/resolve-blog-post-presentation.ts");
    assert.match(initiative, /resolvePublicContentTranslationDisplay/);
    assert.match(blog, /resolvePublicContentTranslationDisplay/);
    assert.doesNotMatch(initiative, /translationPreference === "none"/);
    assert.doesNotMatch(blog, /translationPreference === "none"/);
  });
});

describe("Pack 08I.13 — discussion comment presentation", () => {
  it("resolved body uses translated content when available", async () => {
    const resolved = await resolveDiscussionCommentPresentation(
      {
        commentId: "comment-1",
        canonicalBody: "Original English comment",
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "preferred_translation",
          content: { body: "Український коментар" },
          activeLanguage: "uk",
          originalLanguage: "en",
          originalContent: { body: "Original English comment" },
          translation: null,
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: false,
        }),
        generateContentTranslation: async () => {
          throw new Error("unexpected generate");
        },
      },
    );
    assert.equal(resolved.presentationMode, "translated");
    assert.equal(resolved.body, "Український коментар");
  });

  it("panel wires discussion comment presentation resolver", () => {
    const panel = readWeb(
      "features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
    );
    assert.match(panel, /resolveDiscussionCommentPresentation/);
    assert.match(panel, /displayBody/);
  });

  it("Media pipeline falls back to WEB_UI catalogs when civic overlay is not machine-translated", () => {
    const page = readWeb(
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    );
    assert.match(page, /translationChrome\.isMachineTranslated/);
    assert.match(page, /CivicPipelineWorkflow/);
  });
});
