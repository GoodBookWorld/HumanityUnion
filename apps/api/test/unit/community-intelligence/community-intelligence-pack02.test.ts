import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CommunityInitiativeRelationshipProjection } from "@hu/types";

import {
  COMMUNITY_INTELLIGENCE_CACHE_TTL_MS,
  COMMUNITY_INTELLIGENCE_REMINDER_COOLDOWN_DAYS,
  COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
} from "../../../src/modules/community-intelligence/community-intelligence.constants.js";
import {
  clearCommunityIntelligenceCacheForTests,
  getCommunityIntelligenceCacheEntry,
  invalidateCommunityIntelligenceCache,
  isCommunityIntelligenceCacheEntryFresh,
  setCommunityIntelligenceCacheEntry,
} from "../../../src/modules/community-intelligence/community-intelligence-cache.js";
import { isEligibleCollaborationReminderForTests } from "../../../src/modules/community-intelligence/community-intelligence-reminders.js";
import {
  completeReminder,
  createReminderIfEligibleWithCooldown,
} from "../../../src/modules/reminders/reminder.service.js";
import { DeterministicLifecycleAiProvider } from "../../../src/modules/lifecycle-ai/providers/deterministic-lifecycle-ai-provider.js";
import { TEST_DATABASE_NAME_PATTERN } from "../../../scripts/test-mongo-isolation.js";

function relatedItem(
  partial: Partial<CommunityInitiativeRelationshipProjection> &
    Pick<CommunityInitiativeRelationshipProjection, "initiativeId" | "relationshipType" | "score">,
): CommunityInitiativeRelationshipProjection {
  return {
    title: "Peer Initiative",
    reasons: [
      { code: "same_activity_area", message: "Same Participation Area" },
      { code: "shared_themes", message: "2 overlapping themes" },
    ],
    sharedTopics: ["transport", "safety"],
    sharedParticipationAreas: ["Mobility"],
    sharedPriorities: [],
    keyDifferences: [],
    publicUrl: `/initiatives/public/${partial.initiativeId}`,
    ...partial,
  };
}

