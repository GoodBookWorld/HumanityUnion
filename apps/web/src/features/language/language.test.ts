import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LANGUAGE_ROUTING_STRATEGY,
  documentDirectionForLanguage,
  isRtlLanguageCode,
  normalizeLanguageCode,
} from "./language.js";

describe("Language Architecture Pack 01–02 (web)", () => {
  it("normalizes priority language codes and defaults safely", () => {
    assert.equal(normalizeLanguageCode("en-US"), "en");
    assert.equal(normalizeLanguageCode("uk"), "uk");
    assert.equal(normalizeLanguageCode(""), "en");
  });

  it("detects RTL languages for Arabic and Hebrew; English is LTR", () => {
    assert.equal(isRtlLanguageCode("ar"), true);
    assert.equal(isRtlLanguageCode("he"), true);
    assert.equal(isRtlLanguageCode("en"), false);
    assert.equal(documentDirectionForLanguage("ar"), "rtl");
    assert.equal(documentDirectionForLanguage("he"), "rtl");
    assert.equal(documentDirectionForLanguage("en"), "ltr");
    assert.equal(documentDirectionForLanguage("fr"), "ltr");
  });

  it("keeps locale in profile preference rather than URL prefixes", () => {
    assert.equal(LANGUAGE_ROUTING_STRATEGY, "profile_preference");
  });
});
