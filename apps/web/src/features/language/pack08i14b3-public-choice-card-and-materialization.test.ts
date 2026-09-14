/**
 * Pack 08I.14B.3 — Public Choice card + compact card + locale integrity.
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
import { InitiativeCompactCardTitleDom } from "../public-initiative-experience/initiative-presentation-dom.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const EN_TITLE = "EN_PC_TITLE_SENTINEL";
const UK_TITLE = "UK_PC_TITLE_SENTINEL";

describe("Pack 08I.14B.3 — Public Choice card localized title", () => {
  it("8–9. CountryElectionRailCard uses localized Initiative title + aria", () => {
    const src = readWeb(
      "features/country-experience/components/CountryElectionRailCard.tsx",
    );
    assert.match(src, /useInitiativeCardTitlePresentation/);
    assert.match(src, /const displayTitle = useInitiativeCardTitlePresentation/);
    assert.match(src, /openElectionAria[\s\S]*title:\s*displayTitle/);
    assert.match(src, /\{displayTitle\}/);
    assert.doesNotMatch(src, /\{initiative\.title\}/);
    assert.doesNotMatch(src, /sourceKind:\s*["']public_choice["']/);
  });

  it("10. Public Choice detail remains on Initiative presentation owner", () => {
    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(page, /useInitiativePublicPresentation/);
    assert.match(page, /presentation=\{initiativePresentation\}/);
  });

  it("11. compact normal Initiative cards still contain no description", () => {
    const html = renderToStaticMarkup(
      createElement(InitiativeCompactCardTitleDom, { title: UK_TITLE }),
    );
    assert.match(html, new RegExp(UK_TITLE));
    assert.doesNotMatch(html, /DESCRIPTION|description|summary/i);

    for (const relative of [
      "features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx",
      "features/country-experience/components/CountryInitiativeRailCard.tsx",
      "features/country-experience/components/CountryElectionRailCard.tsx",
    ]) {
      const src = readWeb(relative);
      assert.doesNotMatch(src, /__description|country-initiative-rail-card__summary/);
    }
  });

  it("12. uk → en → uk reactive switching does not regress", () => {
    const uk = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: "EN_DESC" },
      translated: { title: UK_TITLE, description: "UK_DESC" },
      presentationMode: "translated",
      activeLanguage: "uk",
      originalLanguage: "en",
    });
    const en = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: "EN_DESC" },
      presentationMode: "original",
      activeLanguage: "en",
      originalLanguage: "en",
    });
    const toEn = mergeInitiativePublicPresentationUpdate({ previous: uk, next: en });
    assert.equal(toEn.activeLanguage, "en");
    assert.equal(toEn.title, EN_TITLE);
    const back = mergeInitiativePublicPresentationUpdate({ previous: toEn, next: uk });
    assert.equal(back.activeLanguage, "uk");
    assert.equal(back.title, UK_TITLE);

    const hook = readWeb(
      "features/public-initiative-experience/use-initiative-public-presentation.ts",
    );
    assert.match(hook, /generation !== requestGeneration\.current/);
    assert.match(hook, /resolved\.activeLanguage !== displayLanguage/);
  });
});
