import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ASSISTANT_CLIENT_MAX_HISTORY_TURNS,
  toAssistConversationHistory,
} from "./assistant-session-memory.js";

describe("Assistant browser session memory (Hardening Pack 01)", () => {
  it("exports a bounded client history length", () => {
    assert.ok(ASSISTANT_CLIENT_MAX_HISTORY_TURNS >= 4);
    assert.ok(ASSISTANT_CLIENT_MAX_HISTORY_TURNS <= 24);
  });

  it("omits greeting turns from assist history payloads", () => {
    const history = toAssistConversationHistory([
      { id: "greeting", role: "assistant", text: "Hello" },
      { id: "q1", role: "participant", text: "What is Tracking?" },
      { id: "a1", role: "assistant", text: "Tracking records progress." },
    ]);
    assert.equal(history.length, 2);
    assert.equal(history[0]?.role, "participant");
    assert.equal(history[1]?.text, "Tracking records progress.");
  });
});
