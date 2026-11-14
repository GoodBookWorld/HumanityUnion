/**
 * HU-LC-05C.4C.7E.8C — the public Petitions widget Retry label uses the
 * public-required `common.retry`; the steward view keeps its author label.
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

import {
  classifyWebUiCoveragePath,
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
} from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { InitiativePetitionsHeroWidget } from "./components/InitiativePetitionsHeroWidget.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function catalog(locale: string): { common: Record<string, string> } {
  return JSON.parse(readWeb(`features/i18n/messages/${locale}.json`));
}

async function renderFailed(locale: string, onRetry?: () => void): Promise<string> {
  const messages = (await loadUiMessagesForLocale(locale)).messages;
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages, timeZone: "UTC" } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(InitiativePetitionsHeroWidget, {
        list: { status: "failed" },
        selectedPetitionId: null,
        stageHash: "petition",
        onSelectPetition: () => undefined,
        onRetry,
        defaultExpanded: true,
      }),
    ),
  );
}

const WIDGET = "features/initiative-petition-lifecycle/components/InitiativePetitionsHeroWidget.tsx";

describe("HU-LC-05C.4C.7E.8C — public Petitions widget Retry", () => {
  it("the public widget reads common.retry, not the author action", () => {
    const widget = readWeb(WIDGET);
    assert.match(widget, /const tCommon = useTranslations\("common"\)/);
    assert.match(widget, /\{tCommon\("retry"\)\}/);
    assert.doesNotMatch(widget, /author\.actions\.retry/);
  });

  it("common.retry is public-required WEB_UI", () => {
    assert.equal(isPublicReaderWebUiRequiredPath("common.retry"), true);
    assert.equal(isParticipantWebUiRequiredPath("common.retry"), false);
    assert.equal(classifyWebUiCoveragePath("common.retry").kind, "public_required");
    assert.equal(isPublicReaderWebUiRequiredPath("initiativeExperience.author.actions.retry"), false);
  });

  it("renders the localized label in every bundled locale", async () => {
    for (const locale of ["en", "uk", "ar", "zh-Hant"]) {
      const label = catalog(locale).common.retry;
      assert.ok(label && label.trim().length > 0, locale);
      const html = await renderFailed(locale, () => undefined);
      assert.ok(
        html.includes(`<button type="button" class="pie-hero-petitions__retry">${label}</button>`),
        locale,
      );
    }
  });

  it("keeps Retry behaviour: the button exists only with onRetry and calls it on click", async () => {
    const withoutRetry = await renderFailed("en");
    assert.doesNotMatch(withoutRetry, /pie-hero-petitions__retry/);
    assert.match(withoutRetry, /Petitions could not be loaded right now\./);
    assert.match(
      readWeb(WIDGET),
      /\{onRetry \? \(\s*<button type="button" className="pie-hero-petitions__retry" onClick=\{onRetry\}>/,
    );
  });

  it("leaves the steward stage view on its author Retry label", () => {
    assert.match(
      readWeb("features/initiative-petition-lifecycle/components/InitiativePetitionStewardStageView.tsx"),
      /\{t\("author\.actions\.retry"\)\}/,
    );
  });
});
