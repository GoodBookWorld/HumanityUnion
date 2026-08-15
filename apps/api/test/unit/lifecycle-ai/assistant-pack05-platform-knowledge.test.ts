import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import {
  ASSISTANT_OUT_OF_SCOPE_REPLY,
  ASSISTANT_UNKNOWN_PLATFORM_KNOWLEDGE_REPLY,
  DeterministicLifecycleAiProvider,
  PLATFORM_KNOWLEDGE_VERSION,
  buildLifecycleAiPrompt,
  requestHumanityUnionAssistantAssist,
  resetLifecycleAiProviderForTests,
  retrievePlatformKnowledge,
  setLifecycleAiProviderForTests,
} from "../../../src/modules/lifecycle-ai/index.js";
import type { RequestIdentity } from "../../../src/modules/initiatives/identity/request-identity.types.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const STEWARD_ID = "member-pack05-author-001";

function buildInitiative(): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack05-${Date.now()}`,
    stewardId: STEWARD_ID,
    createdAt: now,
    updatedAt: now,
    title: "Pack 05 Knowledge Garden",
    description: "Platform knowledge verification initiative.",
    status: "proposal",
    lifecyclePhase: "published",
    visibility: { policy: "public" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test Region",
      language: "en",
      communitySlug: "test-community",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

async function ask(question: string, surfaceId = "workspace") {
  const identity: RequestIdentity = {
    participantId: STEWARD_ID,
    displayName: "Vlad Participant",
  };
  return requestHumanityUnionAssistantAssist(identity, {
    surfaceId: surfaceId as never,
    operation: "answer_question",
    instructions: question,
  });
}

function replyText(result: Awaited<ReturnType<typeof ask>>): string {
  return result.suggestions[0]?.suggestedText ?? "";
}

describe("Humanity Union Assistant — Pack 05 platform knowledge", () => {
  let initiative: Initiative;

  beforeEach(() => {
    resetLifecycleAiProviderForTests();
    setLifecycleAiProviderForTests(new DeterministicLifecycleAiProvider());
    initiative = buildInitiative();
    createInitiative(initiative);
  });

  afterEach(() => {
    deleteInitiative(initiative.initiativeId);
    resetLifecycleAiProviderForTests();
  });

  it("1. Participant vs Member — Participant-first, Membership not required", async () => {
    const text = replyText(
      await ask("What is the difference between a Participant and a Member?"),
    );
    assert.match(text, /Participant is the universal foundational actor/i);
    assert.match(text, /not a prerequisite for ordinary participation/i);
    assert.doesNotMatch(text, /must be a member to participate/i);
  });

  it("2. Active Ally", async () => {
    const text = replyText(await ask("What is an Active Ally?"));
    assert.match(text, /Active Ally/i);
    assert.match(text, /Ready to Collaborate/i);
  });

  it("3. Ready to Collaborate", async () => {
    const text = replyText(await ask("What does Ready to Collaborate mean?"));
    assert.match(text, /Ready to Collaborate/i);
    assert.match(text, /not a global friendship/i);
  });

  it("4. Messages", async () => {
    const text = replyText(await ask("How do Messages work?", "messages"));
    assert.match(text, /Direct Messaging|Messages/i);
    assert.match(text, /never sent to the Assistant automatically/i);
  });

  it("5. Notifications", async () => {
    const text = replyText(await ask("What are Notifications?", "notifications"));
    assert.match(text, /Notifications are durable platform/i);
    assert.match(text, /Reminders/i);
  });

  it("6. Reminders", async () => {
    const text = replyText(await ask("What are Reminders?", "notifications"));
    assert.match(text, /Reminders are next-step/i);
    assert.match(text, /never vote, publish, or accept Commitments/i);
  });

  it("7. Lifecycle overview", async () => {
    const text = replyText(await ask("Explain the Initiative Lifecycle overview."));
    assert.match(text, /Collaborative Analysis/i);
    assert.match(text, /Civic Archive/i);
    assert.match(text, /Petition/i);
  });

  it("8. Collaborative Analysis", async () => {
    const text = replyText(
      await ask("What is Collaborative Analysis?", "analysis"),
    );
    assert.match(text, /Collaborative Analysis/i);
    assert.match(text, /evidence/i);
  });

  it("9. Petition — canonical non-binding principle", async () => {
    const text = replyText(await ask("What do Petition statistics mean?", "petition"));
    assert.match(
      text,
      /indicators of civic interest and support, not an official governmental or legally binding vote/i,
    );
  });

  it("10. Collective Decision", async () => {
    const text = replyText(
      await ask("What is a Collective Decision?", "collective_decision"),
    );
    assert.match(text, /WHAT was decided/i);
    assert.match(text, /Implementation Commitments/i);
  });

  it("11. Commitments", async () => {
    const text = replyText(
      await ask("How do Implementation Commitments work?", "commitment"),
    );
    assert.match(text, /voluntarily accepts responsibility/i);
    assert.match(text, /no forced responsibility/i);
  });

  it("12. Tracking", async () => {
    const text = replyText(
      await ask("What is Implementation Tracking?", "tracking"),
    );
    assert.match(text, /HOW implementation is progressing/i);
  });

  it("13. Official Responses", async () => {
    const text = replyText(
      await ask("What are Official Responses?", "official_response"),
    );
    assert.match(text, /Official Responses/i);
    assert.match(text, /must not invent institutional statements/i);
  });

  it("14. Public Impact", async () => {
    const text = replyText(await ask("What is Public Impact?", "public_impact"));
    assert.match(text, /Public Impact/i);
    assert.match(text, /not proof of impact/i);
  });

  it("15. Civic Archive", async () => {
    const text = replyText(await ask("What is the Civic Archive?", "archive"));
    assert.match(text, /Civic Archive/i);
    assert.match(text, /lessons/i);
  });

  it("16. Representative participation", async () => {
    const text = replyText(
      await ask("Are Support signals a legally binding vote?"),
    );
    assert.match(text, /not an official governmental or legally binding vote/i);
  });

  it("17. Profile privacy", async () => {
    const text = replyText(
      await ask("How does profile privacy and skills visibility work?", "profile"),
    );
    assert.match(text, /Privacy controls/i);
    assert.match(text, /never sent to AI automatically/i);
  });

  it("18. Unknown future feature — admit uncertainty", async () => {
    const text = replyText(
      await ask("Does Humanity Union support blockchain voting as a future feature?"),
    );
    assert.equal(text, ASSISTANT_UNKNOWN_PLATFORM_KNOWLEDGE_REPLY);
  });

  it("19. Unrelated request stays out of scope", async () => {
    const result = await ask("Give me a movie recommendation for tonight.");
    assert.equal(result.outOfScope, true);
    assert.match(replyText(result), new RegExp(ASSISTANT_OUT_OF_SCOPE_REPLY));
  });

  it("20. Conflicting generic-model knowledge is corrected", async () => {
    const text = replyText(
      await ask("Aren't Members the only people who can participate on the platform?"),
    );
    assert.match(text, /Participant is the universal foundational actor/i);
    assert.match(text, /not a prerequisite/i);
  });

  it("bounded retrieval for Active Ally avoids unrelated modules", () => {
    const knowledge = retrievePlatformKnowledge({
      instructions: "What is an Active Ally?",
      surfaceId: "workspace",
    });

    assert.ok(knowledge.moduleIds.includes("allies"));
    assert.ok(
      knowledge.moduleIds.includes("collaboration") ||
        knowledge.moduleIds.includes("participant_member"),
    );
    assert.ok(!knowledge.moduleIds.includes("civic_archive"));
    assert.ok(!knowledge.moduleIds.includes("media"));
    assert.ok(!knowledge.moduleIds.includes("tracking"));
    assert.equal(knowledge.platformKnowledgeVersion, PLATFORM_KNOWLEDGE_VERSION);
    assert.ok(knowledge.moduleIds.length <= 6);
  });

  it("prompt composer injects retrieved knowledge, not the full corpus dump", () => {
    const knowledge = retrievePlatformKnowledge({
      instructions: "What is an Active Ally?",
      surfaceId: "workspace",
    });
    const prompt = buildLifecycleAiPrompt({
      initiativeId: "platform",
      stageId: "initiative",
      stageLabel: "Workspace",
      operation: "answer_question",
      participantDisplayName: "Vlad",
      initiativeTitle: "Humanity Union",
      presentationMode: "public",
      availableSourceLabels: [],
      sourceContextSummary: "Workspace orientation",
      surfaceId: "workspace",
      featureLabel: "Workspace",
      instructions: "What is an Active Ally?",
      platformKnowledgePrompt: knowledge.promptBlock,
      platformKnowledgeVersion: knowledge.platformKnowledgeVersion,
    });

    assert.match(prompt.systemPrompt, /Platform Knowledge/i);
    assert.match(prompt.systemPrompt, /platformKnowledgeVersion/i);
    assert.match(prompt.systemPrompt, /Active Ally/i);
    assert.doesNotMatch(prompt.systemPrompt, /### Civic Archive/);
    assert.doesNotMatch(prompt.systemPrompt, /### Media\n/);
  });
});
