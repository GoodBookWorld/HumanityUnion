import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.LIFECYCLE_AI_PROVIDER = "deterministic";
process.env.LIFECYCLE_AI_DIAGNOSTICS = "true";
process.env.LIFECYCLE_AI_MAX_HISTORY_TURNS = "3";
process.env.LIFECYCLE_AI_MAX_PROMPT_CHARS = "2000";
process.env.LIFECYCLE_AI_MAX_REQUESTS_PER_MINUTE = "3";
process.env.LIFECYCLE_AI_DUPLICATE_WINDOW_MS = "60000";

import type { Initiative } from "@hu/types";

import {
  ASSISTANT_PROMPT_VERSIONS,
  DeterministicLifecycleAiProvider,
  assertAssistantAssistWithinLimits,
  boundConversationHistory,
  clearAssistantRateLimitBucketsForTests,
  enforcePromptBudget,
  estimatePromptChars,
  getAssistantUsageMetricSnapshotForTests,
  requestHumanityUnionAssistantAssist,
  resetAssistantUsageMetricsForTests,
  resetLifecycleAiProviderForTests,
  resolveAssistantPromptVersions,
  resolveLifecycleAiConfig,
  setLifecycleAiProviderForTests,
} from "../../../src/modules/lifecycle-ai/index.js";
import { LifecycleAiError } from "../../../src/modules/lifecycle-ai/lifecycle-ai.errors.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import type { RequestIdentity } from "../../../src/modules/initiatives/identity/request-identity.types.js";

function buildInitiative(): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-assistant-harden-${Date.now()}`,
    stewardId: "member-assistant-harden-001",
    createdAt: now,
    updatedAt: now,
    title: "Hardening Pack Garden",
    description: "Assistant production hardening verification.",
    status: "proposal",
    lifecyclePhase: "published",
    visibility: { policy: "public" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test",
      language: "en",
      communitySlug: "test",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

describe("Assistant Production Hardening Pack 01", () => {
  const identity: RequestIdentity = {
    participantId: "member-assistant-harden-001",
    displayName: "Hardening Author",
  };
  let initiative: Initiative;

  beforeEach(() => {
    resetLifecycleAiProviderForTests();
    setLifecycleAiProviderForTests(new DeterministicLifecycleAiProvider());
    resetAssistantUsageMetricsForTests();
    clearAssistantRateLimitBucketsForTests();
    initiative = buildInitiative();
    createInitiative(initiative);
  });

  afterEach(() => {
    deleteInitiative(initiative.initiativeId);
    resetLifecycleAiProviderForTests();
    resetAssistantUsageMetricsForTests();
    clearAssistantRateLimitBucketsForTests();
  });

  it("bounds conversation history and never exceeds configured turn count", () => {
    const history = boundConversationHistory(
      [
        { role: "participant", text: "one" },
        { role: "assistant", text: "two" },
        { role: "participant", text: "three" },
        { role: "assistant", text: "four" },
        { role: "participant", text: "five" },
      ],
      3,
      100,
    );
    assert.equal(history.length, 3);
    assert.equal(history[0]?.text, "three");
    assert.equal(history[2]?.text, "five");
  });

  it("enforces prompt budget without exposing API keys", () => {
    const config = {
      ...resolveLifecycleAiConfig(),
      maxPromptChars: 2000,
    };
    const prompt = enforcePromptBudget(
      {
        systemPrompt: "A".repeat(1800),
        userPrompt: "B".repeat(1800),
      },
      config,
    );
    assert.ok(estimatePromptChars(prompt) <= 2000);
    assert.equal(JSON.stringify(prompt).includes("GEMINI"), false);
  });

  it("records prompt versions for stage-aware requests", () => {
    const versions = resolveAssistantPromptVersions({
      stageId: "petition",
      surfaceId: "petition",
      platformKnowledgeVersion: ASSISTANT_PROMPT_VERSIONS.platformKnowledge,
    });
    assert.ok(versions.includes(ASSISTANT_PROMPT_VERSIONS.corePolicy));
    assert.ok(versions.includes(ASSISTANT_PROMPT_VERSIONS.petitionStage));
  });

  it("includes recent session memory in assist diagnostics and records metrics", async () => {
    const result = await requestHumanityUnionAssistantAssist(identity, {
      surfaceId: "workspace",
      operation: "answer_question",
      instructions: "What is an Active Ally?",
      conversationHistory: [
        { role: "participant", text: "Earlier question about Workspace" },
        { role: "assistant", text: "Earlier answer about Workspace" },
      ],
    });

    assert.equal(result.autoApplied, false);
    assert.equal(result.autoPublished, false);
    assert.ok(result.diagnostics?.promptVersions?.length);
    assert.equal(result.diagnostics?.conversationHistoryTurns, 2);
    assert.ok((result.diagnostics?.estimatedPromptChars ?? 0) > 0);

    const metrics = getAssistantUsageMetricSnapshotForTests();
    assert.equal(metrics.aggregates.totalRequests, 1);
    assert.equal(metrics.aggregates.successes, 1);
  });

  it("does not mutate Initiative records when assisting", async () => {
    const before = structuredClone(initiative);
    await requestHumanityUnionAssistantAssist(identity, {
      surfaceId: "initiative",
      initiativeId: initiative.initiativeId,
      stageId: "analysis",
      operation: "explain",
    });
    assert.deepEqual(initiative, before);
  });

  it("rate-limits duplicate rapid assist requests", () => {
    const req = {
      auth: { id: "harden-user", memberId: "harden-user" },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
      body: {
        surfaceId: "workspace",
        operation: "answer_question",
        instructions: "same question",
      },
    } as never;

    assertAssistantAssistWithinLimits(req);
    assert.throws(
      () => assertAssistantAssistWithinLimits(req),
      (error: unknown) => error instanceof LifecycleAiError && error.code === "rate_limited",
    );
  });
});
