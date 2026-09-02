/**
 * Production Completion Pack 02G Task 07D — civic title translation prompt contract.
 * Prompt-only; no live Gemini; does not change 07C output validation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGeminiTranslationSystemInstruction } from "../../../src/modules/language/index.js";

describe("Production Completion Pack 02G Task 07D — civic title prompt contract", () => {
  const prompt = buildGeminiTranslationSystemInstruction({
    sourceLanguage: "en",
    targetLanguage: "uk",
    sourceLanguageName: "English",
    targetLanguageName: "Ukrainian",
    terminologyContext: "Initiative (initiative) => Initiative | fallback: en",
    contentType: "structured_json",
  });

  it("requires normal translation of civic titles/headings including JSON title", () => {
    assert.match(
      prompt,
      /Civic content titles and human-readable headings \(including JSON fields such as `title`/,
    );
    assert.match(prompt, /translate them into the target language normally/);
    assert.match(
      prompt,
      /designated civic title\/heading field values must not remain identical to the source/,
    );
  });

  it("rejects treating campaign/alliance-like titles as automatically invariant", () => {
    assert.match(
      prompt,
      /Do not preserve a civic artifact title merely because it resembles a proper name, campaign name, alliance name, or capitalized phrase/,
    );
  });

  it("still allows genuine registered organization/person/product names to remain invariant", () => {
    assert.match(
      prompt,
      /Preserve genuine registered organization names, person names, established product\/brand names/,
    );
    assert.match(prompt, /acronyms, and similar invariant identifiers where appropriate/);
  });

  it("scopes glossary English fallback to the term/token only — including titles/headings", () => {
    assert.match(
      prompt,
      /Glossary fallback-to-English applies only to the specific canonical terminology concept or preferred term\/token/,
    );
    assert.match(
      prompt,
      /never to the surrounding title, heading, sentence, or field prose/,
    );
    assert.match(
      prompt,
      /never be interpreted as permission to leave the whole title, heading, sentence, or field in the source language/,
    );
  });
});
