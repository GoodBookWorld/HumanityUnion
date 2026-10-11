/**
 * HU-INIT-04A — a blocked election must not render a public card or detail link.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { CountryElectionRailCard } from "./components/CountryElectionRailCard.js";

(globalThis as { React?: typeof React }).React = React;

function electionCard(blocked: boolean): WorldInitiativeCardProjection {
  const initiativeId = blocked ? "blocked-election" : "open-election";
  return {
    initiativeId,
    title: blocked ? "Blocked Election" : "Open Election",
    summary: "Summary",
    activityArea: "Governance",
    geographyLabel: "Canada",
    publicInitiativeHref: `/initiatives/public/${initiativeId}`,
    publishedAt: "2026-01-01T00:00:00.000Z",
    publicStatus: "Active",
    lifecycleProfile: "PUBLIC_CHOICE",
    ...(blocked ? { administrativelyBlocked: true } : {}),
  };
}

async function renderCard(blocked: boolean): Promise<string> {
  const loaded = await loadUiMessagesForLocale("en");
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale: "en",
        messages: loaded.messages,
        timeZone: "UTC",
      } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(CountryElectionRailCard, { initiative: electionCard(blocked) }),
    ),
  );
}

describe("HU-INIT-04A country election rail", () => {
  it("renders an open election card and no card for an administratively blocked election", async () => {
    const openHtml = await renderCard(false);
    const blockedHtml = await renderCard(true);

    assert.match(openHtml, /\/initiatives\/public\/open-election/);
    assert.match(openHtml, /Open Election/);
    assert.equal(blockedHtml, "");
    assert.doesNotMatch(blockedHtml, /blocked-election/);
    assert.doesNotMatch(blockedHtml, /Unavailable — administratively blocked/);
  });
});
