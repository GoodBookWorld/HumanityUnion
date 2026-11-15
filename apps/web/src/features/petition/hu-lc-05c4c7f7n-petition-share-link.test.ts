/**
 * HU-LC-05C.4C.7F.7N — Petition Status absolute clickable share link.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { NextIntlClientProvider, type AbstractIntlMessages, type IntlError } from "next-intl";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { PublicPetitionRecord } from "@hu/types";

import { resolveAbsoluteCivicShareUrl } from "../civic-share/civic-share.urls";
import { publicPetitionHref } from "../initiative-petition-lifecycle/petition-viewer-selection";
import { PetitionWorkspace } from "./components/PetitionWorkspace";

(globalThis as { React?: typeof React }).React = React;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(HERE, "../..");
const readWeb = (relative: string) => readFileSync(path.join(WEB_SRC, relative), "utf8");
const catalog = (locale: string) =>
  JSON.parse(readWeb(`features/i18n/messages/${locale}.json`)) as AbstractIntlMessages;

const INITIATIVE_ID = "initiative-1794347295653";
const PETITION_ID = "petition-initiative-petition-draft-7ea30291-6a87-4936-9ed2-0ae056e8bccd";
const STORED_SHARE_LINK = `/initiatives/public/${INITIATIVE_ID}#petition`;
const RELATIVE_HREF = publicPetitionHref(INITIATIVE_ID, PETITION_ID);

function petition(): PublicPetitionRecord {
  return {
    petitionId: PETITION_ID,
    collectiveDecisionId: `decision-${PETITION_ID}`,
    status: "Open",
    createdAt: "2026-11-10T00:00:00.000Z",
    updatedAt: "2026-11-10T00:00:00.000Z",
    subject: {
      decisionId: `decision-${PETITION_ID}`,
      initiativeId: INITIATIVE_ID,
      title: "Title",
      summary: "Summary",
    },
    policy: {
      endorsementPeriod: { opensAt: null, closesAt: null },
      withdrawalPolicy: { withdrawalPermitted: true, withdrawalPolicyDescription: null },
    },
    shareLink: { url: STORED_SHARE_LINK, createdAt: "2026-11-10T00:00:00.000Z" },
    supportMetrics: {
      totalSignatures: 3,
      participantSignatures: 3,
      dailyActivity: [],
      supportThresholdStatus: {
        thresholdDefined: false,
        thresholdReached: false,
        currentCount: 3,
        thresholdCount: null,
      },
    },
    outcome: null,
  } as unknown as PublicPetitionRecord;
}

function renderStatus(locale: string) {
  const errors: string[] = [];
  const html = renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale,
        messages: catalog(locale),
        timeZone: "UTC",
        onError: (error: IntlError) => {
          errors.push(error.message);
        },
      } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(PetitionWorkspace, {
        initialPetition: petition(),
        collectiveDecision: null,
        initiative: null,
        collaborativeAnalysis: null,
      }),
    ),
  );
  return { html, errors };
}

describe("HU-LC-05C.4C.7F.7N — Petition Status share link", () => {
  it("renders a clickable anchor with petition deep-link path", () => {
    const { html, errors } = renderStatus("en");
    assert.deepEqual(errors, []);
    assert.match(html, /class="petition-status__share-link"/);
    assert.match(html, new RegExp(`href="${RELATIVE_HREF.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.ok(html.includes(`petition=${PETITION_ID}`));
    assert.ok(html.includes("#petition"));
  });

  it("absolute Staging/Production URLs use current origin helper; no cross-env host", () => {
    const staging = resolveAbsoluteCivicShareUrl(RELATIVE_HREF, "https://staging.huws.org");
    const production = resolveAbsoluteCivicShareUrl(RELATIVE_HREF, "https://huws.org");
    assert.equal(
      staging,
      `https://staging.huws.org${RELATIVE_HREF}`,
    );
    assert.equal(production, `https://huws.org${RELATIVE_HREF}`);
    assert.ok(!staging.includes("https://huws.org/"));
    assert.ok(staging.includes(`petition=${PETITION_ID}`));
    assert.ok(staging.endsWith("#petition") || staging.includes("#petition"));
  });

  it("Status reuses publicPetitionHref; never rewrites stored shareLink.url; copy control present", () => {
    const status = readWeb("features/petition/components/PetitionStatus.tsx");
    assert.match(status, /publicPetitionHref\(petition\.subject\.initiativeId, petition\.petitionId\)/);
    assert.match(status, /resolveAbsoluteCivicShareUrl/);
    assert.match(status, /navigator\.clipboard\.writeText/);
    assert.match(status, /target="_blank"/);
    assert.doesNotMatch(status, /shareLink\.url/);
    assert.match(
      readWeb("features/petition/components/RelatedLinks.tsx"),
      /href=\{publicPetitionHref\(initiativeId, petitionId\)\}/,
    );
  });
});
