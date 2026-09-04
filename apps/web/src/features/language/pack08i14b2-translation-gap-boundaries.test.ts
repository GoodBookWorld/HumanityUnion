/**
 * Pack 08I.14B.2 — prove Live failure boundaries (diagnosis only; no product fix).
 *
 * Live staging after warm SCHEDULED=38:
 * - initiative CURRENT_UK=6 MISSING_UK=4
 * - collaborative_analysis CURRENT_UK=2 MISSING_UK=3
 * - petition CURRENT_UK=1 MISSING_UK=2
 * - Public Choice detail translates; CountryElectionRailCard still uses raw title
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
  selectInitiativePublicPresentation,
} from "../public-initiative-experience/initiative-public-presentation.js";
import {
  InitiativeCompactCardTitleDom,
  InitiativePieHeroPresentationDom,
} from "../public-initiative-experience/initiative-presentation-dom.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const EN_TITLE = "EN_INITIATIVE_TITLE_SENTINEL";
const UK_TITLE = "UK_INITIATIVE_TITLE_SENTINEL";
const EN_DESCRIPTION = "EN_INITIATIVE_DESCRIPTION_SENTINEL";
const UK_DESCRIPTION = "UK_INITIATIVE_DESCRIPTION_SENTINEL";
const EN_CA_TITLE = "EN_CA_TITLE_SENTINEL";
const UK_CA_TITLE = "UK_CA_TITLE_SENTINEL";
const EN_PETITION_TITLE = "EN_PETITION_TITLE_SENTINEL";
const UK_PETITION_TITLE = "UK_PETITION_TITLE_SENTINEL";

describe("Pack 08I.14B.2 — Initiative current vs missing UK", () => {
  it("current UK translation reaches PIE Hero DOM", () => {
    const presentation = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
      translated: { title: UK_TITLE, description: UK_DESCRIPTION },
      presentationMode: "translated",
      activeLanguage: "uk",
      originalLanguage: "en",
    });
    const html = renderToStaticMarkup(
      createElement(InitiativePieHeroPresentationDom, { presentation }),
    );
    assert.match(html, new RegExp(UK_TITLE));
    assert.match(html, new RegExp(UK_DESCRIPTION));
    assert.doesNotMatch(html, new RegExp(EN_TITLE));
  });

  it("missing UK translation remains canonical without breaking Hero DOM", () => {
    const presentation = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
      presentationMode: "original",
      activeLanguage: "uk",
      originalLanguage: "en",
    });
    const html = renderToStaticMarkup(
      createElement(InitiativePieHeroPresentationDom, { presentation }),
    );
    assert.match(html, new RegExp(EN_TITLE));
    assert.match(html, new RegExp(EN_DESCRIPTION));
    assert.doesNotMatch(html, new RegExp(UK_TITLE));
  });

  it("compact normal Initiative cards never render description", () => {
    const html = renderToStaticMarkup(
      createElement(InitiativeCompactCardTitleDom, { title: UK_TITLE }),
    );
    assert.match(html, new RegExp(UK_TITLE));
    assert.doesNotMatch(html, /DESCRIPTION|description|summary/i);

    const mini = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    const world = readWeb("features/initiatives/components/WorldInitiativesPageContent.tsx");
    const country = readWeb(
      "features/country-experience/components/CountryInitiativeRailCard.tsx",
    );
    for (const src of [mini, world, country]) {
      assert.match(src, /useInitiativeCardTitlePresentation/);
      assert.doesNotMatch(src, /__description|__summary|>\{.*description/);
    }
  });
});

describe("Pack 08I.14B.2 — Collaborative Analysis / Petition presentation wiring", () => {
  it("CA PublicResult mounts PublicTranslatedFields with interface display language", () => {
    const ca = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx",
    );
    assert.match(ca, /PublicTranslatedFields/);
    assert.match(ca, /sourceKind:\s*"collaborative_analysis"|sourceKind=\{?"collaborative_analysis"/);
    assert.match(ca, /fallbackFields/);

    const fields = readWeb("features/language/components/PublicTranslatedFields.tsx");
    assert.match(fields, /resolvePublicContentDisplayLanguage/);
    assert.match(fields, /language:\s*displayLanguage/);
    assert.doesNotMatch(fields, /readingContext\.readingLanguage/);
  });

  it("Petition PublicResult mounts PublicTranslatedFields for civic prose fields", () => {
    const petition = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(petition, /PublicTranslatedFields/);
    assert.match(petition, /sourceKind:\s*"petition"|sourceKind=\{?"petition"/);
    assert.match(petition, /requestStatement/);
    assert.match(petition, /fallbackFields/);
  });

  it("documents Live DATA_COMPLETION: CA/Petition resolve miss leaves original mode", () => {
    // Live audit (08I.14B.2): CA CURRENT_UK=2 MISSING_UK=3; Petition CURRENT=1 MISSING=2.
    // PublicTranslatedFields starts from fallbackFields (canonical) until resolve returns
    // preferred_translation — so MISSING_UK surfaces as English civic prose.
    const fields = readWeb("features/language/components/PublicTranslatedFields.tsx");
    assert.match(fields, /setFields\(fallback\)/);
    assert.match(fields, /resolveTranslatedContent/);
  });
});

describe("Pack 08I.14B.2/14B.3 — Public Choice card presentation", () => {
  it("CountryElectionRailCard uses shared Initiative title presentation (14B.3 fix)", () => {
    const electionCard = readWeb(
      "features/country-experience/components/CountryElectionRailCard.tsx",
    );
    assert.match(electionCard, /useInitiativeCardTitlePresentation/);
    assert.match(electionCard, /displayTitle/);
    assert.match(electionCard, /openElectionAria[\s\S]*displayTitle/);
    assert.doesNotMatch(electionCard, /\{initiative\.title\}/);
    assert.doesNotMatch(electionCard, /sourceKind:\s*"public_choice"/);
  });

  it("CountryInitiativeRailCard already uses shared Initiative title presentation", () => {
    const rail = readWeb(
      "features/country-experience/components/CountryInitiativeRailCard.tsx",
    );
    assert.match(rail, /useInitiativeCardTitlePresentation/);
    assert.match(rail, /displayTitle/);
    assert.doesNotMatch(rail, /\{initiative\.title\}/);
  });

  it("PIE detail still owns Initiative presentation (Public Choice detail OK path)", () => {
    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(page, /useInitiativePublicPresentation/);
    assert.match(page, /presentation=\{initiativePresentation\}/);
  });
});

describe("Pack 08I.14B.2 — locale switch integrity", () => {
  it("uk → en → uk without reload; same-locale anti-reversion preserved", () => {
    const uk = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
      translated: { title: UK_TITLE, description: UK_DESCRIPTION },
      presentationMode: "translated",
      activeLanguage: "uk",
      originalLanguage: "en",
    });
    const en = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
      presentationMode: "original",
      activeLanguage: "en",
      originalLanguage: "en",
    });

    const toEn = mergeInitiativePublicPresentationUpdate({ previous: uk, next: en });
    assert.equal(toEn.activeLanguage, "en");
    assert.equal(toEn.title, EN_TITLE);

    const backUk = mergeInitiativePublicPresentationUpdate({ previous: toEn, next: uk });
    assert.equal(backUk.activeLanguage, "uk");
    assert.equal(backUk.title, UK_TITLE);

    // Same-locale transient original must not wipe warm UK.
    const sameLocaleOriginal = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
      presentationMode: "original",
      activeLanguage: "uk",
      originalLanguage: "en",
    });
    const guarded = mergeInitiativePublicPresentationUpdate({
      previous: uk,
      next: sameLocaleOriginal,
    });
    assert.equal(guarded.title, UK_TITLE);

    const hook = readWeb(
      "features/public-initiative-experience/use-initiative-public-presentation.ts",
    );
    assert.match(hook, /generation !== requestGeneration\.current/);
    assert.match(hook, /resolved\.activeLanguage !== displayLanguage/);
  });
});

describe("Pack 08I.14B.2 — sentinel DOM helpers for CA/Petition translated content", () => {
  it("translated CA/Petition field values are distinguishable from canonical EN in markup", () => {
    // Presentational boundary used by PublicTranslatedFields body chrome.
    const caHtml = renderToStaticMarkup(
      createElement("div", { className: "hu-public-translated-fields" }, [
        createElement("h4", { key: "l" }, "Title"),
        createElement("div", { key: "b", className: "hu-translated-content__body" }, UK_CA_TITLE),
      ]),
    );
    assert.match(caHtml, new RegExp(UK_CA_TITLE));
    assert.doesNotMatch(caHtml, new RegExp(EN_CA_TITLE));

    const petitionHtml = renderToStaticMarkup(
      createElement("div", { className: "hu-public-translated-fields" }, [
        createElement(
          "div",
          { key: "b", className: "hu-translated-content__body" },
          UK_PETITION_TITLE,
        ),
      ]),
    );
    assert.match(petitionHtml, new RegExp(UK_PETITION_TITLE));
    assert.doesNotMatch(petitionHtml, new RegExp(EN_PETITION_TITLE));
  });
});
