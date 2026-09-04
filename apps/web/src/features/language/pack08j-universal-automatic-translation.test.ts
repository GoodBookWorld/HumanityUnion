/**
 * Pack 08J — Web presentation walker + ownership default (no Gemini).
 */
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { DEFAULT_LOCALIZABLE_RULE, LOCALIZATION_OWNERSHIP_SYNONYMS } from "@hu/types";

import {
  applyTranslatedPresentationFields,
  isNonTranslatableFieldKey,
} from "./translate-presentation.js";
import { classifyLocalizationOwnership } from "./localization-ownership.js";
import { runUniversalLocalizationCoverageGate } from "./universal-localization-coverage-gate.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("Pack 08J — web universal automatic translation", () => {
  it("unknown semantic prose is CIVIC_CONTENT / AUTO_TRANSLATABLE", () => {
    assert.equal(
      classifyLocalizationOwnership({ domain: "unknown_semantic" }),
      "CIVIC_CONTENT",
    );
    assert.equal(LOCALIZATION_OWNERSHIP_SYNONYMS.AUTO_TRANSLATABLE_CONTENT, "CIVIC_CONTENT");
    assert.match(DEFAULT_LOCALIZABLE_RULE, /AUTO_TRANSLATABLE_CONTENT/);
  });

  it("applyTranslatedPresentationFields preserves identity keys", () => {
    const next = applyTranslatedPresentationFields(
      {
        title: "Hello",
        authorDisplayName: "Ada",
        nested: { summary: "Body", email: "a@b.com" },
      },
      {
        title: "[uk] Hello",
        "nested.summary": "[uk] Body",
        "nested.email": "[uk] SHOULD_NOT_APPLY",
      },
    );
    assert.equal(next.title, "[uk] Hello");
    assert.equal(next.authorDisplayName, "Ada");
    assert.equal(next.nested.summary, "[uk] Body");
    assert.equal(next.nested.email, "a@b.com");
    assert.ok(isNonTranslatableFieldKey("email"));
  });

  it("coverage gate keeps Pack 08J zero counters", () => {
    const result = runUniversalLocalizationCoverageGate(webSrc);
    assert.equal(result.counters.AUTO_TRANSLATION_BYPASS, 0);
    assert.equal(result.counters.NON_TRANSLATABLE_VIOLATION, 0);
    assert.equal(result.counters.PRIVATE_DATA_TRANSLATION_ATTEMPT, 0);
    assert.equal(result.counters.UNCLASSIFIED_PARTICIPANT_TEXT, 0);
  });
});
