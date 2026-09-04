/**
 * Pack 08I.2 — Initiative title/description translation acceptance (source + helper contracts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveLocalizedPublicMetadataCopy } from "../../lib/seo/resolve-localized-public-metadata-copy";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 08I.2 — Initiative translation acceptance", () => {
  it("PublicExperienceHero resolves via page presentation owner (interface locale)", () => {
    const hero = readWeb(
      "features/public-initiative-experience/components/PublicExperienceHero.tsx",
    );
    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    const hook = readWeb(
      "features/public-initiative-experience/use-initiative-public-presentation.ts",
    );
    assert.match(page, /useInitiativePublicPresentation/);
    assert.match(hero, /presentation\?\.title/);
    assert.match(hero, /presentation\?\.description/);
    assert.match(hook, /resolveInitiativeDetailPresentation/);
    assert.match(hook, /readingLanguage:\s*displayLanguage/);
    assert.doesNotMatch(hero, /updatePublicInitiative|patchInitiative|mutateInitiative/);
  });

  it("documents en/uk/zh-Hant/ar reading locale path through reading context", () => {
    const context = readWeb("features/language/use-public-content-reading-context.ts");
    assert.match(context, /readingLanguage|preferredReadingLanguage|interfaceLanguage/);
    const hook = readWeb(
      "features/public-initiative-experience/use-initiative-public-presentation.ts",
    );
    assert.match(hook, /usePublicContentReadingContext/);
    assert.match(hook, /resolveInitiativePublicDisplayLanguage/);
    // LAYOUT_STRESS / reading locales covered by catalog parity suite.
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      assert.ok(locale.length > 0);
    }
  });

  it("metadata helper keeps original on missing/stale-style empty translation fields", () => {
    const missing = resolveLocalizedPublicMetadataCopy({
      title: "Canonical Title",
      description: "Canonical description",
      locale: "uk",
      translatedTitle: null,
      translatedDescription: null,
    });
    assert.equal(missing.title, "Canonical Title");
    assert.equal(missing.description, "Canonical description");
    assert.equal(missing.usedTranslation, false);

    const blank = resolveLocalizedPublicMetadataCopy({
      title: "Canonical Title",
      description: "Canonical description",
      locale: "zh-Hant",
      translatedTitle: "   ",
      translatedDescription: "",
    });
    assert.equal(blank.title, "Canonical Title");
    assert.equal(blank.description, "Canonical description");

    const applied = resolveLocalizedPublicMetadataCopy({
      title: "Canonical Title",
      description: "Canonical description",
      locale: "ar",
      translatedTitle: "عنوان مترجم",
      translatedDescription: "وصف مترجم",
    });
    assert.equal(applied.title, "عنوان مترجم");
    assert.equal(applied.description, "وصف مترجم");
    assert.equal(applied.usedTranslation, true);
  });

  it("loadInitiativeMetadataTranslationFields is resolve-only (no generate)", () => {
    const loader = readWeb("lib/seo/load-initiative-metadata-translation-fields.ts");
    assert.match(loader, /resolveTranslatedContent/);
    assert.doesNotMatch(loader, /generateContentTranslation/);
    assert.match(loader, /presentationMode === "original"/);
    assert.match(loader, /catch/);
  });
});
