/**
 * HU-ELECTION-UI-01 — compact Country Election cards.
 * Presentation only: image frame, hierarchy, and the public block rule.
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

import type { WorldInitiativeCardProjection } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { CountryElectionRailCard } from "./components/CountryElectionRailCard.js";

(globalThis as { React?: typeof React }).React = React;

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const LONG_TITLE =
  "Elección pública para la protección de los recursos de agua potable en la región metropolitana y las comunidades vecinas";
const PHOTO = "https://cdn.example.test/elections/watershed-photo.jpg";

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function electionCard(
  overrides: Partial<WorldInitiativeCardProjection> = {},
): WorldInitiativeCardProjection {
  return {
    initiativeId: "watershed-election",
    title: "Watershed election",
    summary: "Summary that must not become the card body",
    activityArea: "Environment",
    geographyLabel: "Canada · Ontario",
    publicInitiativeHref: "/initiatives/public/watershed-election",
    publishedAt: "2026-01-01T00:00:00.000Z",
    publicStatus: "Active",
    lifecycleProfile: "PUBLIC_CHOICE",
    electionVotingStatus: "OPEN",
    candidateCount: 4,
    ...overrides,
  };
}

async function renderCard(initiative: WorldInitiativeCardProjection): Promise<string> {
  const loaded = await loadUiMessagesForLocale("en");
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale: "en",
        messages: loaded.messages,
        timeZone: "UTC",
      } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(CountryElectionRailCard, { initiative }),
    ),
  );
}

function electionCss(): string {
  return readWeb("features/country-experience/country-experience-dynamic.css");
}

describe("HU-ELECTION-UI-01 country election card layout", () => {
  it("renders a real image inside the locked media frame", async () => {
    const html = await renderCard(electionCard({ imageUrl: PHOTO }));

    assert.match(html, /country-election-rail-card/);
    assert.match(html, /country-initiative-rail-card__media/);
    assert.match(html, /class="initiative-image"/);
    assert.match(html, new RegExp(PHOTO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(html, /country-election-rail-card__fallback/);
    assert.match(html, /href="\/initiatives\/public\/watershed-election"/);
  });

  it("renders the shared fallback illustration when no image is stored", async () => {
    const html = await renderCard(electionCard());

    assert.match(html, /country-election-rail-card__fallback/);
    assert.match(html, /src="\/images\/initiatives\/initiative-default\.webp"/);
    assert.match(html, /aria-hidden="true"/);
    assert.doesNotMatch(html, /class="initiative-image"/);
  });

  it("covers real images and contains fallback art inside one aspect ratio", () => {
    const css = electionCss();

    assert.match(css, /\.country-election-rail-card \.country-initiative-rail-card__media\s*\{[^}]*aspect-ratio:\s*5\s*\/\s*2/);
    assert.match(css, /\.country-election-rail-card \.country-initiative-rail-card__media\s*\{[^}]*overflow:\s*hidden/);
    assert.match(
      css,
      /\.country-election-rail-card \.country-initiative-rail-card__media img[\s\S]*object-fit:\s*cover/,
    );
    assert.match(
      css,
      /img\.country-election-rail-card__fallback\s*\{[^}]*object-fit:\s*contain/,
    );
    assert.doesNotMatch(css, /country-election-rail-card[\s\S]{0,800}object-fit:\s*fill/);
  });

  it("keeps the card content-sized instead of stretching with the carousel row", () => {
    const css = electionCss();

    assert.match(
      css,
      /\.horizontal-rail__slide > a\.country-election-rail-card[\s\S]*height:\s*auto/,
    );
    assert.match(
      css,
      /\.media-horizontal-rail__slide > a\.country-election-rail-card[\s\S]*height:\s*auto/,
    );
    assert.match(
      css,
      /\.country-election-rail-card \.country-initiative-rail-card__body\s*\{[^}]*flex:\s*0\s*0\s*auto/,
    );
    assert.match(
      css,
      /\.country-election-rail-card \.country-initiative-rail-card__footer\s*\{[^}]*margin-top:\s*var\(--hu-space-1/,
    );
    assert.doesNotMatch(
      css,
      /\.country-election-rail-card \.country-initiative-rail-card__footer\s*\{[^}]*margin-top:\s*auto/,
    );
  });

  it("wraps a long translated title without dropping the election details", async () => {
    const html = await renderCard(electionCard({ title: LONG_TITLE }));
    const css = electionCss();

    assert.match(html, /country-initiative-rail-card__title/);
    assert.match(html, new RegExp(LONG_TITLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, /Canada/);
    assert.match(html, /country-initiative-rail-card__status/);
    assert.match(html, /country-initiative-rail-card__cta/);
    assert.match(css, /overflow-wrap:\s*anywhere/);
    assert.match(css, /-webkit-line-clamp:\s*3/);
    assert.match(html, /4 candidates/);
  });

  it("keeps a shorter title clamp and the same image ratio on compact screens", () => {
    const css = electionCss();
    const mobile = css.slice(css.indexOf("@media (max-width: 1024px)"));

    assert.match(mobile, /\.country-election-rail-card \.country-initiative-rail-card__title\s*\{[^}]*-webkit-line-clamp:\s*2/);
    assert.match(mobile, /aspect-ratio:\s*5\s*\/\s*2/);
    assert.match(mobile, /overflow-wrap:\s*anywhere/);
  });

  it("renders no public card or link for an administratively blocked election", async () => {
    const html = await renderCard(
      electionCard({
        initiativeId: "blocked-election",
        title: "Blocked Election",
        publicInitiativeHref: "/initiatives/public/blocked-election",
        administrativelyBlocked: true,
        imageUrl: PHOTO,
      }),
    );

    assert.equal(html, "");
    assert.doesNotMatch(html, /blocked-election/);
    assert.doesNotMatch(html, /Blocked Election/);
  });

  it("leaves carousel navigation on the Country Elections rail", () => {
    const section = readWeb(
      "features/country-experience/components/CountryCivicActionSection.tsx",
    );
    const rail = readWeb("features/civic-media-center/media-rail/media-rail.css");

    assert.match(section, /HuxDiscoverySection/);
    assert.match(
      section,
      /renderItem=\{\(initiative\) => <CountryElectionRailCard initiative=\{initiative\} \/>\}/,
    );
    assert.match(section, /lifecycleProfile=PUBLIC_CHOICE/);
    assert.match(rail, /\.horizontal-rail__slide > \*,[\s\S]*\.media-horizontal-rail__slide > \* \{[^}]*height:\s*100%/);
    assert.match(rail, /scroll-snap-type:\s*x mandatory/);
  });
});
