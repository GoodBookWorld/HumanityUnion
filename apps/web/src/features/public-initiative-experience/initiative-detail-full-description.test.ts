/**
 * Initiative Detail shows the stored description in the header and Overview.
 * hero.summary remains a separate excerpt for previews.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;
import { NextIntlClientProvider } from "next-intl";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { PublicExperienceHero } from "./components/PublicExperienceHero.js";
import { InitiativeOverviewDescriptionDom } from "./initiative-presentation-dom.js";
import { selectInitiativePublicPresentation } from "./initiative-public-presentation.js";
import { resolveInitiativeDetailPresentation } from "./resolve-initiative-detail-presentation.js";
import { selectInitiativeDetailDescription } from "./select-initiative-detail-description.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

const TITLE = "Community water initiative";
const FULL_DESCRIPTION = `${"The complete initiative description remains readable. ".repeat(12)}End.`;
const SUMMARY = `${FULL_DESCRIPTION.slice(0, 200).trimEnd()}…`;

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function renderHero(input: {
  readonly locale: string;
  readonly messages: React.ComponentProps<typeof NextIntlClientProvider>["messages"];
  readonly summary: string;
  readonly presentation: React.ComponentProps<typeof PublicExperienceHero>["presentation"];
}): string {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale: input.locale,
        messages: input.messages,
      } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(PublicExperienceHero, {
        title: TITLE,
        summary: input.summary,
        meta: [],
        presentation: input.presentation,
      }),
    ),
  );
}

function ruleBody(css: string, selector: string): string {
  const pattern = new RegExp(`${selector}\\s*\\{([^}]*)\\}`, "g");
  return [...css.matchAll(pattern)].map((match) => match[1] ?? "").join("\n");
}

describe("Initiative Detail full description", () => {
  it("uses the stored description when the summary is shorter than 220 characters of meaning", () => {
    assert.ok(FULL_DESCRIPTION.length > 220);
    assert.ok(SUMMARY.length < FULL_DESCRIPTION.length);
    assert.equal(selectInitiativeDetailDescription(FULL_DESCRIPTION), FULL_DESCRIPTION);
    assert.notEqual(selectInitiativeDetailDescription(FULL_DESCRIPTION), SUMMARY);
    assert.equal(SUMMARY.endsWith("…"), true);
  });

  it("renders the full description in the hero and Overview for the original language", async () => {
    const messages = (await loadUiMessagesForLocale("en")).messages;
    const presentation = selectInitiativePublicPresentation({
      canonical: { title: TITLE, description: selectInitiativeDetailDescription(FULL_DESCRIPTION) },
      presentationMode: "original",
      activeLanguage: "en",
      originalLanguage: "en",
    });

    const hero = renderHero({
      locale: "en",
      messages,
      summary: SUMMARY,
      presentation,
    });
    const overview = renderToStaticMarkup(
      createElement(InitiativeOverviewDescriptionDom, {
        label: "Full description",
        description: presentation.description,
      }),
    );

    assert.match(hero, /pie-hero__description/);
    assert.match(hero, new RegExp(FULL_DESCRIPTION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(hero, /…/);
    assert.match(overview, /pie-overview__section/);
    assert.match(overview, new RegExp(FULL_DESCRIPTION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(presentation.originalDescription, FULL_DESCRIPTION);
  });

  it("renders the full translated description and keeps the full original", async () => {
    const translated = `${"Die vollständige Initiativbeschreibung bleibt lesbar. ".repeat(12)}Ende.`;
    assert.ok(translated.length > 220);
    const messages = (await loadUiMessagesForLocale("de")).messages;
    const resolved = await resolveInitiativeDetailPresentation(
      {
        initiativeId: "initiative-long-description",
        canonical: {
          title: TITLE,
          description: selectInitiativeDetailDescription(FULL_DESCRIPTION),
        },
        readingContext: {
          ready: true,
          readingLanguage: "de",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "preferred_translation",
          content: { title: "Titel", description: translated },
          activeLanguage: "de",
          originalLanguage: "en",
          originalContent: { title: TITLE, description: FULL_DESCRIPTION },
          translation: null,
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: true,
        }),
        generateContentTranslation: async () => {
          throw new Error("detail display must not generate a translation");
        },
      },
    );
    const presentation = selectInitiativePublicPresentation({
      canonical: { title: TITLE, description: resolved.originalDescription },
      translated: { title: resolved.title, description: resolved.description },
      presentationMode: "translated",
      activeLanguage: "de",
      originalLanguage: "en",
      isMachineTranslated: true,
      canViewOriginal: true,
      canViewTranslation: true,
    });

    const hero = renderHero({
      locale: "de",
      messages,
      summary: SUMMARY,
      presentation,
    });
    const overview = renderToStaticMarkup(
      createElement(InitiativeOverviewDescriptionDom, {
        label: "Vollständige Beschreibung",
        description: presentation.description,
      }),
    );

    assert.equal(resolved.description, translated);
    assert.equal(resolved.originalDescription, FULL_DESCRIPTION);
    assert.match(hero, /pie-hero__description/);
    assert.match(hero, new RegExp(translated.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(overview, new RegExp(translated.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(SUMMARY.endsWith("…"), true);
    assert.notEqual(SUMMARY, translated);
  });

  it("keeps the summary for the share preview and does not clamp the detail text", () => {
    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    const css = readWeb("features/public-initiative-experience/public-initiative-experience.css");

    assert.match(page, /selectInitiativeDetailDescription\(experience\.initiative\.description\)/);
    assert.doesNotMatch(page, /hero\.summary\s*\|\|\s*experience\.initiative\.description/);
    assert.match(center, /presentationDescription \|\| initiative\.description/);
    assert.match(
      center,
      /experience\.hero\.summary\.trim\(\) \|\| experience\.initiative\.description/,
    );
    assert.doesNotMatch(center, /presentationDescription\?\.trim\(\)\s*\|\|/);

    for (const selector of ["\\.pie-hero__description", "\\.pie-overview__section p"]) {
      const body = ruleBody(css, selector);
      assert.notEqual(body.trim(), "");
      assert.doesNotMatch(body, /line-clamp|max-height|overflow\s*:\s*hidden|text-overflow/);
    }
  });
});
