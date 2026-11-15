/**
 * HU-LC-05C.4C.7E.6C — Petition Status links identify the Petition, and the
 * Petition Subject labels name the Petition's own title and summary.
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

import { isPublicReaderWebUiRequiredPath, type PublicPetitionRecord } from "@hu/types";

import {
  publicPetitionHref,
  readRequestedPetitionId,
  withPetitionQuery,
} from "../initiative-petition-lifecycle/petition-viewer-selection";
import { PetitionWorkspace } from "./components/PetitionWorkspace";

(globalThis as { React?: typeof React }).React = React;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(HERE, "../..");
const LOCALES = ["en", "uk", "ar", "zh-Hant"] as const;
type Locale = (typeof LOCALES)[number];

const INITIATIVE_ID = "initiative-1794347295653";
const PETITION_A = "petition-initiative-petition-draft-7ea30291-6a87-4936-9ed2-0ae056e8bccd";
const PETITION_B = "petition-initiative-petition-draft-81ad281a-e96f-4ec6-8153-6c4f489c7838";
const TITLE_KEY = "author.petition.fields.title";
const SUMMARY_KEY = "author.petition.public.status.subject.petitionSummary";

const readWeb = (relative: string) => readFileSync(path.join(WEB_SRC, relative), "utf8");
const catalog = (locale: Locale) =>
  JSON.parse(readWeb(`features/i18n/messages/${locale}.json`)) as AbstractIntlMessages;

function message(locale: Locale, key: string): string {
  const value = `initiativeExperience.${key}`
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalog(locale));
  return typeof value === "string" ? value : "";
}

function petition(petitionId: string, shareLinkUrl: string | null): PublicPetitionRecord {
  return {
    petitionId,
    collectiveDecisionId: `decision-${petitionId}`,
    status: "Open",
    createdAt: "2026-11-10T00:00:00.000Z",
    updatedAt: "2026-11-10T00:00:00.000Z",
    subject: {
      decisionId: `decision-${petitionId}`,
      initiativeId: INITIATIVE_ID,
      title: `Title of ${petitionId.slice(-8)}`,
      summary: `Summary of ${petitionId.slice(-8)}`,
    },
    policy: {
      endorsementPeriod: { opensAt: null, closesAt: null },
      withdrawalPolicy: { withdrawalPermitted: true, withdrawalPolicyDescription: null },
    },
    shareLink: shareLinkUrl ? { url: shareLinkUrl, createdAt: "2026-11-10T00:00:00.000Z" } : null,
    supportMetrics: {
      totalSignatures: 3,
      participantSignatures: 3,
      dailyActivity: [],
      supportThresholdStatus: { thresholdDefined: false, thresholdReached: false, currentCount: 3, thresholdCount: null },
    },
    outcome: null,
  } as unknown as PublicPetitionRecord;
}

function renderStatus(locale: Locale, record: PublicPetitionRecord) {
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
        initialPetition: record,
        collectiveDecision: null,
        initiative: null,
        collaborativeAnalysis: null,
      }),
    ),
  );
  return { html, errors };
}

const STORED_SHARE_LINK = `/initiatives/public/${INITIATIVE_ID}#petition`;
const expectedHref = (petitionId: string) =>
  `/initiatives/public/${INITIATIVE_ID}?petition=${petitionId}#petition`;

describe("HU-LC-05C.4C.7E.6C — Petition-specific Status links", () => {
  it("Petitions A and B get different public Petition URLs with query before hash", () => {
    assert.equal(publicPetitionHref(INITIATIVE_ID, PETITION_A), expectedHref(PETITION_A));
    assert.equal(publicPetitionHref(INITIATIVE_ID, PETITION_B), expectedHref(PETITION_B));
    assert.notEqual(publicPetitionHref(INITIATIVE_ID, PETITION_A), publicPetitionHref(INITIATIVE_ID, PETITION_B));
    for (const petitionId of [PETITION_A, PETITION_B, "pet.01:x_y"]) {
      const url = new URL(publicPetitionHref("init 1", petitionId), "https://hu.example");
      assert.equal(url.pathname, "/initiatives/public/init%201");
      assert.equal(readRequestedPetitionId(url.search), petitionId);
      assert.equal(url.hash, "#petition");
    }
  });

  it("keeps existing query values, origin and hash; replaces a stale petition value", () => {
    assert.equal(
      withPetitionQuery("/initiatives/public/i?ref=x&tab=2#petition", PETITION_A),
      `/initiatives/public/i?ref=x&tab=2&petition=${PETITION_A}#petition`,
    );
    assert.equal(
      withPetitionQuery("/initiatives/public/i?petition=old#petition", "new-id"),
      "/initiatives/public/i?petition=new-id#petition",
    );
    assert.equal(
      withPetitionQuery("https://hu.example/initiatives/public/i", "p"),
      "https://hu.example/initiatives/public/i?petition=p#petition",
    );
  });

  it("the Share Link and Public Petition links on each Status page name that Petition", () => {
    for (const locale of LOCALES) {
      const a = renderStatus(locale, petition(PETITION_A, STORED_SHARE_LINK));
      const b = renderStatus(locale, petition(PETITION_B, STORED_SHARE_LINK));
      assert.deepEqual([...a.errors, ...b.errors], [], locale);
      for (const [{ html }, own, other] of [
        [a, PETITION_A, PETITION_B],
        [b, PETITION_B, PETITION_A],
      ] as const) {
        assert.ok(
          html.includes(`class="petition-status__share-link"`) &&
            html.includes(`href="${expectedHref(own)}"`),
          `${locale} share link`,
        );
        assert.ok(html.includes(`href="${expectedHref(own)}"`), `${locale} Public Petition link`);
        assert.ok(!html.includes(`?petition=${other}`), `${locale} mentions the other Petition`);
        assert.ok(!html.includes(`${INITIATIVE_ID}#petition`), `${locale} Initiative-only link remains`);
      }
    }
  });

  it("without a share link the Status page keeps its existing placeholder", () => {
    const { html } = renderStatus("en", petition(PETITION_A, null));
    assert.ok(html.includes(message("en", "author.petition.public.status.overview.notAvailable")));
  });

  it("the page footer link and RelatedLinks use the shared helper; stored shareLink is not rewritten", () => {
    const page = readWeb("app/petitions/[petitionId]/page.tsx");
    assert.match(page, /href=\{publicPetitionHref\(petition\.subject\.initiativeId, petition\.petitionId\)\}/);
    assert.doesNotMatch(page, /encodeURIComponent\(petition\.subject\.initiativeId\)\}#petition/);
    assert.match(
      readWeb("features/petition/components/RelatedLinks.tsx"),
      /href=\{publicPetitionHref\(initiativeId, petitionId\)\}/,
    );
    const status = readWeb("features/petition/components/PetitionStatus.tsx");
    assert.match(status, /publicPetitionHref\(petition\.subject\.initiativeId, petition\.petitionId\)/);
    assert.doesNotMatch(status, /shareLink\.url|shareLink\s*=/);
  });
});

describe("HU-LC-05C.4C.7E.6C — Petition Subject labels", () => {
  it("labels the Petition's own title and summary in every language", () => {
    for (const locale of LOCALES) {
      const { html } = renderStatus(locale, petition(PETITION_A, STORED_SHARE_LINK));
      const subject = html.slice(html.indexOf('class="petition-subject"'));
      const field = (label: string, value: string) =>
        `<span class="profile-field__label">${label}</span><span class="profile-field__value" dir="auto">${value}</span>`;
      assert.ok(subject.includes(field(message(locale, TITLE_KEY), "Title of 56e8bccd")), `${locale} title`);
      assert.ok(subject.includes(field(message(locale, SUMMARY_KEY), "Summary of 56e8bccd")), `${locale} summary`);
    }
    const en = renderStatus("en", petition(PETITION_A, STORED_SHARE_LINK)).html;
    assert.ok(en.includes(">Petition Title<"));
    assert.ok(en.includes(">Petition Summary<"));
    assert.doesNotMatch(en, />Initiative (Title|Summary)</);
  });

  it("the labels are translated, public-reader required and the stale keys are gone", () => {
    for (const key of [TITLE_KEY, SUMMARY_KEY]) {
      assert.equal(isPublicReaderWebUiRequiredPath(`initiativeExperience.${key}`), true, key);
      for (const locale of LOCALES) {
        assert.ok(message(locale, key).trim(), `${locale} ${key}`);
        if (locale !== "en") {
          assert.notEqual(message(locale, key), message("en", key), `${locale} ${key} is English`);
        }
      }
    }
    for (const locale of LOCALES) {
      for (const stale of ["initiativeTitle", "initiativeSummary"]) {
        assert.equal(message(locale, `author.petition.public.status.subject.${stale}`), "", `${locale} ${stale}`);
      }
    }
    assert.doesNotMatch(readWeb("features/petition/components/PetitionSubject.tsx"), /initiativeTitle|initiativeSummary/);
  });

  it("packaged API catalogs are byte-identical to the Web catalogs", () => {
    for (const locale of LOCALES) {
      const packaged = readFileSync(
        path.resolve(WEB_SRC, `../../api/assets/packaged-web-ui-catalogs/${locale}.json`),
        "utf8",
      );
      assert.equal(packaged, readWeb(`features/i18n/messages/${locale}.json`), locale);
    }
  });

  it("signing and editing are unchanged", () => {
    assert.match(
      readWeb("features/petition/components/SignatureSection.tsx"),
      /signPetitionAsCurrentParticipant\(petition\.petitionId, "Community"\)/,
    );
    const page = readWeb("app/petitions/[petitionId]/page.tsx");
    assert.match(page, /<PetitionDocumentViews[\s\S]*?<PetitionWorkspace\s+initialPetition=\{petition\}/);
    assert.match(page, /readPetitionDocumentView\(\(await searchParams\)\[PETITION_VIEW_QUERY_PARAM\]\)/);
  });
});
