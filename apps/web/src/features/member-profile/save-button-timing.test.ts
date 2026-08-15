import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SAVE_BUTTON_SUCCESS_HOLD_MS } from "./save-button-timing";

describe("SAVE_BUTTON_SUCCESS_HOLD_MS", () => {
  it("holds Saved long enough to be noticed (platform standard)", () => {
    // Design System UX Pack 01 — ~1.8–2.2s success hold.
    assert.ok(SAVE_BUTTON_SUCCESS_HOLD_MS >= 1800);
    assert.ok(SAVE_BUTTON_SUCCESS_HOLD_MS <= 2200);
  });
});
