/**
 * HE.13B — original-language words may remain when surrounding prose changed.
 * No live Gemini. No locale-specific branches.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ContentTranslationValidationError } from "../../../src/modules/language/content-translation-failure-metadata.js";
import {
  assertCivicTitleFieldsTranslatedFromSource,
  assertEligibleSourceFieldsFullyTranslated,
  assertTranslatedProseChangedFromSource,
} from "../../../src/modules/language/content-translation-output-validation.js";
import { buildGeminiTranslationSystemInstruction } from "../../../src/modules/language/providers/gemini-translation-provider.js";

const LOCALES = ["uk", "ar", "he"] as const;

describe("HE.13B original-language preservation", () => {
  it("allows an unchanged proper-name title when other eligible prose changed", () => {
    for (const locale of LOCALES) {
      assert.doesNotThrow(() =>
        assertCivicTitleFieldsTranslatedFromSource({
          sourceKind: "blog_post",
          sourceLanguage: "en",
          targetLanguage: locale,
          sourceFields: {
            title: "Harbor Teachers",
            excerpt: "A short excerpt.",
            content: "Marine life can teach a city how to listen.",
          },
          translatedFields: {
            title: "Harbor Teachers",
            excerpt: "Короткий уривок.",
            content: "Морське життя може навчити місто слухати.",
          },
        }),
      );
      assert.doesNotThrow(() =>
        assertCivicTitleFieldsTranslatedFromSource({
          sourceKind: "initiative",
          sourceLanguage: "en",
          targetLanguage: locale,
          sourceFields: {
            title: "Harbor Teachers",
            description: "Marine life can teach a city how to listen.",
          },
          translatedFields: {
            title: "Harbor Teachers",
            description: "Морське життя може навчити місто слухати.",
          },
        }),
      );
    }
  });

  it("rejects an unchanged title when it is the only eligible field", () => {
    assert.throws(
      () =>
        assertCivicTitleFieldsTranslatedFromSource({
          sourceKind: "blog_post",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: { title: "Harbor Teachers" },
          translatedFields: { title: "Harbor Teachers" },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_CIVIC_TITLE",
    );
    assert.throws(
      () =>
        assertCivicTitleFieldsTranslatedFromSource({
          sourceKind: "initiative",
          sourceLanguage: "en",
          targetLanguage: "ar",
          sourceFields: { title: "Harbor Teachers" },
          translatedFields: { title: "Harbor Teachers" },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_CIVIC_TITLE",
    );
  });

  it("rejects a wholly unchanged document and a missing required field", () => {
    assert.throws(
      () =>
        assertTranslatedProseChangedFromSource({
          sourceKind: "blog_post",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: {
            title: "Harbor Teachers",
            content: "Marine life can teach a city how to listen.",
          },
          translatedFields: {
            title: "Harbor Teachers",
            content: "Marine life can teach a city how to listen.",
          },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_SOURCE_PROSE",
    );
    assert.throws(
      () =>
        assertEligibleSourceFieldsFullyTranslated({
          sourceKind: "initiative",
          sourceFields: {
            title: "Harbor Teachers",
            description: "Marine life can teach a city how to listen.",
          },
          translatedFields: { title: "Вчителі гавані", description: "   " },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "MISSING_REQUIRED_PATH",
    );
  });

  it("keeps an original word inside translated comment prose and rejects an unchanged comment", () => {
    assert.doesNotThrow(() =>
      assertTranslatedProseChangedFromSource({
        sourceKind: "discussion_comment",
        sourceLanguage: "en",
        targetLanguage: "uk",
        sourceFields: { body: "Harbor Teachers showed the city how to listen." },
        translatedFields: { body: "Harbor Teachers показали місту, як слухати." },
      }),
    );
    assert.doesNotThrow(() =>
      assertCivicTitleFieldsTranslatedFromSource({
        sourceKind: "discussion_comment",
        sourceLanguage: "en",
        targetLanguage: "uk",
        sourceFields: { body: "Harbor Teachers showed the city how to listen." },
        translatedFields: { body: "Harbor Teachers showed the city how to listen." },
      }),
    );
    assert.throws(
      () =>
        assertTranslatedProseChangedFromSource({
          sourceKind: "discussion_comment",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: { body: "Harbor Teachers showed the city how to listen." },
          translatedFields: { body: "Harbor Teachers showed the city how to listen." },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_SOURCE_PROSE",
    );
  });

  it("tells the provider to preserve unreliable names and still translate the document", () => {
    const prompt = buildGeminiTranslationSystemInstruction({
      sourceLanguage: "en",
      targetLanguage: "uk",
      sourceLanguageName: "English",
      targetLanguageName: "Ukrainian",
      contentType: "structured_json",
    });
    assert.match(
      prompt,
      /Preserve proper names and unfamiliar terms in their original spelling when translation would be unreliable/,
    );
    assert.match(prompt, /Translate the surrounding prose/);
    assert.match(prompt, /Do not invent meanings or transliterations/);
    assert.match(prompt, /Do not leave an entire translatable document unchanged/);
    assert.doesNotMatch(prompt, /Hebrew|locale === "he"|if \(.*he\)/);
  });
});
