import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DirectMessagingValidationError } from "../../../src/modules/direct-messaging/direct-messaging.errors.js";
import {
  buildDirectMessagePreview,
  MAX_DIRECT_MESSAGE_LENGTH,
  validateDirectMessageText,
  validateOptionalClientMessageId,
} from "../../../src/modules/direct-messaging/direct-messaging.validators.js";

/** Profile UX Pack 03 Part 15/21 — pure, MongoDB-free text-safety unit tests. */
describe("Direct Messaging text safety (Part 15)", () => {
  it("test 12 — rejects an empty message", () => {
    assert.throws(() => validateDirectMessageText(""), DirectMessagingValidationError);
    assert.throws(() => validateDirectMessageText("   "), DirectMessagingValidationError);
  });

  it("rejects control-only content (no printable text)", () => {
    assert.throws(() => validateDirectMessageText("\u0000\u0001"), DirectMessagingValidationError);
  });

  it("test 13 — rejects a message over the maximum length", () => {
    const oversized = "a".repeat(MAX_DIRECT_MESSAGE_LENGTH + 1);
    assert.throws(() => validateDirectMessageText(oversized), DirectMessagingValidationError);
  });

  it("accepts a message exactly at the maximum length", () => {
    const maxLength = "a".repeat(MAX_DIRECT_MESSAGE_LENGTH);
    assert.equal(validateDirectMessageText(maxLength), maxLength);
  });

  it("test 14 — rejects HTML/script-significant characters outright (never rendered as executable content)", () => {
    assert.throws(
      () => validateDirectMessageText("<script>alert(1)</script>"),
      DirectMessagingValidationError,
    );
    assert.throws(() => validateDirectMessageText("Hello <b>world</b>"), DirectMessagingValidationError);
  });

  it("preserves line breaks for otherwise-safe text", () => {
    const result = validateDirectMessageText("Line one\nLine two\r\nLine three");
    assert.equal(result, "Line one\nLine two\nLine three");
  });

  it("trims surrounding whitespace", () => {
    assert.equal(validateDirectMessageText("  hello  "), "hello");
  });

  it("rejects non-string input", () => {
    assert.throws(() => validateDirectMessageText(undefined), DirectMessagingValidationError);
    assert.throws(() => validateDirectMessageText(42), DirectMessagingValidationError);
  });

  describe("buildDirectMessagePreview", () => {
    it("collapses whitespace and leaves short text untouched", () => {
      assert.equal(buildDirectMessagePreview("Hello   world"), "Hello world");
    });

    it("truncates long text with an ellipsis, never exposing the full body", () => {
      const longText = "a".repeat(300);
      const preview = buildDirectMessagePreview(longText);
      assert.ok(preview.length < longText.length);
      assert.ok(preview.endsWith("…"));
    });
  });

  describe("validateOptionalClientMessageId (Part 21 #2 — idempotency key)", () => {
    it("accepts undefined/null as no key provided", () => {
      assert.equal(validateOptionalClientMessageId(undefined), undefined);
      assert.equal(validateOptionalClientMessageId(null), undefined);
    });

    it("accepts and trims a valid key", () => {
      assert.equal(validateOptionalClientMessageId(" key-1 "), "key-1");
    });

    it("rejects an empty string key", () => {
      assert.throws(() => validateOptionalClientMessageId(""), DirectMessagingValidationError);
    });

    it("rejects an over-length key", () => {
      assert.throws(
        () => validateOptionalClientMessageId("a".repeat(129)),
        DirectMessagingValidationError,
      );
    });
  });
});
