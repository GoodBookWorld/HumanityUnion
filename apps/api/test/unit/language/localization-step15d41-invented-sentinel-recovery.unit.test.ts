/**
 * Step 15D.4.1 — recover provider-invented WEB_UI protection sentinels on zero-slot sources.
 * Deterministic. No Gemini. No staging writes.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  batchProtectedPayloadContainsSentinels,
  protectWebUiMessageForProvider,
  restoreWebUiMessageFromProvider,
  stripInventedZeroSlotProtectionSentinels,
  webUiProtectionSentinelInstructions,
  WebUiMessageStructureError,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-structure-protect.js";
import { inspectMessageStructure } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

describe("Step 15D.4.1 — zero-slot invented sentinel recovery", () => {
  it("1: zero-slot source + no invented sentinel passes normally", () => {
    const english = "Author application approved";
    assert.equal(protectWebUiMessageForProvider(english).slots.length, 0);
    assert.equal(restoreWebUiMessageFromProvider("განაცხადი დამტკიცებულია", english), "განაცხადი დამტკიცებულია");
  });

  it("2–5: invented exact sentinels are stripped; surrounding text and whitespace preserved safely", () => {
    const english = "Author application approved";
    assert.equal(
      restoreWebUiMessageFromProvider("Hello ⟦w0⟧ world", english),
      "Hello world",
    );
    assert.equal(
      restoreWebUiMessageFromProvider("⟦w0⟧Start⟦w1⟧ middle ⟦w2⟧end", english),
      "Start middle end",
    );
    assert.equal(
      restoreWebUiMessageFromProvider("Keep  ⟦w0⟧  spaces", english),
      "Keep spaces",
    );
    assert.equal(
      stripInventedZeroSlotProtectionSentinels("A ⟦w0⟧ B ⟦w99⟧ C"),
      "A B C",
    );
  });

  it("6–7: arbitrary brackets are kept; invalid sentinel-like syntax is not silently stripped", () => {
    const english = "Label";
    assert.equal(
      restoreWebUiMessageFromProvider("Keep [bracket] and (paren) text", english),
      "Keep [bracket] and (paren) text",
    );
    assert.equal(
      restoreWebUiMessageFromProvider("Keep [[w0]] and [w0]", english),
      "Keep [[w0]] and [w0]",
    );
    // Exact grammar only strips ⟦wN⟧; leftover ⟦w… without digits still fails unresolved check.
    assert.throws(
      () => restoreWebUiMessageFromProvider("Keep ⟦wx⟧ and ⟦w⟧", english),
      (error: unknown) =>
        error instanceof WebUiMessageStructureError &&
        /Unresolved protection sentinel/.test(error.message),
    );
  });

  it("8–11: genuine protected slots remain strict", () => {
    const oneSlot = "Showing {count} items";
    const protectedOne = protectWebUiMessageForProvider(oneSlot);
    assert.equal(protectedOne.slots.length, 1);
    assert.equal(restoreWebUiMessageFromProvider(protectedOne.text, oneSlot), oneSlot);
    assert.throws(
      () => restoreWebUiMessageFromProvider("Showing items", oneSlot),
      (error: unknown) =>
        error instanceof WebUiMessageStructureError &&
        /sentinel count 0 does not match 1/.test(error.message),
    );
    assert.throws(
      () => restoreWebUiMessageFromProvider(`${protectedOne.text}⟦w9⟧`, oneSlot),
      WebUiMessageStructureError,
    );
    assert.throws(
      () => restoreWebUiMessageFromProvider("broken ⟦w0", oneSlot),
      WebUiMessageStructureError,
    );

    const multi = "{count, plural, one {# item} other {# items}}";
    const protectedMulti = protectWebUiMessageForProvider(multi);
    assert.ok(protectedMulti.slots.length > 1);
    assert.equal(restoreWebUiMessageFromProvider(protectedMulti.text, multi), multi);
    assert.throws(
      () => restoreWebUiMessageFromProvider(protectedMulti.text.replace("⟦w0⟧", ""), multi),
      WebUiMessageStructureError,
    );
  });

  it("12–14: zero-slot recovery cannot bypass placeholder/ICU/rich-text contracts", () => {
    const withPlaceholder = "Hello {name}";
    assert.ok(protectWebUiMessageForProvider(withPlaceholder).slots.length > 0);
    // Zero-slot strip does not apply; missing genuine sentinel still fails.
    assert.throws(
      () => restoreWebUiMessageFromProvider("Hello world", withPlaceholder),
      WebUiMessageStructureError,
    );
    // Extra invented sentinel alongside a real slot still fails.
    const protectedPlaceholder = protectWebUiMessageForProvider(withPlaceholder);
    assert.throws(
      () =>
        restoreWebUiMessageFromProvider(`${protectedPlaceholder.text} ⟦w9⟧`, withPlaceholder),
      WebUiMessageStructureError,
    );

    const icu = "{count, plural, one {# proposal} other {# proposals}}";
    const protectedIcu = protectWebUiMessageForProvider(icu);
    assert.ok(protectedIcu.slots.length > 0);
    const brokenIcu = protectedIcu.text.replace(/⟦w\d+⟧/g, "");
    assert.throws(() => restoreWebUiMessageFromProvider(brokenIcu, icu), WebUiMessageStructureError);

    const rich = "<link>Sign in</link> now";
    assert.ok(protectWebUiMessageForProvider(rich).slots.length > 0);
    assert.throws(
      () => restoreWebUiMessageFromProvider("Sign in now", rich),
      WebUiMessageStructureError,
    );
    const protectedRich = protectWebUiMessageForProvider(rich);
    const restoredRich = restoreWebUiMessageFromProvider(protectedRich.text, rich);
    assert.deepEqual(
      [...inspectMessageStructure(restoredRich).richTags].sort(),
      [...inspectMessageStructure(rich).richTags].sort(),
    );
  });

  it("15: prompt instructions are slot-aware and generic", () => {
    assert.match(
      webUiProtectionSentinelInstructions(false),
      /no protection tokens/i,
    );
    assert.doesNotMatch(webUiProtectionSentinelInstructions(false), /Copy every sentinel/);
    assert.match(webUiProtectionSentinelInstructions(true), /⟦w0⟧/);
    assert.match(webUiProtectionSentinelInstructions(true), /Copy every sentinel/);

    assert.equal(batchProtectedPayloadContainsSentinels({ a: "plain" }), false);
    assert.equal(batchProtectedPayloadContainsSentinels({ a: "x ⟦w0⟧ y" }), true);
  });
});
