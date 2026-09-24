/**
 * Step 15D.7.2 — ICU 4.8 apostrophe-friendly WEB_UI structure protection.
 * Deterministic. No Gemini. No staging writes. No locale-specific branches.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertStructureMatches,
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
  WebUiDraftBatchError,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import { inspectMessageStructure } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import {
  protectWebUiMessageForProvider,
  restoreWebUiMessageFromProvider,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-structure-protect.js";
import { advanceIcuApostropheFriendly } from "../../../src/modules/web-ui-message-packs/web-ui-icu-apostrophe.js";

const FAILING_ENGLISH =
  "We couldn't connect to the {siteName} service. Please try again shortly.";

describe("Step 15D.7.2 — ICU apostrophe + placeholder structure protection", () => {
  it("1: couldn't before {siteName} detects siteName", () => {
    const inspected = inspectMessageStructure(FAILING_ENGLISH);
    assert.deepEqual([...inspected.placeholders], ["siteName"]);
    assert.equal(inspected.balanced, true);
  });

  it("2: protect slots brand placeholder despite contraction", () => {
    const protectedMessage = protectWebUiMessageForProvider(FAILING_ENGLISH);
    assert.equal(protectedMessage.slots.length, 1);
    assert.equal(protectedMessage.slots[0], "__HU_BRAND_SITE_NAME__");
    assert.match(protectedMessage.text, /⟦w0⟧/);
    assert.equal(protectedMessage.text.includes("__HU_BRAND_SITE_NAME__"), false);
    assert.match(protectedMessage.text, /couldn't/);
  });

  it("3: restore returns exact {siteName}", () => {
    const protectedMessage = protectWebUiMessageForProvider(FAILING_ENGLISH);
    const providerValue = protectedMessage.text.replace(
      "We couldn't connect to the",
      "ვერ დავუკავშირდით",
    );
    const restored = restoreWebUiMessageFromProvider(providerValue, FAILING_ENGLISH);
    assert.match(restored, /\{siteName\}/);
    assert.equal(restored.includes("__HU_BRAND_SITE_NAME__"), false);
    assert.equal(inspectMessageStructure(restored).placeholders.includes("siteName"), true);
  });

  it("4: assertStructureMatches accepts preserved {siteName}", () => {
    const protectedMessage = protectWebUiMessageForProvider(FAILING_ENGLISH);
    const restored = restoreWebUiMessageFromProvider(
      `ვერ დავუკავშირდით ${protectedMessage.text.slice(protectedMessage.text.indexOf("⟦w0⟧"))}`,
      FAILING_ENGLISH,
    );
    assert.doesNotThrow(() => assertStructureMatches(FAILING_ENGLISH, restored));
  });

  it("5: assertStructureMatches rejects dropped {siteName}", () => {
    assert.throws(
      () =>
        assertStructureMatches(
          FAILING_ENGLISH,
          "ვერ დავუკავშირდით სერვისს. გთხოვთ, სცადოთ მოგვიანებით.",
        ),
      (error: unknown) =>
        error instanceof WebUiDraftBatchError &&
        /Placeholders do not match English/.test(error.message),
    );
  });

  it("6: assertStructureMatches rejects renamed placeholder", () => {
    assert.throws(
      () =>
        assertStructureMatches(
          FAILING_ENGLISH,
          "ვერ დავუკავშირდით {site} სერვისს. გთხოვთ, სცადოთ მოგვიანებით.",
        ),
      (error: unknown) =>
        error instanceof WebUiDraftBatchError &&
        /Placeholders do not match English/.test(error.message),
    );
  });

  it("7: ordinary apostrophe without placeholders remains ordinary text", () => {
    const english = "We couldn't connect. Please try again.";
    assert.deepEqual([...inspectMessageStructure(english).placeholders], []);
    const protectedMessage = protectWebUiMessageForProvider(english);
    assert.equal(protectedMessage.slots.length, 0);
    assert.equal(protectedMessage.text, english);
    assert.equal(
      restoreWebUiMessageFromProvider("ვერ დავუკავშირდით. სცადეთ მოგვიანებით.", english),
      "ვერ დავუკავშირდით. სცადეთ მოგვიანებით.",
    );
  });

  it("8: multiple contractions before/after placeholders remain safe", () => {
    const english = "Don't worry — we're ready for {name}, and it isn't {role}'s fault.";
    assert.deepEqual([...inspectMessageStructure(english).placeholders].sort(), [
      "name",
      "role",
    ]);
    const protectedMessage = protectWebUiMessageForProvider(english);
    assert.equal(protectedMessage.slots.length, 2);
    const restored = restoreWebUiMessageFromProvider(protectedMessage.text, english);
    assert.equal(restored, english);
    assert.doesNotThrow(() => assertStructureMatches(english, restored));
  });

  it("9: ICU escaped apostrophe remains correct", () => {
    const english = "We couldn''t connect to the {siteName} service.";
    assert.deepEqual([...inspectMessageStructure(english).placeholders], ["siteName"]);
    const protectedMessage = protectWebUiMessageForProvider(english);
    assert.equal(protectedMessage.slots.length, 1);
    assert.match(protectedMessage.text, /couldn''t/);
    assert.equal(restoreWebUiMessageFromProvider(protectedMessage.text, english), english);
  });

  it("10: legitimate ICU quoted literal braces are not placeholders", () => {
    const english = "Say '{hello}' then greet {name}.";
    assert.deepEqual([...inspectMessageStructure(english).placeholders], ["name"]);
    const protectedMessage = protectWebUiMessageForProvider(english);
    assert.equal(protectedMessage.slots.length, 1);
    assert.match(protectedMessage.text, /'\{hello\}'/);
    assert.equal(restoreWebUiMessageFromProvider(protectedMessage.text, english), english);
  });

  it("11: ICU plural/select messages remain structurally equivalent", () => {
    const plural =
      "{count, plural, one {We couldn't find # item for {name}} other {We couldn't find # items for {name}}}";
    const inspected = inspectMessageStructure(plural);
    assert.deepEqual([...inspected.placeholders], ["count"]);
    const protectedMessage = protectWebUiMessageForProvider(plural);
    assert.ok(protectedMessage.slots.length > 0);
    const restored = restoreWebUiMessageFromProvider(protectedMessage.text, plural);
    assert.equal(restored, plural);
    assert.doesNotThrow(() => assertStructureMatches(plural, restored));

    const select =
      "{gender, select, male {He's here for {task}} female {She's here for {task}} other {They're here for {task}}}";
    const selectProtected = protectWebUiMessageForProvider(select);
    assert.equal(restoreWebUiMessageFromProvider(selectProtected.text, select), select);
  });

  it("12: rich-text tags remain protected/validated", () => {
    const english = "Click <link>here</link> if you can't open {siteName}.";
    assert.deepEqual([...inspectMessageStructure(english).placeholders], ["siteName"]);
    // Opening tags only (existing inspector contract).
    assert.deepEqual([...inspectMessageStructure(english).richTags], ["link"]);
    const protectedMessage = protectWebUiMessageForProvider(english);
    assert.ok(protectedMessage.slots.some((slotValue) => slotValue.startsWith("<")));
    const restored = restoreWebUiMessageFromProvider(protectedMessage.text, english);
    assert.equal(restored, english);
    assert.doesNotThrow(() => assertStructureMatches(english, restored));
    assert.throws(
      () => assertStructureMatches(english, "Click here if you can't open {siteName}."),
      WebUiDraftBatchError,
    );
  });

  it("apostrophe helper: contractions vs syntax quotes", () => {
    assert.equal(advanceIcuApostropheFriendly("can't", 3).nextIndex, 4);
    assert.equal(advanceIcuApostropheFriendly("can't", 3).quotedSyntax, false);
    assert.equal(advanceIcuApostropheFriendly("it''s", 2).nextIndex, 4);
    assert.equal(advanceIcuApostropheFriendly("'{x}'", 0).quotedSyntax, true);
    assert.equal(advanceIcuApostropheFriendly("'{x}'", 0).nextIndex, 5);
  });

  it("corpus audit: no apostrophe/ICU hide risk remains in required WEB_UI union", () => {
    const { flat, requiredPaths } = loadPublicWebUiEnglishCorpus();
    assert.equal(requiredPaths.length, 4103);
    const sourceHash = hashWebUiEnglishFlatMap(flat);
    assert.equal(
      sourceHash,
      "75783619bfe35e9b66983bf3ac4e86acab6598bb9a52be2d32fea553d8f725b9",
      "parser-only fix must not change durable sourceHash",
    );

    const affected: string[] = [];
    for (const pathKey of requiredPaths) {
      const value = flat[pathKey] ?? "";
      if (
        !value.includes("'") ||
        !(
          value.includes("{") ||
          value.includes("}") ||
          value.includes("<") ||
          value.includes("#")
        )
      ) {
        continue;
      }
      // Naive quote-swallow (pre-fix) vs ICU 4.8 inspector.
      let naiveIndex = 0;
      const naivePlaceholders: string[] = [];
      while (naiveIndex < value.length) {
        if (value[naiveIndex] === "'" && value[naiveIndex + 1] === "'") {
          naiveIndex += 2;
          continue;
        }
        if (value[naiveIndex] === "'") {
          const end = value.indexOf("'", naiveIndex + 1);
          naiveIndex = end === -1 ? value.length : end + 1;
          continue;
        }
        if (value[naiveIndex] === "{") {
          const argument = /^[A-Za-z_][A-Za-z0-9_]*/.exec(value.slice(naiveIndex + 1));
          if (argument?.[0]) {
            naivePlaceholders.push(argument[0]);
          }
          let depth = 1;
          naiveIndex += 1;
          while (naiveIndex < value.length && depth > 0) {
            if (value[naiveIndex] === "'" && value[naiveIndex + 1] === "'") {
              naiveIndex += 2;
              continue;
            }
            if (value[naiveIndex] === "'") {
              const end = value.indexOf("'", naiveIndex + 1);
              naiveIndex = end === -1 ? value.length : end + 1;
              continue;
            }
            if (value[naiveIndex] === "{") depth += 1;
            else if (value[naiveIndex] === "}") depth -= 1;
            naiveIndex += 1;
          }
          continue;
        }
        naiveIndex += 1;
      }
      const fixed = inspectMessageStructure(value).placeholders;
      if (
        JSON.stringify([...naivePlaceholders].sort()) !==
        JSON.stringify([...fixed].sort())
      ) {
        affected.push(pathKey);
      }
      // Protect must still round-trip.
      const protectedMessage = protectWebUiMessageForProvider(value);
      assert.equal(restoreWebUiMessageFromProvider(protectedMessage.text, value), value);
    }

    // After the fix, the only historically broken path must now inspect correctly;
    // report count of paths where the *old* naive parser disagreed (documentation).
    assert.ok(
      affected.includes("memberProfile.unavailableExplanation") || affected.length === 0,
      `expected failing path in pre-fix delta or empty; got ${affected.join(", ")}`,
    );
    // Fixed inspector must see siteName on the known path.
    assert.deepEqual(
      [...inspectMessageStructure(flat["memberProfile.unavailableExplanation"] ?? "").placeholders],
      ["siteName"],
    );
    // Expose audit count for the report (paths the old parser would have mishandled).
    assert.equal(
      affected.length,
      1,
      `unexpected apostrophe/placeholder delta paths: ${affected.join(", ")}`,
    );
  });

  it("20: no locale-specific branch in apostrophe helper module source", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(
      path.resolve(
        here,
        "../../../src/modules/web-ui-message-packs/web-ui-icu-apostrophe.ts",
      ),
      "utf8",
    );
    assert.equal(/\bka\b|Georgian|ქართული/i.test(source), false);
  });
});
