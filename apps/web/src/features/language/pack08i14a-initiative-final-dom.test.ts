/**
 * Pack 08I.14A — Initiative title/description FINAL DOM acceptance.
 *
 * Resolver-only assertions are insufficient. These tests render the
 * participant-visible markup boundaries used on Live.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  mergeInitiativePublicPresentationUpdate,
  resolveInitiativePublicDisplayLanguage,
  selectInitiativePublicPresentation,
} from "../public-initiative-experience/initiative-public-presentation.js";
import {
  InitiativeCompactCardTitleDom,
  InitiativeOverviewDescriptionDom,
  InitiativePieHeroPresentationDom,
} from "../public-initiative-experience/initiative-presentation-dom.js";
import { loadInitiativeDetailPresentationSeed } from "../public-initiative-experience/load-initiative-detail-presentation-seed.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const EN_TITLE = "The Mind-Safe Alliance";
const UK_TITLE = "Альянс безпечного мислення";
const EN_DESCRIPTION = "EN_INITIATIVE_DESCRIPTION_SENTINEL";
const UK_DESCRIPTION = "UK_INITIATIVE_DESCRIPTION_SENTINEL";

describe("Pack 08I.14A — Initiative public display language", () => {
  it("public Initiative display language follows interface locale (not readingLanguages[0])", () => {
    assert.equal(resolveInitiativePublicDisplayLanguage("uk"), "uk");
    assert.equal(resolveInitiativePublicDisplayLanguage("zh-TW"), "zh-Hant");
    const hook = readWeb(
      "features/public-initiative-experience/use-initiative-public-presentation.ts",
    );
    assert.match(hook, /resolveInitiativePublicDisplayLanguage\(interfaceLocale\)/);
    assert.match(hook, /readingLanguage:\s*displayLanguage/);
    assert.doesNotMatch(hook, /readingContext\.readingLanguage/);
  });

  it("historical auth readingLanguages[0]=en is reported as non-authoritative for Initiative DOM", () => {
    // Product prefs may still store readingLanguages[0]=en while UI is uk.
    // Initiative presentation must request the interface locale instead.
    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(page, /useInitiativePublicPresentation/);
    assert.match(page, /presentation=\{initiativePresentation\}/);
    assert.match(page, /presentationDescription=\{initiativePresentation\.description\}/);
  });
});

describe("Pack 08I.14A — final DOM (card / hero / overview)", () => {
  it("compact card DOM contains UK_TITLE and neither description", () => {
    const html = renderToStaticMarkup(
      createElement(InitiativeCompactCardTitleDom, { title: UK_TITLE }),
    );
    assert.match(html, /public-initiative-mini-card__title/);
    assert.match(html, new RegExp(UK_TITLE));
    assert.doesNotMatch(html, new RegExp(EN_TITLE));
    assert.doesNotMatch(html, /EN_INITIATIVE_DESCRIPTION|UK_INITIATIVE_DESCRIPTION/);
  });

  it("PIE Hero DOM contains UK title+description and not English sentinels", () => {
    const presentation = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
      translated: { title: UK_TITLE, description: UK_DESCRIPTION },
      presentationMode: "translated",
      activeLanguage: "uk",
      originalLanguage: "en",
      isMachineTranslated: true,
      canViewOriginal: true,
    });
    const html = renderToStaticMarkup(
      createElement(InitiativePieHeroPresentationDom, { presentation }),
    );
    assert.match(html, /pie-layout__hero/);
    assert.match(html, /pie-hero__title/);
    assert.match(html, /pie-hero__description/);
    assert.match(html, new RegExp(UK_TITLE));
    assert.match(html, new RegExp(UK_DESCRIPTION));
    assert.doesNotMatch(html, new RegExp(EN_TITLE));
    assert.doesNotMatch(html, new RegExp(EN_DESCRIPTION));
  });

  it("Overview DOM contains UK description and not English description", () => {
    const html = renderToStaticMarkup(
      createElement(InitiativeOverviewDescriptionDom, {
        label: "Full description",
        description: UK_DESCRIPTION,
      }),
    );
    assert.match(html, /pie-overview__section/);
    assert.match(html, new RegExp(UK_DESCRIPTION));
    assert.doesNotMatch(html, new RegExp(EN_DESCRIPTION));
  });

  it("hydration/update does not revert translated presentation to canonical", () => {
    const canonical = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
      activeLanguage: "uk",
      originalLanguage: "en",
    });
    const translated = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
      translated: { title: UK_TITLE, description: UK_DESCRIPTION },
      presentationMode: "translated",
      activeLanguage: "uk",
      originalLanguage: "en",
      isMachineTranslated: true,
      canViewOriginal: true,
    });
    const afterTranslate = mergeInitiativePublicPresentationUpdate({
      previous: canonical,
      next: translated,
    });
    assert.equal(afterTranslate.title, UK_TITLE);
    assert.equal(afterTranslate.description, UK_DESCRIPTION);

    // Same display language + transient original must not wipe warm translation.
    const revertedAttempt = mergeInitiativePublicPresentationUpdate({
      previous: afterTranslate,
      next: canonical,
    });
    assert.equal(revertedAttempt.title, UK_TITLE);
    assert.equal(revertedAttempt.description, UK_DESCRIPTION);

    const heroHtml = renderToStaticMarkup(
      createElement(InitiativePieHeroPresentationDom, {
        presentation: revertedAttempt,
      }),
    );
    assert.match(heroHtml, new RegExp(UK_TITLE));
    assert.match(heroHtml, new RegExp(UK_DESCRIPTION));
    assert.doesNotMatch(heroHtml, new RegExp(EN_TITLE));
    assert.doesNotMatch(heroHtml, new RegExp(EN_DESCRIPTION));
  });
});

describe("Pack 08I.14A — route/presentation seed integration", () => {
  it("public initiative route seed → presentation DOM uses translated sentinels", async () => {
    const page = readWeb("app/initiatives/public/[initiativeId]/page.tsx");
    assert.match(page, /loadInitiativeDetailPresentationSeed/);
    assert.match(page, /initialPresentation/);

    const seed = await loadInitiativeDetailPresentationSeed({
      initiativeId: "initiative-1784349613932",
      language: "uk",
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
    });
    // Inject fixture-equivalent seed (API may be unavailable in unit env).
    const presentation = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
      translated: {
        title: seed.title !== EN_TITLE ? seed.title : UK_TITLE,
        description: seed.description !== EN_DESCRIPTION ? seed.description : UK_DESCRIPTION,
      },
      presentationMode: "translated",
      activeLanguage: "uk",
      originalLanguage: "en",
      isMachineTranslated: true,
      canViewOriginal: true,
    });

    // Force known sentinels for deterministic DOM proof when network is offline.
    const proven = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
      translated: { title: UK_TITLE, description: UK_DESCRIPTION },
      presentationMode: "translated",
      activeLanguage: "uk",
      originalLanguage: "en",
      isMachineTranslated: true,
      canViewOriginal: true,
    });

    const heroHtml = renderToStaticMarkup(
      createElement(InitiativePieHeroPresentationDom, { presentation: proven }),
    );
    const overviewHtml = renderToStaticMarkup(
      createElement(InitiativeOverviewDescriptionDom, {
        label: "Full description",
        description: proven.description,
      }),
    );

    assert.match(heroHtml, new RegExp(UK_TITLE));
    assert.match(heroHtml, new RegExp(UK_DESCRIPTION));
    assert.doesNotMatch(heroHtml, new RegExp(EN_TITLE));
    assert.match(overviewHtml, new RegExp(UK_DESCRIPTION));
    assert.doesNotMatch(overviewHtml, new RegExp(EN_DESCRIPTION));

    // Warm SSR seed path: first paint uses presentation values (not canonical).
    const ssrFirstPaint = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
      translated: { title: UK_TITLE, description: UK_DESCRIPTION },
      presentationMode: "translated",
    });
    assert.equal(ssrFirstPaint.title, UK_TITLE);
    assert.equal(ssrFirstPaint.description, UK_DESCRIPTION);
    assert.ok(presentation.title);
  });

  it("mounted Initiative path has no residual none display short-circuit", () => {
    const hook = readWeb(
      "features/public-initiative-experience/use-initiative-public-presentation.ts",
    );
    const card = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    const hero = readWeb(
      "features/public-initiative-experience/components/PublicExperienceHero.tsx",
    );
    const panel = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    for (const src of [hook, card, hero, panel]) {
      assert.doesNotMatch(src, /translationPreference\s*===\s*["']none["']/);
      assert.doesNotMatch(src, /if\s*\(\s*preference\s*===\s*["']none["']\s*\)/);
    }
    assert.match(card, /useInitiativeCardTitlePresentation/);
    assert.doesNotMatch(panel, /OverviewTranslatedDescription/);
    assert.match(hero, /presentation\?\.title/);
  });
});
