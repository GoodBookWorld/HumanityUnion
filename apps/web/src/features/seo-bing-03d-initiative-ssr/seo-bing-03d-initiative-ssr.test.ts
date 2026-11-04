/**
 * SEO-BING-03D — public Initiative server HTML carries the canonical title and
 * full description from the anonymous public projection while the
 * credentialed client experience loads.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { CanonicalInitiativeExperienceLoader } from "../public-initiative-experience/components/CanonicalInitiativeExperienceLoader.js";

(globalThis as { React?: typeof React }).React = React;

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const PAGE = readWeb("app/initiatives/public/[initiativeId]/page.tsx");
const LOADER = readWeb(
  "features/public-initiative-experience/components/CanonicalInitiativeExperienceLoader.tsx",
);

const SUMMARY = {
  title: "Clean water for Riverside <community>",
  description:
    "Restore the river banks & build two public wells.\nEvery household gets safe drinking water.",
};

async function renderLoader(
  locale: string,
  props: Partial<React.ComponentProps<typeof CanonicalInitiativeExperienceLoader>> = {},
): Promise<{ html: string; loadingText: string }> {
  const loaded = await loadUiMessagesForLocale(locale);
  const messages = loaded.messages as {
    initiativeExperience: { common: { loadingExperience: string } };
  };
  const html = renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale,
        messages: loaded.messages,
        timeZone: "UTC",
      } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(CanonicalInitiativeExperienceLoader, {
        initiativeId: "riverside-water",
        ...props,
      }),
    ),
  );
  return { html, loadingText: messages.initiativeExperience.common.loadingExperience };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function count(haystack: string, pattern: RegExp): number {
  return (haystack.match(pattern) ?? []).length;
}

describe("SEO-BING-03D — Initiative server HTML", () => {
  it("1. loading state renders the public title as the only h1 plus the full description", async () => {
    const { html, loadingText } = await renderLoader("en", { initialPublicSummary: SUMMARY });

    assert.equal(count(html, /<h1\b/g), 1);
    assert.match(html, /<h1 id="pie-hero-title" class="pie-hero__title">/);
    assert.ok(html.includes(escapeHtml(SUMMARY.title)), "escaped title in h1");
    assert.ok(html.includes(escapeHtml(SUMMARY.description)), "full description");
    assert.match(html, /class="pie-hero__description"/);
    assert.ok(html.includes(`<p role="status">${escapeHtml(loadingText)}</p>`));
    assert.equal(html.includes("<community>"), false, "content is text-escaped");
    assert.equal(
      count(html, /hidden|display:\s*none|aria-hidden/g),
      0,
      "no hidden SEO-only markup",
    );
  });

  it("2. without public data the placeholder is unchanged", async () => {
    const { html, loadingText } = await renderLoader("en");

    assert.equal(
      html,
      `<main class="pie-page"><p role="status">${escapeHtml(loadingText)}</p></main>`,
    );
  });

  it("3. empty public title keeps the placeholder", async () => {
    const { html } = await renderLoader("en", {
      initialPublicSummary: { title: "", description: "Orphan description" },
    });

    assert.equal(count(html, /<h1\b/g), 0);
    assert.equal(html.includes("Orphan description"), false);
  });

  it("4. Ukrainian interface keeps original-language content and localized status", async () => {
    const { html, loadingText } = await renderLoader("uk", {
      initialPublicSummary: SUMMARY,
      initialPresentation: { title: "Чиста вода", description: "Перекладений опис" },
    });

    assert.ok(html.includes(escapeHtml(SUMMARY.title)));
    assert.equal(html.includes("Чиста вода"), false, "translated seed is not server HTML");
    const english = await renderLoader("en");
    assert.ok(html.includes(escapeHtml(loadingText)));
    assert.notEqual(loadingText, english.loadingText);
  });

  it("5. page builds the summary from the anonymous public projection only", () => {
    assert.match(
      PAGE,
      /initialPublicSummary = \{\s*title: initiative\.title,\s*description: selectInitiativeDetailDescription\(initiative\.description\),\s*\}/,
    );
    assert.match(PAGE, /initialPublicSummary=\{initialPublicSummary\}/);
    assert.match(PAGE, /initialPublicSummary = undefined;/);
    assert.equal(PAGE.includes("presentationSeed.title"), false);
    assert.equal(PAGE.includes("getPublicInitiativeExperience"), false);
    assert.equal(/\/experience[`"']/.test(PAGE), false);
    assert.equal(PAGE.includes("next/headers"), false);
    assert.equal(/cookies\(|Cookie/.test(PAGE), false);
  });

  it("6. loader keeps client fetches, state machine and single hero mount", () => {
    assert.match(LOADER, /useState\(true\)/);
    assert.match(LOADER, /getPublicInitiativeExperience\(initiativeId\)/);
    assert.match(LOADER, /getInitiativeOwnerAccess\(initiativeId\)/);
    assert.equal(count(LOADER, /<InitiativePieHeroPresentationDom\b/g), 1);
    const loadingBranch = LOADER.slice(
      LOADER.indexOf("if (loading) {"),
      LOADER.indexOf("if (unavailable) {"),
    );
    assert.match(
      loadingBranch,
      /<InitiativePieHeroPresentationDom presentation=\{initialPublicSummary\} \/>/,
    );
    assert.match(loadingBranch, /common\.loadingExperience/);
  });
});
