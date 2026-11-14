/**
 * HU-LC-05C.4C.7E.7C — Arabic RTL display: authored (original-language) values
 * are direction-isolated, URLs and identifiers are LTR, the Petitions chevron
 * points down/up in both directions, and the Assistant button mirrors in RTL.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { PublicPetitionRecord } from "@hu/types";

import { ProfileField } from "../../components/member/ProfileField";
import { TranslatedContentView } from "../language/components/TranslatedContentView";
import { PetitionReadingTitle } from "./components/PetitionReadingTitle";
import { PetitionSubject } from "./components/PetitionSubject";
import { PetitionWorkspace } from "./components/PetitionWorkspace";

(globalThis as { React?: typeof React }).React = React;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(HERE, "../..");
const readWeb = (relative: string) => readFileSync(path.join(WEB_SRC, relative), "utf8");
const catalog = (locale: "en" | "ar") =>
  JSON.parse(readWeb(`features/i18n/messages/${locale}.json`)) as AbstractIntlMessages;

function render(locale: "en" | "ar", element: ReactElement): string {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages: catalog(locale), timeZone: "UTC" } as React.ComponentProps<
        typeof NextIntlClientProvider
      >,
      element,
    ),
  );
}

const PETITION_ID = "petition-initiative-petition-draft-7ea30291-6a87-4936-9ed2-0ae056e8bccd";
const SUMMARY = "Local validation revision; no applied proposals.";
const SHARE_URL = `/initiatives/public/initiative-1?petition=${PETITION_ID}#petition`;

function petition(): PublicPetitionRecord {
  return {
    petitionId: PETITION_ID,
    collectiveDecisionId: `decision-${PETITION_ID}`,
    status: "Open",
    createdAt: "2026-11-10T00:00:00.000Z",
    updatedAt: "2026-11-10T00:00:00.000Z",
    subject: {
      decisionId: `decision-${PETITION_ID}`,
      initiativeId: "initiative-1",
      title: "Safer School Crossings!",
      summary: SUMMARY,
    },
    policy: {
      endorsementPeriod: { opensAt: null, closesAt: null },
      withdrawalPolicy: { withdrawalPermitted: true, withdrawalPolicyDescription: null },
    },
    shareLink: { url: "/initiatives/public/initiative-1#petition", createdAt: "2026-11-10T00:00:00.000Z" },
    supportMetrics: {
      totalSignatures: 3,
      participantSignatures: 3,
      dailyActivity: [],
      supportThresholdStatus: { thresholdDefined: false, thresholdReached: false, currentCount: 3, thresholdCount: null },
    },
    outcome: null,
  } as unknown as PublicPetitionRecord;
}

const workspace = () =>
  createElement(PetitionWorkspace, {
    initialPetition: petition(),
    collectiveDecision: null,
    initiative: null,
    collaborativeAnalysis: null,
  });

const value = (attrs: string, text: string) =>
  `<span class="profile-field__value"${attrs}>${text}</span>`;

describe("HU-LC-05C.4C.7E.7C — original-language text in RTL", () => {
  it("isolates original English Petition values on the Arabic Status page without claiming a language", () => {
    const html = render("ar", workspace());
    assert.ok(html.includes(value(' dir="auto"', "Safer School Crossings!")), "title");
    assert.ok(html.includes(value(' dir="auto"', SUMMARY)), "summary");
    assert.doesNotMatch(html, /lang="ar"[^>]*>Safer School Crossings!/);
  });

  it("renders URLs and identifiers left-to-right", () => {
    const html = render("ar", workspace());
    assert.ok(html.includes(value(' dir="ltr"', SHARE_URL)), "share link");
    assert.ok(html.includes(value(' dir="ltr"', `decision-${PETITION_ID}`)), "decision id");
  });

  it("keeps the same markup in English LTR (dir=auto resolves to LTR)", () => {
    const html = render("en", workspace());
    assert.ok(html.includes(value(' dir="auto"', SUMMARY)));
    assert.ok(html.includes(value(' dir="ltr"', SHARE_URL)));
    assert.ok(html.includes(">Petition Summary<"));
  });

  it("translated Arabic reading text carries its language and is never forced LTR", () => {
    const html = render(
      "ar",
      createElement(PetitionSubject, {
        petition: petition(),
        readingText: { title: "معابر مدرسية أكثر أمانًا", summary: "مراجعة تحقق محلية.", lang: "ar" },
      }),
    );
    assert.ok(html.includes(value(' lang="ar" dir="auto"', "معابر مدرسية أكثر أمانًا")));
    assert.ok(html.includes(value(' lang="ar" dir="auto"', "مراجعة تحقق محلية.")));
    assert.doesNotMatch(html, /dir="ltr"[^>]*>[^<]*[\u0600-\u06FF]/);
  });

  it("ProfileField without direction props renders exactly as before", () => {
    assert.equal(
      renderToStaticMarkup(createElement(ProfileField, { label: "L", value: "V" })),
      '<div class="profile-field"><span class="profile-field__label">L</span><span class="profile-field__value">V</span></div>',
    );
  });

  it("translated-content bodies (document fields, Initiative title/description) isolate by content", () => {
    const original = render(
      "ar",
      createElement(TranslatedContentView, {
        chrome: "body",
        content: SUMMARY,
        originalContent: SUMMARY,
        activeLanguage: "en",
        originalLanguage: "en",
        canViewOriginal: false,
        isMachineTranslated: false,
        isStale: false,
      }),
    );
    assert.match(original, /class="hu-translated-content__body" lang="en" dir="auto"/);
    const translated = render(
      "ar",
      createElement(TranslatedContentView, {
        chrome: "body",
        content: "مراجعة تحقق محلية.",
        originalContent: SUMMARY,
        activeLanguage: "ar",
        originalLanguage: "en",
        canViewOriginal: true,
        isMachineTranslated: true,
        isStale: false,
      }),
    );
    assert.match(translated, /class="hu-translated-content__body" lang="ar" dir="auto"/);
  });

  it("Petition titles, recipients, Initiative hero and overview text are isolated", () => {
    assert.equal(
      render("ar", createElement(PetitionReadingTitle, { petitionId: PETITION_ID, title: "Title A?" })),
      '<span dir="auto">Title A?</span>',
    );
    assert.match(
      readWeb("features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx"),
      /<li key=\{`\$\{index\}-\$\{recipient\}`\}>\s*<span dir="auto">\{recipient\}<\/span>\s*<\/li>/,
    );
    const hero = readWeb("features/public-initiative-experience/components/PublicExperienceHero.tsx");
    assert.match(hero, /<span dir="auto">\{title\}<\/span>/);
    assert.match(hero, /<p dir="auto">\{descriptionText\}<\/p>/);
    assert.match(
      readWeb("features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx"),
      /<p dir="auto">\{value\}<\/p>/,
    );
  });

  it("isolated values keep the page alignment instead of flipping to their own (7E.7E)", () => {
    const rules: Array<[string, RegExp]> = [
      ["components/member/profile-field.css", /\[dir="rtl"\] \.profile-field__value:dir\(ltr\) \{\s*text-align: end;/],
      ["features/language/components/translated-content-view.css", /\[dir="rtl"\] \.hu-translated-content__body:dir\(ltr\) \{\s*text-align: end;/],
      ["features/public-initiative-experience/public-initiative-experience.css", /\[dir="rtl"\] \.pie-hero__description p:dir\(ltr\),/],
      ["features/public-initiative-experience/public-initiative-experience.css", /\[dir="rtl"\] \.pie-overview__section p:dir\(ltr\) \{\s*text-align: end;/],
    ];
    for (const [file, rule] of rules) {
      assert.match(readWeb(file), rule, file);
    }
    assert.match(
      readWeb("components/member/profile-field.css"),
      /\.profile-field__label \{[^}]*text-align: start;/,
    );
  });
});

describe("HU-LC-05C.4C.7E.7C — Petitions chevron", () => {
  it("uses physical borders so collapsed points down and expanded points up in LTR and RTL", () => {
    const css = readWeb(
      "features/initiative-petition-lifecycle/components/initiative-petitions-hero-widget.css",
    );
    const chevron = css.match(/\.pie-hero-petitions__chevron \{[^}]*\}/)?.[0] ?? "";
    assert.match(chevron, /border-right: 2px solid currentColor;/);
    assert.match(chevron, /border-bottom: 2px solid currentColor;/);
    assert.match(chevron, /transform: rotate\(45deg\);/);
    assert.doesNotMatch(chevron, /border-inline|border-block/);
    assert.match(
      css,
      /\.pie-hero-petitions__toggle\[aria-expanded="true"\] \.pie-hero-petitions__chevron \{\s*transform: rotate\(-135deg\);/,
    );
    assert.doesNotMatch(css, /\[dir="rtl"\][^{]*chevron/);
  });
});

describe("HU-LC-05C.4C.7E.7C — Assistant button", () => {
  const css = readWeb("features/humanity-union-assistant/humanity-union-assistant.css");

  it("keeps the LTR position and mirrors to the inline end in RTL on desktop and mobile", () => {
    assert.match(css, /\.hu-assistant-fab \{\s*position: fixed;\s*right: max\(1\.5rem, env\(safe-area-inset-right, 0px\)\);/);
    assert.match(
      css,
      /\[dir="rtl"\] \.hu-assistant-fab \{\s*right: auto;\s*left: max\(1\.5rem, env\(safe-area-inset-left, 0px\)\);\s*\}/,
    );
    const mobile = css.slice(css.indexOf("@media (max-width: 640px)"));
    assert.match(mobile, /\.hu-assistant-fab \{\s*right: max\(1rem, env\(safe-area-inset-right, 0px\)\);\s*bottom: max\(4\.75rem/);
    assert.match(
      mobile,
      /\[dir="rtl"\] \.hu-assistant-fab \{\s*right: auto;\s*left: max\(1rem, env\(safe-area-inset-left, 0px\)\);\s*\}/,
    );
  });

  it("does not change mobile bottom spacing, size or the standalone PWA hiding rule", () => {
    assert.match(css, /width: 3\.4rem;\s*height: 3\.4rem;/);
    assert.match(readWeb("features/pwa/pwa-safe-area.css"), /\.humanity-app--pwa-standalone \.hu-assistant-fab \{\s*display: none !important;/);
  });
});

describe("HU-LC-05C.4C.7E.7C — mobile and intentional horizontal scrolling", () => {
  it("adds no overflow, nowrap or fixed widths and keeps the lifecycle list scrollable", () => {
    for (const file of [
      "components/member/profile-field.css",
      "features/language/components/translated-content-view.css",
    ]) {
      assert.doesNotMatch(readWeb(file), /overflow-x|white-space:\s*nowrap|\bwidth:\s*\d{3,}px/, file);
    }
    const profileValue = readWeb("components/member/profile-field.css");
    assert.match(profileValue, /overflow-wrap: anywhere;/);
    assert.match(
      readWeb("features/public-initiative-experience/public-initiative-experience.css"),
      /\.pie-lifecycle__list[^{]*\{[^}]*overflow-x: auto/,
    );
  });
});