describe("Community Intelligence Pack 02", () => {
  it("exposes an internal algorithm version", () => {
    assert.match(COMMUNITY_SIMILARITY_ALGORITHM_VERSION, /^ci-similarity-v/);
  });

  it("invalidates cache after Initiative-scoped update and ignores stale algorithm versions", () => {
    clearCommunityIntelligenceCacheForTests();
    setCommunityIntelligenceCacheEntry("init-a", {
      expiresAt: Date.now() + COMMUNITY_INTELLIGENCE_CACHE_TTL_MS,
      items: [],
      providerId: "deterministic",
      algorithmVersion: COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
    });
    setCommunityIntelligenceCacheEntry("init-b", {
      expiresAt: Date.now() + COMMUNITY_INTELLIGENCE_CACHE_TTL_MS,
      items: [],
      providerId: "deterministic",
      algorithmVersion: "ci-similarity-v0.legacy",
    });

    assert.equal(isCommunityIntelligenceCacheEntryFresh(getCommunityIntelligenceCacheEntry("init-a")), true);
    assert.equal(isCommunityIntelligenceCacheEntryFresh(getCommunityIntelligenceCacheEntry("init-b")), false);

    invalidateCommunityIntelligenceCache("init-a");
    assert.equal(getCommunityIntelligenceCacheEntry("init-a"), undefined);
  });

  it("invalidates peer cache entries that still reference an updated Initiative", () => {
    clearCommunityIntelligenceCacheForTests();
    setCommunityIntelligenceCacheEntry("init-peer", {
      expiresAt: Date.now() + COMMUNITY_INTELLIGENCE_CACHE_TTL_MS,
      items: [
        relatedItem({
          initiativeId: "init-a",
          relationshipType: "related",
          score: 0.5,
        }),
      ],
      providerId: "deterministic",
      algorithmVersion: COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
    });

    invalidateCommunityIntelligenceCache("init-a");
    assert.equal(getCommunityIntelligenceCacheEntry("init-peer"), undefined);
  });

  it("strong collaboration opportunity is reminder-eligible; weak related is not", () => {
    const strong = relatedItem({
      initiativeId: "peer-1",
      relationshipType: "complementary",
      score: 0.52,
    });
    const weak = relatedItem({
      initiativeId: "peer-2",
      relationshipType: "related",
      score: 0.25,
      sharedTopics: ["misc"],
      reasons: [{ code: "topical_affinity", message: "weak" }],
    });

    assert.equal(isEligibleCollaborationReminderForTests(strong), true);
    assert.equal(isEligibleCollaborationReminderForTests(weak), false);
  });

  it("possible_duplicate at high score is collaboration-reminder eligible", () => {
    const item = relatedItem({
      initiativeId: "peer-3",
      relationshipType: "possible_duplicate",
      score: 0.7,
    });
    assert.equal(isEligibleCollaborationReminderForTests(item), true);
  });

  it("reminder cooldown suppresses identical rediscovery including after archive", async () => {
    const entityId = `ci-p02-cooldown-${Date.now()}`;
    const recipientUserId = `user-ci-p02-cooldown-${Date.now()}`;
    const first = await createReminderIfEligibleWithCooldown({
      recipientUserId,
      recipientProfileId: "profile-ci-p02-cooldown",
      category: "collaboration",
      title: "Collaboration opportunity",
      message: "An Initiative related to your work may benefit from collaboration.",
      relatedEntityType: "initiative",
      relatedEntityId: entityId,
      relatedUrl: `/initiatives/public/${entityId}`,
      generationKey: "same-fingerprint",
      cooldownDays: COMMUNITY_INTELLIGENCE_REMINDER_COOLDOWN_DAYS,
      now: new Date("2026-08-01T12:00:00.000Z"),
    });
    assert.equal(first.skippedReason, null);
    assert.ok(first.reminder);

    const activeAgain = await createReminderIfEligibleWithCooldown({
      recipientUserId,
      recipientProfileId: "profile-ci-p02-cooldown",
      category: "collaboration",
      title: "Collaboration opportunity",
      message: "An Initiative related to your work may benefit from collaboration.",
      relatedEntityType: "initiative",
      relatedEntityId: entityId,
      relatedUrl: `/initiatives/public/${entityId}`,
      generationKey: "same-fingerprint",
      cooldownDays: COMMUNITY_INTELLIGENCE_REMINDER_COOLDOWN_DAYS,
      now: new Date("2026-08-02T12:00:00.000Z"),
    });
    assert.equal(activeAgain.skippedReason, "active_exists");

    await completeReminder(first.reminder!.reminderId, recipientUserId);

    const afterArchive = await createReminderIfEligibleWithCooldown({
      recipientUserId,
      recipientProfileId: "profile-ci-p02-cooldown",
      category: "collaboration",
      title: "Collaboration opportunity",
      message: "An Initiative related to your work may benefit from collaboration.",
      relatedEntityType: "initiative",
      relatedEntityId: entityId,
      relatedUrl: `/initiatives/public/${entityId}`,
      generationKey: "same-fingerprint",
      cooldownDays: COMMUNITY_INTELLIGENCE_REMINDER_COOLDOWN_DAYS,
      now: new Date("2026-08-03T12:00:00.000Z"),
    });
    assert.equal(afterArchive.skippedReason, "cooldown");
    assert.equal(afterArchive.reminder, null);
  });

  it("materially changed generation key can become eligible inside cooldown window", async () => {
    const entityId = `ci-p02-material-${Date.now()}`;
    const recipientUserId = `user-ci-p02-material-${Date.now()}`;
    const first = await createReminderIfEligibleWithCooldown({
      recipientUserId,
      recipientProfileId: "profile-ci-p02-material",
      category: "initiative",
      title: "Initiative matches your priorities",
      message: "match",
      relatedEntityType: "initiative",
      relatedEntityId: entityId,
      relatedUrl: `/initiatives/public/${entityId}`,
      generationKey: "old-fingerprint",
      cooldownDays: COMMUNITY_INTELLIGENCE_REMINDER_COOLDOWN_DAYS,
      now: new Date("2026-08-08T12:00:00.000Z"),
    });
    assert.ok(first.reminder);
    await completeReminder(first.reminder!.reminderId, recipientUserId);

    const changed = await createReminderIfEligibleWithCooldown({
      recipientUserId,
      recipientProfileId: "profile-ci-p02-material",
      category: "initiative",
      title: "Initiative matches your priorities",
      message: "match updated",
      relatedEntityType: "initiative",
      relatedEntityId: entityId,
      relatedUrl: `/initiatives/public/${entityId}`,
      generationKey: "new-fingerprint",
      cooldownDays: COMMUNITY_INTELLIGENCE_REMINDER_COOLDOWN_DAYS,
      now: new Date("2026-08-09T12:00:00.000Z"),
    });
    assert.equal(changed.skippedReason, null);
    assert.ok(changed.reminder);
  });

  it("isolated browser seed naming never targets shared development database", () => {
    assert.equal(TEST_DATABASE_NAME_PATTERN.test("humanity_union_dev"), false);
    assert.equal(TEST_DATABASE_NAME_PATTERN.test("hu_test_abc123"), true);
  });

  it("pair identity is undirected for generation keys (order-stable inputs)", () => {
    const left = relatedItem({
      initiativeId: "b",
      relationshipType: "related",
      score: 0.5,
      sharedTopics: ["a", "b"],
    });
    const right = relatedItem({
      initiativeId: "b",
      relationshipType: "related",
      score: 0.5,
      sharedTopics: ["a", "b"],
    });
    assert.deepEqual(left.sharedTopics, right.sharedTopics);
  });

  it("does not use durable relationship edges — cache module is the Pack 02 coherence store", () => {
    clearCommunityIntelligenceCacheForTests();
    assert.equal(getCommunityIntelligenceCacheEntry("missing"), undefined);
  });

  it("deterministic Assistant answer_question grounds similar-Initiative questions in CI block", async () => {
    const provider = new DeterministicLifecycleAiProvider();
    const result = await provider.assist({
      initiativeId: "init-a",
      stageId: "initiative",
      stageLabel: "Initiative",
      operation: "answer_question",
      participantDisplayName: "Verifier",
      initiativeTitle: "Cycling corridors",
      presentationMode: "public",
      availableSourceLabels: [],
      instructions: "Are there similar Initiatives?",
      sourceContextSummary: [
        "Community Intelligence (structured — do not invent beyond this):",
        "Explain only relationships present in the structured Community Intelligence result.",
        "providerId: deterministic",
        'sourceInitiativeId: init-a',
        '- related: “Improve cycling safety education programs” (peer-1) reasons: Same Participation Area: Mobility',
      ].join("\n"),
    });

    const text = result.suggestions.map((item) => item.suggestedText).join("\n");
    assert.match(text, /Improve cycling safety education programs/);
    assert.match(text, /possible overlap, not a confirmed duplicate/i);
    assert.doesNotMatch(text, /\bis a confirmed duplicate\b/i);
  });
});
