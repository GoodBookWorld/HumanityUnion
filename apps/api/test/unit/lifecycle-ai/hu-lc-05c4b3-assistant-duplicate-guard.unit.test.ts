/**
 * HU-LC-05C.4B.3 — the Assistant duplicate-request guard distinguishes
 * independent Petition working drafts (draftId) without changing the limits
 * or the fingerprint of requests that carry no valid draftId.
 */
delete process.env.LIFECYCLE_AI_MAX_REQUESTS_PER_MINUTE;
delete process.env.LIFECYCLE_AI_MAX_REQUESTS_PER_DAY;
delete process.env.LIFECYCLE_AI_DUPLICATE_WINDOW_MS;

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  LifecycleAiError,
  assertAssistantAssistWithinLimits,
  clearAssistantRateLimitBucketsForTests,
  resolveLifecycleAiConfig,
} from "../../../src/modules/lifecycle-ai/index.js";

const PETITION = {
  surfaceId: "petition",
  stageId: "petition",
  initiativeId: "initiative-guard",
  operation: "improve_wording",
  instructions: "Make it shorter.",
};

function request(user: string, body: Record<string, unknown>) {
  return {
    auth: { id: user, memberId: user },
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    body,
  } as never;
}

function allowed(user: string, body: Record<string, unknown>): boolean {
  try {
    assertAssistantAssistWithinLimits(request(user, body));
    return true;
  } catch (error) {
    if (error instanceof LifecycleAiError && error.code === "rate_limited") {
      return false;
    }
    throw error;
  }
}

describe("HU-LC-05C.4B.3 — Assistant duplicate guard and Petition drafts", () => {
  beforeEach(() => {
    clearAssistantRateLimitBucketsForTests();
  });

  it("keeps the existing limits: 10 per minute, 200 per day, 4-second duplicate window", () => {
    const config = resolveLifecycleAiConfig();
    assert.equal(config.maxRequestsPerMinute, 10);
    assert.equal(config.maxRequestsPerDay, 200);
    assert.equal(config.duplicateRequestWindowMs, 4_000);
  });

  it("A — the same instructions for different drafts are both allowed", () => {
    assert.equal(allowed("user-a", { ...PETITION, draftId: "initiative-petition-draft-1" }), true);
    assert.equal(allowed("user-a", { ...PETITION, draftId: "initiative-petition-draft-2" }), true);
  });

  it("B — the same request for the same draft is rejected as a duplicate", () => {
    assert.equal(allowed("user-a", { ...PETITION, draftId: "initiative-petition-draft-1" }), true);
    assert.equal(allowed("user-a", { ...PETITION, draftId: "initiative-petition-draft-1" }), false);
    // Whitespace around the id is the same draft (as validated by the service).
    assert.equal(
      allowed("user-a", { ...PETITION, draftId: "  initiative-petition-draft-1 " }),
      false,
    );
  });

  it("existing user, Initiative, operation and instruction isolation still applies with a draftId", () => {
    const base = { ...PETITION, draftId: "initiative-petition-draft-1" };
    assert.equal(allowed("user-a", base), true);
    assert.equal(allowed("user-a", { ...base, initiativeId: "initiative-other" }), true);
    assert.equal(allowed("user-a", { ...base, operation: "generate_draft" }), true);
    assert.equal(allowed("user-a", { ...base, instructions: "Make it formal." }), true);
    // Instructions stay case- and whitespace-insensitive, as before.
    assert.equal(allowed("user-a", { ...base, instructions: "  MAKE IT SHORTER.  " }), false);
  });

  it("C — different users remain isolated", () => {
    const body = { ...PETITION, draftId: "initiative-petition-draft-1" };
    assert.equal(allowed("user-a", body), true);
    assert.equal(allowed("user-b", body), true);
    assert.equal(allowed("user-a", body), false);
    assert.equal(allowed("user-b", body), false);
  });

  it("D — requests without a draftId keep their existing duplicate behaviour", () => {
    assert.equal(allowed("user-a", PETITION), true);
    assert.equal(allowed("user-a", PETITION), false);

    const workspace = {
      surfaceId: "workspace",
      operation: "answer_question",
      instructions: "What is an Active Ally?",
    };
    assert.equal(allowed("user-a", workspace), true);
    assert.equal(allowed("user-a", workspace), false);
    // A draftId outside the Petition surface is ignored, as the service rejects it.
    assert.equal(
      allowed("user-a", { ...workspace, draftId: "initiative-petition-draft-1" }),
      false,
    );
  });

  it("F — malformed draftIds cannot vary the fingerprint", () => {
    assert.equal(allowed("user-a", PETITION), true);
    for (const draftId of ["", "   ", 42, null, true, { id: "x" }, ["x"], "d".repeat(201)]) {
      assert.equal(
        allowed("user-a", { ...PETITION, draftId }),
        false,
        `draftId ${JSON.stringify(draftId)}`,
      );
    }
  });

  it("E — the per-minute limit counts every request, whatever the draftId", () => {
    for (let index = 0; index < 10; index += 1) {
      assert.equal(
        allowed("user-a", { ...PETITION, draftId: `initiative-petition-draft-${index}` }),
        true,
        `request ${index + 1}`,
      );
    }
    assert.equal(
      allowed("user-a", { ...PETITION, draftId: "initiative-petition-draft-new" }),
      false,
    );
    assert.equal(
      allowed("user-b", { ...PETITION, draftId: "initiative-petition-draft-new" }),
      true,
    );
  });

  it("E — rejected duplicates still count toward the per-minute limit", () => {
    const body = { ...PETITION, draftId: "initiative-petition-draft-1" };
    for (let index = 0; index < 10; index += 1) {
      allowed("user-a", body);
    }
    assert.equal(allowed("user-a", { ...PETITION, draftId: "initiative-petition-draft-2" }), false);
  });

  it("E — the per-day limit counts every request, whatever the draftId", () => {
    process.env.LIFECYCLE_AI_MAX_REQUESTS_PER_MINUTE = "100000";
    try {
      for (let index = 0; index < 200; index += 1) {
        assert.equal(
          allowed("user-a", { ...PETITION, draftId: `initiative-petition-draft-${index}` }),
          true,
          `request ${index + 1}`,
        );
      }
      assert.equal(
        allowed("user-a", { ...PETITION, draftId: "initiative-petition-draft-day" }),
        false,
      );
    } finally {
      delete process.env.LIFECYCLE_AI_MAX_REQUESTS_PER_MINUTE;
    }
  });
});
