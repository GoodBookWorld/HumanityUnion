/**
 * Public member page — recent Initiative titles use CT `initiative`
 * (shared card presentation), not canonical-only embedding.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveInitiativeCardPresentation } from "../public-initiative-mini-card/resolve-initiative-card-presentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Public member recent Initiative title localization", () => {
  it("disclosure uses shared CT card title presentation (not ci-rail canonical passthrough)", () => {
    const disclosure = readWeb(
      "features/member-profile/components/RecentPublicInitiativesDisclosure.tsx",
    );
    assert.match(disclosure, /useInitiativeCardTitlePresentation/);
    assert.match(disclosure, /initiativeId:\s*initiative\.initiativeId/);
    assert.match(disclosure, /canonicalTitle:\s*initiative\.title/);
    assert.doesNotMatch(disclosure, /buildCiRailPresentation/);
    assert.doesNotMatch(disclosure, /presentation\.title/);
  });

  it("arbitrary non-source locale: CURRENT CT title wins; absent CURRENT falls back to canonical", async () => {
    const locale = "xx-Future";
    const presented = await resolveInitiativeCardPresentation(
      {
        initiativeId: "init-member-panel-1",
        canonical: {
          title: "Canonical English Title",
          summary: "Canonical summary",
        },
        readingContext: {
          ready: true,
          readingLanguage: locale,
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async (input) => {
          assert.equal(input.sourceKind, "initiative");
          assert.equal(input.sourceRecordId, "init-member-panel-1");
          assert.equal(input.language, locale);
          return {
            presentationMode: "preferred_translation",
            content: {
              title: "Localized Future Title",
              description: "Localized summary",
            },
            activeLanguage: locale,
            originalLanguage: "en",
            originalContent: {
              title: "Canonical English Title",
              description: "Canonical summary",
            },
            translation: null,
            isMachineTranslated: true,
            isStale: false,
            canViewOriginal: true,
            canViewTranslation: true,
          };
        },
        generateContentTranslation: async () => {
          throw new Error("must not generate on read");
        },
      },
    );

    assert.equal(presented.presentationMode, "translated");
    assert.equal(presented.title, "Localized Future Title");

    const fallback = await resolveInitiativeCardPresentation(
      {
        initiativeId: "init-member-panel-1",
        canonical: {
          title: "Canonical English Title",
          summary: "Canonical summary",
        },
        readingContext: {
          ready: true,
          readingLanguage: locale,
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "original",
          content: {
            title: "Canonical English Title",
            description: "Canonical summary",
          },
          activeLanguage: "en",
          originalLanguage: "en",
          originalContent: {
            title: "Canonical English Title",
            description: "Canonical summary",
          },
          translation: null,
          isMachineTranslated: false,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: false,
        }),
        generateContentTranslation: async () => {
          throw new Error("must not generate on read");
        },
      },
    );

    assert.equal(fallback.presentationMode, "original");
    assert.equal(fallback.title, "Canonical English Title");
  });
});
