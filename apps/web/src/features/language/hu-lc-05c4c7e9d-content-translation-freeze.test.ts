/**
 * HU-LC-05C.4C.7E.9D — authored content stays original; the interface is
 * still localized. Translate Draft is hidden while CT is frozen.
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

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { TranslateDraftControl } from "./components/TranslateDraftControl.js";
import { isContentTranslationFrozen } from "./content-translation-frozen.config.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readWeb = (relative: string) => readFileSync(path.join(webSrc, relative), "utf8");

async function renderControl(): Promise<string> {
  const messages = (await loadUiMessagesForLocale("en")).messages;
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale: "en", messages, timeZone: "UTC" } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(TranslateDraftControl, {
        sourceRecordId: "petition-draft-7e9d",
        sourceVersion: "draft",
        draftContent: { title: "Draft title" },
      }),
    ),
  );
}

describe("HU-LC-05C.4C.7E.9D — Content Translation freeze (WEB)", () => {
  it("is frozen by default and only an explicit false unfreezes it", () => {
    const saved = process.env.NEXT_PUBLIC_CONTENT_TRANSLATION_FROZEN;
    try {
      delete process.env.NEXT_PUBLIC_CONTENT_TRANSLATION_FROZEN;
      assert.equal(isContentTranslationFrozen(), true);
      process.env.NEXT_PUBLIC_CONTENT_TRANSLATION_FROZEN = "false";
      assert.equal(isContentTranslationFrozen(), false);
    } finally {
      if (saved === undefined) {
        delete process.env.NEXT_PUBLIC_CONTENT_TRANSLATION_FROZEN;
      } else {
        process.env.NEXT_PUBLIC_CONTENT_TRANSLATION_FROZEN = saved;
      }
    }
  });

  it("Translate Draft renders nothing while frozen and the full control when unfrozen", async () => {
    const saved = process.env.NEXT_PUBLIC_CONTENT_TRANSLATION_FROZEN;
    try {
      delete process.env.NEXT_PUBLIC_CONTENT_TRANSLATION_FROZEN;
      assert.equal(await renderControl(), "");
      process.env.NEXT_PUBLIC_CONTENT_TRANSLATION_FROZEN = "false";
      assert.match(await renderControl(), /class="hu-translate-draft"/);
    } finally {
      if (saved === undefined) {
        delete process.env.NEXT_PUBLIC_CONTENT_TRANSLATION_FROZEN;
      } else {
        process.env.NEXT_PUBLIC_CONTENT_TRANSLATION_FROZEN = saved;
      }
    }
  });

  it("catalog guidance no longer promises translation of authored content", async () => {
    for (const locale of ["en", "uk", "ar", "zh-Hant"]) {
      const catalog = JSON.parse(readWeb(`features/i18n/messages/${locale}.json`)) as {
        preferences: { language: { preferredReadingHelp: string } };
        initiativeExperience: { collaboration: { discussion: { originalLanguageNote: string } } };
      };
      assert.ok(catalog.preferences.language.preferredReadingHelp.trim(), locale);
      assert.ok(catalog.initiativeExperience.collaboration.discussion.originalLanguageNote.trim(), locale);
    }
    const en = JSON.parse(readWeb("features/i18n/messages/en.json")) as {
      preferences: { language: { preferredReadingHelp: string } };
      initiativeExperience: { collaboration: { discussion: { originalLanguageNote: string } } };
    };
    assert.match(en.preferences.language.preferredReadingHelp, /stays in its original language/);
    assert.doesNotMatch(
      en.initiativeExperience.collaboration.discussion.originalLanguageNote,
      /reading language when a translation is available/,
    );
  });

  it("Admin can activate interface localization without content translation", () => {
    const admin = readWeb("features/administration/components/AdminLanguagesSection.tsx");
    const canActivate = /const canActivate =([\s\S]*?);/.exec(admin)?.[1] ?? "";
    assert.match(canActivate, /row\.enabled/);
    assert.doesNotMatch(canActivate, /contentTranslationEnabled/);
  });
});
