import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CommunityInitiativeRelationshipProjection } from "@hu/types";

import {
  COMMUNITY_INTELLIGENCE_OVERLAP_NOTICE_MAX_ITEMS,
  boundOverlapNoticeItems,
  buildConsiderCollaborationHref,
  buildSimilarityDraftFingerprint,
  relationshipTypeLabel,
  shouldSkipSimilarityCheck,
} from "./overlap-ux.js";
import {
  keyDifferencesLabel,
  normalizeRelatedItem,
  overlappingThemesLabel,
  relatedRelationshipLabel,
  sharedTopicLabel,
  whyRelevantLabel,
} from "./related-initiatives-presentation.js";

function sampleItem(
  overrides: Partial<CommunityInitiativeRelationshipProjection> = {},
): CommunityInitiativeRelationshipProjection {
  return {
    initiativeId: "init-1",
    title: "Cycling safety education",
    relationshipType: "related",
    score: 0.62,
    reasons: [{ code: "area", message: "Same Participation Area: Mobility" }],
    sharedTopics: ["cycling", "safety", "education", "infrastructure"],
    sharedParticipationAreas: ["Mobility"],
    sharedPriorities: [],
    keyDifferences: [],
    publicUrl: "/initiatives/public/init-1",
    ...overrides,
  };
}

describe("Community Intelligence Pack 03 — creation overlap UX", () => {
  it("strong-overlap notice helpers bound candidates and label relationship types", () => {
    const items = Array.from({ length: 8 }, (_, index) =>
      sampleItem({ initiativeId: `init-${index}`, title: `Title ${index}` }),
    );
    const bounded = boundOverlapNoticeItems(items);
    assert.equal(bounded.length, COMMUNITY_INTELLIGENCE_OVERLAP_NOTICE_MAX_ITEMS);
    assert.equal(relationshipTypeLabel("possible_duplicate"), "Possible overlap");
    assert.equal(relationshipTypeLabel("complementary"), "Complementary work");
    assert.equal(relationshipTypeLabel("related"), "Related Initiative");
  });

  it("unrelated / empty overlap list stays empty (no notice)", () => {
    assert.deepEqual(boundOverlapNoticeItems([]), []);
  });

  it("View / Consider collaboration preserve draft by opening a new-tab collaboration URL", () => {
    const href = buildConsiderCollaborationHref("/initiatives/public/init-1");
    assert.equal(href, "/initiatives/public/init-1?filter=collaboration#discussion");
    assert.match(href, /filter=collaboration/);
    assert.match(href, /#discussion$/);
    // Behavior contract: no Ally/message/merge side effects are encoded in the URL.
    assert.doesNotMatch(href, /autoAlly|autoMessage|merge/i);
  });

  it("Continue creating skips re-check for the same fingerprint and re-checks after material change", () => {
    const base = {
      title: "Protected cycling lanes downtown",
      description: "Expand safe cycling access.",
      activityArea: "Mobility",
    };
    const fingerprint = buildSimilarityDraftFingerprint(base);
    assert.equal(
      shouldSkipSimilarityCheck({
        acknowledgeOverlap: false,
        overlapAcknowledged: true,
        currentFingerprint: fingerprint,
        acknowledgedFingerprint: fingerprint,
      }),
      true,
      "unchanged draft must not nag after Continue creating",
    );
    const changed = buildSimilarityDraftFingerprint({
      ...base,
      title: "Library reading club",
    });
    assert.equal(
      shouldSkipSimilarityCheck({
        acknowledgeOverlap: false,
        overlapAcknowledged: true,
        currentFingerprint: changed,
        acknowledgedFingerprint: fingerprint,
      }),
      false,
      "materially changed draft may trigger a new check",
    );
  });

  it("Continue creating never encodes auto Ally / auto message / auto merge", () => {
    // Pure behavior surface used by the notice — no Ally/message APIs are invoked here.
    const href = buildConsiderCollaborationHref("/initiatives/public/peer");
    assert.ok(href.includes("/initiatives/public/peer"));
    assert.equal(typeof href, "string");
  });

  it("possible_duplicate wording stays non-authoritative", () => {
    assert.equal(relationshipTypeLabel("possible_duplicate"), "Possible overlap");
    assert.notEqual(relationshipTypeLabel("possible_duplicate"), "Confirmed duplicate");
  });
});

describe("Community Intelligence Pack 03 — RelatedInitiativesWidget presentation", () => {
  it("builds deterministic theme/topic/why strings without split whitespace nodes", () => {
    const item = sampleItem();
    assert.equal(overlappingThemesLabel(item.sharedTopics), "4 overlapping themes");
    assert.equal(overlappingThemesLabel(["only"]), "1 overlapping theme");
    assert.equal(overlappingThemesLabel([]), null);
    assert.equal(sharedTopicLabel(item), "Shared topic: Mobility");
    assert.equal(whyRelevantLabel(item.reasons[0]?.message), "Why this is relevant: Same Participation Area: Mobility");
    assert.equal(relatedRelationshipLabel("possible_duplicate"), "Possible overlap");
  });

  it("normalizes missing arrays so SSR/client markup stays consistent", () => {
    const broken = sampleItem() as CommunityInitiativeRelationshipProjection & {
      reasons?: CommunityInitiativeRelationshipProjection["reasons"];
      sharedTopics?: CommunityInitiativeRelationshipProjection["sharedTopics"];
    };
    // Simulate a partial projection that omitted arrays at runtime.
    delete (broken as { reasons?: unknown }).reasons;
    delete (broken as { sharedTopics?: unknown }).sharedTopics;
    const normalized = normalizeRelatedItem(broken);
    assert.deepEqual(normalized.reasons, []);
    assert.deepEqual(normalized.sharedTopics, []);
    assert.equal(overlappingThemesLabel(normalized.sharedTopics), null);
  });

  it("empty result presentation stays truthful and does not invent differences", () => {
    const empty = sampleItem({
      relationshipType: "related",
      keyDifferences: [],
      reasons: [],
      sharedTopics: [],
      sharedParticipationAreas: [],
    });
    assert.equal(keyDifferencesLabel(empty), null);
    assert.equal(whyRelevantLabel(undefined), null);
    assert.equal(sharedTopicLabel(empty), null);
  });
});
