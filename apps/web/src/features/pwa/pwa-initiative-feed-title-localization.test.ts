/**
 * Installed-PWA Workspace initiative carousel uses the cache-only
 * initiative title presentation. Context and preference explanations
 * stay canonical.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { ResolvedTranslatedDisplay } from "@hu/types";

import { resolveOrdinaryReadingOwner } from "../language/ordinary-reading-ownership";
import { resolveInitiativeDetailPresentation } from "../public-initiative-experience/resolve-initiative-detail-presentation";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

const CANONICAL = {
  title: "Establish Regional Democratic Leadership Academies",
  description: "Partner with universities.",
};
const TRANSLATED_TITLE = "建立區域民主領導學院";

function display(input: {
  mode: ResolvedTranslatedDisplay<Record<string, string>>["presentationMode"];
  title?: string;
  description?: string;
  stale?: boolean;
}): ResolvedTranslatedDisplay<Record<string, string>> {
  return {
    presentationMode: input.mode,
    content: {
      title: input.title ?? "",
      description: input.description ?? "",
    },
    activeLanguage: "zh-Hant",
    originalLanguage: "en",
    originalContent: CANONICAL,
    translation: null,
    isMachineTranslated: input.mode !== "original",
    isStale: input.stale === true,
    canViewOriginal: input.mode !== "original",
    canViewTranslation: false,
  };
}

const eligible = {
  enabled: true,
  contentTranslationEnabled: true,
  pwaPersistedReadingEnabled: true,
  pwaPersistedReadingReady: true,
};

describe("PWA Workspace initiative carousel title localization", () => {
  it("non-English hu-persisted ownership resolves a CURRENT title", async () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "zh-Hant",
        sourceKind: "initiative",
        pwaEligibility: eligible,
      }),
      "hu-persisted",
    );

    let generateCalls = 0;
    const resolved = await resolveInitiativeDetailPresentation(
      {
        initiativeId: "initiative-carousel",
        canonical: CANONICAL,
        readingContext: {
          ready: true,
          readingLanguage: "zh-Hant",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () =>
          display({
            mode: "preferred_translation",
            title: TRANSLATED_TITLE,
            description: "與大學合作。",
          }),
        generateContentTranslation: async () => {
          generateCalls += 1;
          throw new Error("provider-on-read");
        },
      },
    );

    assert.equal(resolved.presentationMode, "translated");
    assert.equal(resolved.title, TRANSLATED_TITLE);
    assert.equal(generateCalls, 0);
  });

  it("English and browser-native ownership stay canonical", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "en",
        sourceKind: "initiative",
        pwaEligibility: eligible,
      }),
      "browser-native",
    );
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "browser",
        preferredReadingLanguage: "uk",
        sourceKind: "initiative",
        pwaEligibility: {
          ...eligible,
          enabled: false,
        },
      }),
      "browser-native",
    );

    const hook = readWeb(
      "features/public-initiative-experience/use-initiative-public-presentation.ts",
    );
    assert.match(hook, /owner !== "hu-persisted"/);
    assert.match(hook, /setTitle\(input\.canonicalTitle\)/);
  });

  it("missing or stale Content Translation falls back to the canonical title", async () => {
    const missing = await resolveInitiativeDetailPresentation(
      {
        initiativeId: "initiative-carousel",
        canonical: CANONICAL,
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => display({ mode: "original" }),
        generateContentTranslation: async () => {
          throw new Error("provider-on-read");
        },
      },
    );
    assert.equal(missing.presentationMode, "original");
    assert.equal(missing.title, CANONICAL.title);

    const stale = await resolveInitiativeDetailPresentation(
      {
        initiativeId: "initiative-carousel",
        canonical: CANONICAL,
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () =>
          display({ mode: "original", stale: true }),
        generateContentTranslation: async () => {
          throw new Error("provider-on-read");
        },
      },
    );
    assert.equal(stale.isStale, true);
    assert.equal(stale.title, CANONICAL.title);
  });

  it("feed wiring keeps cache-only titles, WEB_UI chrome, and the installed-PWA gate", () => {
    const feed = readWeb("features/pwa/components/PwaInitiativeFeed.tsx");
    const gate = readWeb("features/pwa/components/PwaStandaloneInitiativeFeed.tsx");
    const dashboard = readWeb("features/workspace-home/components/WorkspaceHomeDashboard.tsx");

    assert.match(feed, /useInitiativeCardTitlePresentation/);
    assert.match(feed, /\{displayTitle\}/);
    assert.match(feed, /useTranslations\("pwa"\)/);
    assert.match(feed, /t\("feed\.title"\)/);
    assert.match(feed, /t\("feed\.viewAll"\)/);
    assert.match(feed, /resolveInitiativeCardStatusLabel/);
    assert.doesNotMatch(feed, /generateContentTranslation|\/translations\/generate/);
    assert.doesNotMatch(
      feed,
      /hu-pwa-initiative-feed__canonical-reading[\s\S]*?\{displayTitle\}/,
    );
    assert.match(feed, /canonicalExplanation/);
    assert.match(feed, /presentation\.context/);

    assert.match(gate, /if \(!standalone\) \{\s*return null;/);
    assert.match(gate, /PwaInitiativeFeed/);
    assert.match(dashboard, /<PwaStandaloneInitiativeFeed \/>/);
    assert.doesNotMatch(dashboard, /<PwaInitiativeFeed/);
  });
});
