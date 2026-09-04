/**
 * Pack 08I.14B — Initiative locale-switch + View Original final-DOM acceptance.
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
import { resolvePublicContentDisplayLanguage } from "./resolve-public-content-display-language.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const EN_TITLE = "The Mind-Safe Alliance";
const UK_TITLE = "Альянс безпечного мислення";
const EN_DESCRIPTION = "EN_INITIATIVE_DESCRIPTION_SENTINEL";
const UK_DESCRIPTION = "UK_INITIATIVE_DESCRIPTION_SENTINEL";

function ukPresentation() {
  return selectInitiativePublicPresentation({
    canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
    translated: { title: UK_TITLE, description: UK_DESCRIPTION },
    presentationMode: "translated",
    activeLanguage: "uk",
    originalLanguage: "en",
    canViewOriginal: true,
    canViewTranslation: true,
    isMachineTranslated: true,
  });
}

function enOriginalPresentation() {
  return selectInitiativePublicPresentation({
    canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
    presentationMode: "original",
    activeLanguage: "en",
    originalLanguage: "en",
  });
}

describe("Pack 08I.14B — single display-language contract", () => {
  it("shared helper aliases Initiative display language", () => {
    assert.equal(resolvePublicContentDisplayLanguage("uk"), "uk");
    assert.equal(resolveInitiativePublicDisplayLanguage("zh-TW"), "zh-Hant");
    assert.equal(
      resolvePublicContentDisplayLanguage("uk"),
      resolveInitiativePublicDisplayLanguage("uk"),
    );
  });

  it("Discussion + Lifecycle + PublicTranslatedFields request interface locale", () => {
    const discussion = readWeb(
      "features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
    );
    assert.match(discussion, /resolvePublicContentDisplayLanguage/);
    assert.match(discussion, /readingLanguage:\s*displayLanguage/);
    assert.doesNotMatch(
      discussion,
      /resolveDiscussionCommentPresentation\(\{[\s\S]*readingContext,\s*\}\)/,
    );

    const lifecycle = readWeb(
      "features/public-initiative-experience/components/LifecycleTranslatedRecordCard.tsx",
    );
    assert.match(lifecycle, /resolveInitiativePublicDisplayLanguage/);
    assert.match(lifecycle, /readingLanguage:\s*displayLanguage/);

    const fields = readWeb("features/language/components/PublicTranslatedFields.tsx");
    assert.match(fields, /resolvePublicContentDisplayLanguage/);
    assert.match(fields, /language:\s*displayLanguage/);
    assert.doesNotMatch(fields, /readingContext\.readingLanguage/);
  });
});

describe("Pack 08I.14B — locale switch without reload", () => {
  it("UK → EN replaces translated presentation (no reload / no prior-UK keep)", () => {
    const previous = ukPresentation();
    const next = enOriginalPresentation();
    const merged = mergeInitiativePublicPresentationUpdate({ previous, next });
    assert.equal(merged.activeLanguage, "en");
    assert.equal(merged.presentationMode, "original");
    assert.equal(merged.title, EN_TITLE);
    assert.equal(merged.description, EN_DESCRIPTION);
  });

  it("EN → UK applies warm translation", () => {
    const previous = enOriginalPresentation();
    const next = ukPresentation();
    const merged = mergeInitiativePublicPresentationUpdate({ previous, next });
    assert.equal(merged.activeLanguage, "uk");
    assert.equal(merged.title, UK_TITLE);
    assert.equal(merged.description, UK_DESCRIPTION);
  });

  it("same-locale transient original does not wipe warm UK", () => {
    const previous = ukPresentation();
    const next = selectInitiativePublicPresentation({
      canonical: { title: EN_TITLE, description: EN_DESCRIPTION },
      presentationMode: "original",
      activeLanguage: "uk",
      originalLanguage: "en",
    });
    const merged = mergeInitiativePublicPresentationUpdate({ previous, next });
    assert.equal(merged.title, UK_TITLE);
    assert.equal(merged.description, UK_DESCRIPTION);
  });

  it("stale async UK response must not overwrite EN after locale switch", () => {
    // Simulate: EN applied, then late UK resolve arrives with activeLanguage=uk.
    const previous = enOriginalPresentation();
    const lateUk = ukPresentation();
    // Hook rejects when resolved.activeLanguage !== displayLanguage.
    // Merge also requires activeLanguage change to apply — if caller wrongly merges
    // without guard, we still want language change to be explicit.
    assert.notEqual(previous.activeLanguage, lateUk.activeLanguage);
    const wronglyMerged = mergeInitiativePublicPresentationUpdate({
      previous,
      next: lateUk,
    });
    // Language-change wins when intentionally applied; race protection lives in the hook
    // generation/cancel + activeLanguage !== displayLanguage check.
    assert.equal(wronglyMerged.activeLanguage, "uk");
    const hook = readWeb(
      "features/public-initiative-experience/use-initiative-public-presentation.ts",
    );
    assert.match(hook, /generation !== requestGeneration\.current/);
    assert.match(hook, /resolved\.activeLanguage !== displayLanguage/);
  });

  it("final DOM tracks locale presentation: UK then EN then UK", () => {
    const uk = ukPresentation();
    const en = enOriginalPresentation();

    let html = renderToStaticMarkup(
      createElement(InitiativePieHeroPresentationDom, {
        presentation: { title: uk.title, description: uk.description },
      }),
    );
    assert.match(html, new RegExp(UK_TITLE));
    assert.match(html, new RegExp(UK_DESCRIPTION));
    assert.doesNotMatch(html, new RegExp(EN_TITLE));

    html = renderToStaticMarkup(
      createElement(InitiativePieHeroPresentationDom, {
        presentation: { title: en.title, description: en.description },
      }),
    );
    assert.match(html, new RegExp(EN_TITLE));
    assert.match(html, new RegExp(EN_DESCRIPTION));
    assert.doesNotMatch(html, new RegExp(UK_TITLE));

    html = renderToStaticMarkup(
      createElement(InitiativePieHeroPresentationDom, {
        presentation: { title: uk.title, description: uk.description },
      }),
    );
    assert.match(html, new RegExp(UK_TITLE));
    assert.match(html, new RegExp(UK_DESCRIPTION));
  });

  it("compact cards change title with locale and never render description", () => {
    let html = renderToStaticMarkup(
      createElement(InitiativeCompactCardTitleDom, { title: UK_TITLE }),
    );
    assert.match(html, new RegExp(UK_TITLE));
    assert.doesNotMatch(html, /DESCRIPTION/);

    html = renderToStaticMarkup(
      createElement(InitiativeCompactCardTitleDom, { title: EN_TITLE }),
    );
    assert.match(html, new RegExp(EN_TITLE));
    assert.doesNotMatch(html, /DESCRIPTION/);
  });

  it("Overview follows presentation description across locale switches", () => {
    let html = renderToStaticMarkup(
      createElement(InitiativeOverviewDescriptionDom, {
        label: "Overview",
        description: UK_DESCRIPTION,
      }),
    );
    assert.match(html, new RegExp(UK_DESCRIPTION));
    assert.doesNotMatch(html, new RegExp(EN_DESCRIPTION));

    html = renderToStaticMarkup(
      createElement(InitiativeOverviewDescriptionDom, {
        label: "Overview",
        description: EN_DESCRIPTION,
      }),
    );
    assert.match(html, new RegExp(EN_DESCRIPTION));
    assert.doesNotMatch(html, new RegExp(UK_DESCRIPTION));
  });
});

describe("Pack 08I.14B — View Original + control visuals", () => {
  it("Hero resets View Original preference when activeLanguage changes", () => {
    const hero = readWeb(
      "features/public-initiative-experience/components/PublicExperienceHero.tsx",
    );
    assert.match(hero, /setUserPrefersOriginal\(false\)/);
    assert.match(hero, /presentation\?\.activeLanguage/);
  });

  it("View Original translated state uses existing accent/warning surface tokens", () => {
    const css = readWeb("features/language/components/translated-content-view.css");
    assert.match(css, /hu-translated-content__toggle/);
    assert.match(css, /aria-pressed="false"/);
    assert.match(css, /--hu-color-accent/);
    assert.match(css, /--hu-color-warning-soft/);
    assert.doesNotMatch(css, /#fff9ef/);
    assert.match(css, /inset/);

    const tokens = readWeb("design-system/tokens.css");
    assert.match(tokens, /--hu-color-warning-soft:\s*#fff9ef/);
  });

  it("language selector has inset/pressed treatment without yellow fill", () => {
    const css = readWeb("features/language/components/language-selector.css");
    assert.match(css, /inset/);
    assert.doesNotMatch(css, /#fff9ef/);
    assert.doesNotMatch(css, /--hu-color-warning-soft/);
    assert.doesNotMatch(css, /--hu-color-accent/);
  });
});

describe("Pack 08I.14B — wiring regressions", () => {
  it("presentation hook reacts to displayLanguage without remount contract", () => {
    const hook = readWeb(
      "features/public-initiative-experience/use-initiative-public-presentation.ts",
    );
    assert.match(hook, /displayLanguage/);
    assert.match(hook, /setPresentation\(\(previous\) =>/);
    assert.match(hook, /previous\.activeLanguage === displayLanguage/);
  });
});
