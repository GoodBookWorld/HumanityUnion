/**
 * HU-LC-05C.4C.7F.7N — ICC sidebar title uses cache-only CURRENT CT.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { LanguageCode, ResolvedTranslatedDisplay } from "@hu/types";

import { resolveIccInitiativeDisplayTitle } from "./resolve-icc-initiative-display-title";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(HERE, "../..");
const readWeb = (relative: string) => readFileSync(path.join(WEB_SRC, relative), "utf8");

function translated(
  overrides: Partial<ResolvedTranslatedDisplay<Record<string, string>>> & {
    content: Record<string, string>;
  },
): ResolvedTranslatedDisplay<Record<string, string>> {
  return {
    presentationMode: "preferred_translation",
    isStale: false,
    activeLanguage: "uk",
    originalLanguage: "en",
    originalContent: { title: "Canonical English Title", description: "Desc" },
    translation: null,
    isMachineTranslated: true,
    canViewOriginal: true,
    canViewTranslation: true,
    ...overrides,
  };
}

describe("HU-LC-05C.4C.7F.7N — ICC initiative display title", () => {
  it("shows CURRENT translated title when cache resolve returns translated title", async () => {
    let resolveCalls = 0;
    let generateCalls = 0;
    const title = await resolveIccInitiativeDisplayTitle(
      {
        initiativeId: "init-1",
        canonicalTitle: "Canonical English Title",
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => {
          resolveCalls += 1;
          return translated({
            content: { title: "Українська назва", description: "Опис" },
          });
        },
        generateContentTranslation: async () => {
          generateCalls += 1;
          throw new Error("generate must not be called");
        },
      },
    );
    assert.equal(title, "Українська назва");
    assert.equal(resolveCalls, 1);
    assert.equal(generateCalls, 0);
  });

  it("falls back to canonical when CT missing/stale/original", async () => {
    const title = await resolveIccInitiativeDisplayTitle(
      {
        initiativeId: "init-1",
        canonicalTitle: "Canonical English Title",
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () =>
          translated({
            presentationMode: "original",
            isStale: true,
            content: {},
            isMachineTranslated: false,
            canViewOriginal: false,
            canViewTranslation: false,
          }),
        generateContentTranslation: async () => {
          throw new Error("generate must not be called");
        },
      },
    );
    assert.equal(title, "Canonical English Title");
  });

  it("falls back to canonical when translated bag has empty title", async () => {
    const title = await resolveIccInitiativeDisplayTitle(
      {
        initiativeId: "init-1",
        canonicalTitle: "Canonical English Title",
        readingContext: {
          ready: true,
          readingLanguage: "ar",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () =>
          translated({
            activeLanguage: "ar",
            content: { title: "   ", description: "وصف" },
          }),
        generateContentTranslation: async () => {
          throw new Error("generate must not be called");
        },
      },
    );
    assert.equal(title, "Canonical English Title");
  });

  it("reflects locale changes by re-resolving with reading language", async () => {
    const seen: LanguageCode[] = [];
    for (const language of ["uk", "ar"] as const) {
      await resolveIccInitiativeDisplayTitle(
        {
          initiativeId: "init-1",
          canonicalTitle: "Canonical English Title",
          readingContext: {
            ready: true,
            readingLanguage: language,
            translationPreference: "preferred",
          },
        },
        {
          resolveTranslatedContent: async (input) => {
            const lang = input.language ?? "en";
            seen.push(lang);
            return translated({
              activeLanguage: lang,
              content: {
                title: lang === "uk" ? "УК" : "عربي",
                description: "x",
              },
            });
          },
          generateContentTranslation: async () => {
            throw new Error("generate must not be called");
          },
        },
      );
    }
    assert.deepEqual(seen, ["uk", "ar"]);
  });

  it("ICC channel wiring uses display title hook and dir=auto; no generate", () => {
    const channel = readWeb(
      "features/initiative-collaboration-channel/components/InitiativeCollaborationChannel.tsx",
    );
    const hook = readWeb(
      "features/initiative-collaboration-channel/use-icc-initiative-display-title.ts",
    );
    const resolver = readWeb(
      "features/initiative-collaboration-channel/resolve-icc-initiative-display-title.ts",
    );
    assert.match(channel, /useIccInitiativeDisplayTitle/);
    assert.match(channel, /pagePresentationTitle:\s*initiativeDisplayTitle/);
    assert.match(channel, /id="icc-channel-title"/);
    assert.match(channel, /dir="auto"/);
    assert.match(hook, /resolveIccInitiativeDisplayTitle/);
    assert.match(hook, /pagePresentationTitle/);
    assert.match(resolver, /resolvePublicContentTranslationDisplay/);
    assert.doesNotMatch(resolver, /generateContentTranslation\(/);
    assert.doesNotMatch(channel, /gemini/i);
  });
});
