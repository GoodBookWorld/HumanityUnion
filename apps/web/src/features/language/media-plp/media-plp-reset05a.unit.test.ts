/**
 * RESET 05A — Initiative live consumer authority closure acceptance.
 * No Gemini / materialize / PLP flag enablement.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { CountryElectionRailCard } from "../../country-experience/components/CountryElectionRailCard.js";
import { resolveCountryInitiativeRailMeta } from "../../country-experience/resolve-country-initiative-rail-meta.js";
import { formatInitiativePublicGeography } from "../../public-initiative-experience/format-initiative-public-geography.js";
import { resolveLifecycleStageDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n.js";
import { loadUiMessagesForLocale } from "../../i18n/load-ui-messages.js";
import {
  evaluateCountryInitiativeRailSemanticGaps,
  evaluateElectionSidebarSemanticGaps,
  evaluateLifecycleStageLabelSemanticGaps,
  evaluateReset05SemanticGaps,
} from "../plp-semantic-gap/index.js";

(globalThis as { React?: typeof React }).React = React;

function electionCard(
  overrides: Partial<WorldInitiativeCardProjection> = {},
): WorldInitiativeCardProjection {
  return {
    initiativeId: "init-election-1",
    title: "Kelowna Mayor Election",
    summary: "Summary",
    activityArea: "Democracy and Governance",
    geographyLabel: "British Columbia · Canada",
    countryCode: "CA",
    regionCode: "CA-BC",
    publicInitiativeHref: "/initiatives/public/init-election-1",
    publishedAt: "2029-01-01T00:00:00.000Z",
    publicStatus: "Active",
    lifecycleProfile: "PUBLIC_CHOICE",
    electionVotingStatus: "OPEN",
    ...overrides,
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

describe("RESET 05A — Initiative live consumer authority closure", () => {
  it("1–2: geography specificity preserved; World not used when codes exist", async () => {
    const initiative = electionCard();
    const loaded = await loadUiMessagesForLocale("uk");
    const tExperience = ((key: string) => {
      // Minimal translator for unit path — real card uses next-intl.
      return key;
    }) as Parameters<typeof resolveCountryInitiativeRailMeta>[0]["tExperience"];

    const meta = resolveCountryInitiativeRailMeta({
      initiative,
      locale: "uk",
      tExperience,
    });
    assert.equal(meta.geographyCollapsedToWorld, false);
    assert.notEqual(meta.geographyLabel, "World");
    assert.match(meta.geographyLabel, /Canada|Канада|British|Британ/i);

    const detailGeo = formatInitiativePublicGeography({
      locale: "uk",
      countryCode: "CA",
      regionCode: "CA-BC",
      lifecycleProfile: "PUBLIC_CHOICE",
      communityAssociation: "Community Mayor Election — Staging Test",
    });
    assert.doesNotMatch(detailGeo, /Community Mayor Election/);
    assert.notEqual(detailGeo, "World");
    // Rail and detail share GEOGRAPHY codes authority (same region·country shape).
    assert.ok(!meta.geographyLabel.includes("Community Mayor"));

    const html = await renderWithIntl(
      "uk",
      createElement(CountryElectionRailCard, { initiative }),
    );
    assert.doesNotMatch(html, />\s*World\s*</);
    const report = evaluateCountryInitiativeRailSemanticGaps({
      html,
      locale: "uk",
      hasSpecificGeographyCodes: true,
    });
    assert.equal(report.ok, true, JSON.stringify(report.findings));
    void loaded;
  });

  it("regression: World collapse detected when codes exist", () => {
    const broken = `<article class="country-initiative-rail-card">
      <p class="country-initiative-rail-card__meta">
        <span data-hu-semantic-node="1" data-hu-semantic-path="geographyLabel" data-hu-semantic-owner="GEOGRAPHY">World</span>
      </p>
    </article>`;
    const report = evaluateCountryInitiativeRailSemanticGaps({
      html: broken,
      locale: "uk",
      hasSpecificGeographyCodes: true,
    });
    assert.equal(report.ok, false);
    assert.ok(
      report.findings.some((f) => f.kind === "GEOGRAPHY_COLLAPSED_TO_WORLD"),
    );
  });

  it("3: PUBLIC_CHOICE election name is not mixed into geography", () => {
    const polluted = formatInitiativePublicGeography({
      locale: "en",
      countryCode: "CA",
      regionCode: "CA-BC",
      lifecycleProfile: "STANDARD",
      communityAssociation: "Community Mayor Election — Staging Test",
    });
    // STANDARD may still use association as city — PUBLIC_CHOICE must not.
    const election = formatInitiativePublicGeography({
      locale: "en",
      countryCode: "CA",
      regionCode: "CA-BC",
      lifecycleProfile: "PUBLIC_CHOICE",
      communityAssociation: "Community Mayor Election — Staging Test",
    });
    assert.equal(election, "British Columbia · Canada");
    assert.notEqual(election, polluted);
  });

  it("4: lifecycle stage labels resolve via UI dictionary (not raw English)", async () => {
    const loaded = await loadUiMessagesForLocale("uk");
    const t = ((key: string) => {
      const parts = key.split(".");
      let cur: unknown = (loaded.messages as Record<string, unknown>).initiativeExperience;
      for (const part of parts) {
        if (cur && typeof cur === "object" && part in (cur as object)) {
          cur = (cur as Record<string, unknown>)[part];
        } else {
          return key;
        }
      }
      return typeof cur === "string" ? cur : key;
    }) as Parameters<typeof resolveLifecycleStageDisplayLabel>[1];

    const label = resolveLifecycleStageDisplayLabel(
      "collective_decision",
      t,
      "Collective Decision",
    );
    assert.notEqual(label, "Collective Decision");
    assert.notEqual(label, "collective_decision");

    const rawHtml = `<section class="pie-current-stage">
      <p class="pie-current-stage__value">Collective Decision</p>
    </section>`;
    const gap = evaluateLifecycleStageLabelSemanticGaps({
      html: rawHtml,
      locale: "uk",
    });
    assert.equal(gap.ok, false);
    assert.ok(gap.findings.some((f) => f.kind === "RAW_LIFECYCLE_STAGE_LABEL"));
  });

  it("5: sidebar election name ownership bypass is detected", () => {
    const bypass = `<section class="pie-election">
      <p class="pie-election__name">Community Mayor Election — Staging Test</p>
    </section>`;
    const report = evaluateElectionSidebarSemanticGaps({
      html: bypass,
      locale: "uk",
    });
    assert.equal(report.ok, false);
    assert.ok(
      report.findings.some((f) => f.kind === "SIDEBAR_ELECTION_NAME_BYPASS"),
    );

    const owned = `<section class="pie-election">
      <p class="pie-election__name" data-hu-semantic-node="1" data-hu-semantic-owner="PLP_ENTITY" data-hu-semantic-path="electionName" data-hu-semantic-result="CANONICAL_FALLBACK">Community Mayor Election — Staging Test</p>
    </section>`;
    assert.equal(
      evaluateElectionSidebarSemanticGaps({ html: owned, locale: "uk" }).ok,
      true,
    );
  });

  it("6: rail title remains PLP-owned CANONICAL_FALLBACK when flag off", async () => {
    const html = await renderWithIntl(
      "uk",
      createElement(CountryElectionRailCard, {
        initiative: electionCard(),
      }),
    );
    assert.match(html, /Kelowna Mayor Election/);
    assert.match(html, /data-hu-semantic-path="title"/);
    assert.match(html, /data-hu-semantic-owner="PLP_ENTITY"/);
    assert.match(html, /data-hu-semantic-result="CANONICAL_FALLBACK"/);
    assert.doesNotMatch(html, /DOMAIN_NOT_YET_MIGRATED/);
  });

  it("7: flag ON fixture path resolves PUBLISHED_LOCALIZED title", async () => {
    const html = await renderWithIntl(
      "uk",
      createElement(CountryElectionRailCard, {
        initiative: electionCard(),
        plpPresentation: {
          mode: "PUBLISHED_LOCALIZED",
          presentation: { title: "[uk] Kelowna Mayor Election" },
        },
      }),
    );
    assert.match(html, /\[uk\] Kelowna Mayor Election/);
    assert.match(html, /data-hu-semantic-result="PUBLISHED_LOCALIZED"/);
  });

  it("9: combined gap detector catches observed residual classes", () => {
    const broken = `
      <article class="country-initiative-rail-card">
        <h3 class="country-initiative-rail-card__title">Kelowna Mayor Election</h3>
        <p class="country-initiative-rail-card__meta">World</p>
      </article>
      <p class="pie-current-stage__value">Collective Decision</p>
      <p class="pie-election__name">Community Mayor Election — Staging Test</p>
    `;
    const report = evaluateReset05SemanticGaps({
      html: broken,
      locale: "uk",
      hasSpecificGeographyCodes: true,
    });
    assert.equal(report.ok, false);
    const kinds = new Set(report.findings.map((f) => f.kind));
    assert.ok(kinds.has("UNOWNED_META") || kinds.has("GEOGRAPHY_COLLAPSED_TO_WORLD"));
    assert.ok(kinds.has("RAW_LIFECYCLE_STAGE_LABEL"));
    assert.ok(kinds.has("SIDEBAR_ELECTION_NAME_BYPASS"));
    assert.ok(kinds.has("TITLE_OWNERSHIP_BYPASS"));
  });
});
