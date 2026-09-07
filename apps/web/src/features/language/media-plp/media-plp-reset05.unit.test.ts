/**
 * RESET 05 — country Initiative rail semantic ownership + gap detection.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { CountryInitiativeRailCard } from "../../country-experience/components/CountryInitiativeRailCard.js";
import { CountryElectionRailCard } from "../../country-experience/components/CountryElectionRailCard.js";
import {
  assertNoCountryInitiativeRailSemanticGaps,
  evaluateCountryInitiativeRailSemanticGaps,
  evaluateReset05SemanticGaps,
} from "../plp-semantic-gap/index.js";
import { loadUiMessagesForLocale } from "../../i18n/load-ui-messages.js";

(globalThis as { React?: typeof React }).React = React;

function sampleCard(): WorldInitiativeCardProjection {
  return {
    initiativeId: "init-ua-1",
    title: "Clean Rivers",
    summary: "Summary",
    activityArea: "Environment and Climate",
    geographyLabel: "Kyiv, Ukraine",
    countryCode: "UA",
    regionCode: "UA-30",
    publicInitiativeHref: "/initiatives/public/init-ua-1",
    publishedAt: "2029-01-01T00:00:00.000Z",
    publicStatus: "Active",
  };
}

async function renderWithIntl(
  locale: string,
  node: React.ReactElement,
): Promise<string> {
  const loaded = await loadUiMessagesForLocale(locale);
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      messages: loaded.messages,
      timeZone: "UTC",
      children: node,
    } as React.ComponentProps<typeof NextIntlClientProvider>),
  );
}

describe("RESET 05 — country Initiative rail meta ownership", () => {
  it("meta has activityArea + geography semantic ownership (uk)", async () => {
    const html = await renderWithIntl(
      "uk",
      createElement(CountryInitiativeRailCard, { initiative: sampleCard() }),
    );
    assert.match(html, /country-initiative-rail-card__meta/);
    assert.match(html, /data-hu-semantic-path="activityArea"/);
    assert.match(html, /data-hu-semantic-path="geographyLabel"/);
    assert.match(html, /data-hu-semantic-owner="UI_DICTIONARY"/);
    assert.match(html, /data-hu-semantic-owner="GEOGRAPHY"/);
    assert.match(html, /data-hu-plp-adapter="initiative_lifecycle"/);
    assert.doesNotMatch(html, /DOMAIN_NOT_YET_MIGRATED/);
    const report = evaluateCountryInitiativeRailSemanticGaps({
      html,
      locale: "uk",
    });
    assertNoCountryInitiativeRailSemanticGaps(report);
  });

  it("election rail geography owned; same Initiative adapter", async () => {
    const html = await renderWithIntl(
      "uk",
      createElement(CountryElectionRailCard, { initiative: sampleCard() }),
    );
    assert.match(html, /data-hu-semantic-path="geographyLabel"/);
    assert.match(html, /data-hu-plp-adapter="initiative_lifecycle"/);
    assert.match(html, /data-hu-lifecycle-profile="public_choice"/);
  });

  it("intentionally unowned meta fails gap acceptance", () => {
    const broken = `<article class="country-initiative-rail-card">
      <p class="country-initiative-rail-card__meta">Environment · Kyiv, Ukraine</p>
    </article>`;
    const report = evaluateCountryInitiativeRailSemanticGaps({
      html: broken,
      locale: "uk",
    });
    assert.equal(report.ok, false);
    assert.ok(report.findings.some((f) => f.kind === "UNOWNED_META"));

    const combined = evaluateReset05SemanticGaps({ html: broken, locale: "uk" });
    assert.equal(combined.ok, false);
  });

  it("title is PLP_ENTITY owned without CT overlay", async () => {
    const html = await renderWithIntl(
      "uk",
      createElement(CountryInitiativeRailCard, {
        initiative: sampleCard(),
        plpPresentation: {
          mode: "PUBLISHED_LOCALIZED",
          presentation: { title: "[uk] Clean Rivers", summary: "[uk] Summary" },
        },
      }),
    );
    assert.match(html, /\[uk\] Clean Rivers/);
    assert.match(html, /data-hu-semantic-path="title"/);
    assert.match(html, /data-hu-semantic-result="PUBLISHED_LOCALIZED"/);
  });
});
