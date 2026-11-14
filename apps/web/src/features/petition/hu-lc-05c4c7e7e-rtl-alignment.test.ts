/**
 * HU-LC-05C.4C.7E.7E — RTL alignment regression: `text-align: match-parent` is
 * not supported by the tested Chromium, so isolated original-language values
 * use explicit `[dir="rtl"]` right alignment while keeping their own `dir`.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { PublicPetitionRecord } from "@hu/types";

import {
  InitiativeOverviewDescriptionDom,
  InitiativePieHeroPresentationDom,
} from "../public-initiative-experience/initiative-presentation-dom";
import { PetitionWorkspace } from "./components/PetitionWorkspace";

(globalThis as { React?: typeof React }).React = React;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(HERE, "../..");
const readWeb = (relative: string) => readFileSync(path.join(WEB_SRC, relative), "utf8");

const PROFILE_CSS = "components/member/profile-field.css";
const TRANSLATED_CSS = "features/language/components/translated-content-view.css";
const PIE_CSS = "features/public-initiative-experience/public-initiative-experience.css";
const ASSISTANT_CSS = "features/humanity-union-assistant/humanity-union-assistant.css";

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return cssFiles(full);
    }
    return name.endsWith(".css") ? [full] : [];
  });
}

function render(locale: "en" | "uk" | "ar", element: ReactElement): string {
  const messages = JSON.parse(readWeb(`features/i18n/messages/${locale}.json`)) as AbstractIntlMessages;
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages, timeZone: "UTC" } as React.ComponentProps<typeof NextIntlClientProvider>,
      element,
    ),
  );
}

const PETITION_ID = "petition-a";
const SUMMARY = "Local validation revision; no applied proposals.";

function workspace() {
  return createElement(PetitionWorkspace, {
    initialPetition: {
      petitionId: PETITION_ID,
      collectiveDecisionId: `decision-${PETITION_ID}`,
      status: "Open",
      createdAt: "2026-11-10T00:00:00.000Z",
      updatedAt: "2026-11-10T00:00:00.000Z",
      subject: {
        decisionId: `decision-${PETITION_ID}`,
        initiativeId: "initiative-1",
        title: "Safer School Crossings",
        summary: SUMMARY,
      },
      policy: {
        endorsementPeriod: { opensAt: null, closesAt: null },
        withdrawalPolicy: { withdrawalPermitted: true, withdrawalPolicyDescription: null },
      },
      shareLink: { url: "/initiatives/public/initiative-1#petition", createdAt: "2026-11-10T00:00:00.000Z" },
      supportMetrics: {
        totalSignatures: 1,
        participantSignatures: 1,
        dailyActivity: [],
        supportThresholdStatus: { thresholdDefined: false, thresholdReached: false, currentCount: 1, thresholdCount: null },
      },
      outcome: null,
    } as unknown as PublicPetitionRecord,
    collectiveDecision: null,
    initiative: null,
    collaborativeAnalysis: null,
  });
}

describe("HU-LC-05C.4C.7E.7E — explicit RTL alignment", () => {
  it("no stylesheet relies on unsupported text-align: match-parent", () => {
    for (const file of cssFiles(WEB_SRC)) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /text-align:\s*(-webkit-)?match-parent/, file);
    }
  });

  it("Petition Status values: start by default; LTR-isolated values align with RTL labels via logical end", () => {
    const css = readWeb(PROFILE_CSS);
    assert.match(css, /\.profile-field__value \{[^}]*text-align: start;/);
    assert.match(css, /\[dir="rtl"\] \.profile-field__value\[dir="ltr"\] \{\s*text-align: end;\s*\}/);
    assert.match(css, /\[dir="rtl"\] \.profile-field__value:dir\(ltr\) \{\s*text-align: end;\s*\}/);
    assert.match(css, /\.profile-field__label \{[^}]*text-align: start;/);
    assert.doesNotMatch(css, /text-align:\s*(left|right)\b/, "7D.3: no physical alignment");
  });

  it("Public Petition document and Initiative hero bodies: original LTR text aligns with the RTL page", () => {
    const css = readWeb(TRANSLATED_CSS);
    assert.match(css, /\.hu-translated-content__body \{[^}]*text-align: start;/);
    assert.match(css, /\[dir="rtl"\] \.hu-translated-content__body:dir\(ltr\) \{\s*text-align: end;\s*\}/);
  });

  it("Initiative hero description, loading shell and Overview text align with the RTL page", () => {
    const css = readWeb(PIE_CSS);
    assert.match(
      css,
      /\[dir="rtl"\] \.pie-hero__description:dir\(ltr\),\s*\[dir="rtl"\] \.pie-hero__description p:dir\(ltr\),\s*\[dir="rtl"\] \.pie-overview__section p:dir\(ltr\) \{\s*text-align: end;\s*\}/,
    );
    assert.match(css, /\.pie-hero__description p \{\s*margin: 0;\s*\}/);
  });

  it("Arabic translations (dir=auto resolving to RTL) keep start alignment: only :dir(ltr) or dir=ltr values use end", () => {
    for (const file of [PROFILE_CSS, TRANSLATED_CSS, PIE_CSS]) {
      const css = readWeb(file).replace(/\/\*[\s\S]*?\*\//g, "");
      for (const match of css.matchAll(/([^{}]+)\{[^}]*text-align: end;[^}]*\}/g)) {
        for (const selector of (match[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
          if (/profile-field__value|hu-translated-content__body|pie-hero__description|pie-overview__section/.test(selector)) {
            assert.match(selector, /(:dir\(ltr\)|\[dir="ltr"\])$/, `${file}: ${selector}`);
          }
        }
      }
    }
  });

  it("English and Ukrainian (LTR) keep their alignment: every new override is scoped to [dir=\"rtl\"]", () => {
    for (const file of [PROFILE_CSS, TRANSLATED_CSS, PIE_CSS]) {
      const css = readWeb(file).replace(/\/\*[\s\S]*?\*\//g, "");
      for (const match of css.matchAll(/([^{}]+)\{[^}]*text-align: end;[^}]*\}/g)) {
        const selectors = (match[1] ?? "").split(",").map((selector) => selector.trim()).filter(Boolean);
        for (const selector of selectors) {
          if (/profile-field__value|hu-translated-content__body|pie-hero__description|pie-overview__section/.test(selector)) {
            assert.match(selector, /^\[dir="rtl"\] /, `${file}: ${selector}`);
          }
        }
      }
    }
  });
});

describe("HU-LC-05C.4C.7E.7E — direction metadata is preserved", () => {
  it("Arabic, English and Ukrainian Status pages keep dir=auto for text and dir=ltr for URLs", () => {
    for (const locale of ["ar", "en", "uk"] as const) {
      const html = render(locale, workspace());
      assert.ok(html.includes(`<span class="profile-field__value" dir="auto">${SUMMARY}</span>`), `${locale} summary`);
      assert.match(html, /<span class="profile-field__value" dir="ltr">\/initiatives\/public\/initiative-1\?petition=petition-a#petition<\/span>/, `${locale} url`);
    }
  });

  it("the Initiative loading shell and Overview description isolate original-language text", () => {
    const hero = renderToStaticMarkup(
      createElement(InitiativePieHeroPresentationDom, {
        presentation: { title: "LC-05C MongoDB Initiative", description: "Fresh fixture (hu_validation)." },
      }),
    );
    assert.match(hero, /<h1 id="pie-hero-title" class="pie-hero__title"><span dir="auto">LC-05C MongoDB Initiative<\/span><\/h1>/);
    assert.match(hero, /<div class="pie-hero__description" dir="auto">Fresh fixture \(hu_validation\)\.<\/div>/);
    const overview = renderToStaticMarkup(
      createElement(InitiativeOverviewDescriptionDom, { label: "Full Description", description: "Text." }),
    );
    assert.match(overview, /<p dir="auto">Text\.<\/p>/);
  });
});

describe("HU-LC-05C.4C.7E.7E — Assistant, mobile and horizontal scrolling", () => {
  it("keeps the RTL Assistant position from 7E.7C on desktop and mobile", () => {
    const css = readWeb(ASSISTANT_CSS);
    assert.match(css, /\[dir="rtl"\] \.hu-assistant-fab \{\s*right: auto;\s*left: max\(1\.5rem, env\(safe-area-inset-left, 0px\)\);\s*\}/);
    const mobile = css.slice(css.indexOf("@media (max-width: 640px)"));
    assert.match(mobile, /\[dir="rtl"\] \.hu-assistant-fab \{\s*right: auto;\s*left: max\(1rem, env\(safe-area-inset-left, 0px\)\);\s*\}/);
  });

  it("adds no fixed widths or overflow rules and keeps the lifecycle list scrollable", () => {
    for (const file of [PROFILE_CSS, TRANSLATED_CSS]) {
      assert.doesNotMatch(readWeb(file), /overflow-x|white-space:\s*nowrap|\bwidth:\s*\d{3,}px/, file);
    }
    const pie = readWeb(PIE_CSS);
    const rtlBlock = pie.match(/\[dir="rtl"\] \.pie-hero__description:dir\(ltr\),[^}]*\}/)?.[0] ?? "";
    assert.doesNotMatch(rtlBlock, /width|overflow|white-space|display/);
    assert.match(pie, /\.pie-lifecycle__list[^{]*\{[^}]*overflow-x: auto/);
    assert.match(readWeb(PROFILE_CSS), /overflow-wrap: anywhere;/);
  });
});
