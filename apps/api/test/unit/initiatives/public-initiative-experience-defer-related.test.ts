/**
 * F.3.37 — related-initiative discovery is outside the primary experience response.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  COMMUNITY_INTELLIGENCE_CACHE_TTL_MS,
  COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
} from "../../../src/modules/community-intelligence/community-intelligence.constants.js";
import {
  clearCommunityIntelligenceCacheForTests,
  getCommunityIntelligenceCacheEntry,
  isCommunityIntelligenceCacheEntryFresh,
  setCommunityIntelligenceCacheEntry,
} from "../../../src/modules/community-intelligence/community-intelligence-cache.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../../../src");

function readSrc(rel: string): string {
  return readFileSync(path.join(srcRoot, rel), "utf8");
}

function experienceBuilder(source: string): string {
  const start = source.indexOf("export async function buildPublicInitiativeExperienceProjection");
  assert.ok(start >= 0);
  return source.slice(start);
}

describe("F.3.37 related initiatives leave the experience critical path", () => {
  const experience = readSrc("modules/initiatives/public-initiative-experience.service.ts");
  const builder = experienceBuilder(experience);
  const relatedService = readSrc("modules/community-intelligence/community-intelligence.service.ts");
  const relatedRoute = readSrc("modules/community-intelligence/community-intelligence.routes.ts");

  it("A. primary experience builder does not call related discovery", () => {
    assert.equal(builder.includes("findRelatedInitiativesForInitiative"), false);
    assert.equal(builder.includes("selectCandidateInitiatives"), false);
    assert.match(builder, /relatedInitiatives:\s*\[\]/);
  });

  it("B. primary experience still returns lifecycle, support, and discussion", () => {
    assert.match(builder, /toPublicInitiativeProjection\(initiative\)/);
    assert.match(builder, /getPublicInitiativeVersionHistory\(/);
    assert.match(builder, /buildStageRecords\(/);
    assert.match(builder, /buildLifecycleNavigation\(/);
    assert.match(builder, /resolveParticipantFacingCurrentStageId\(/);
    assert.match(builder, /lifecycleStages: stages/);
    assert.match(builder, /getInitiativeSupportStatistics\(/);
    assert.match(builder, /supportStatistics:/);
    assert.match(builder, /buildInitiativeDiscussionSummary\(/);
    assert.match(builder, /discussion,/);
  });

  it("C/D. related initiatives are fetched through the canonical public service", () => {
    assert.match(
      relatedRoute,
      /publicCommunityIntelligenceRouter\.get\(\s*"\/community-intelligence\/initiatives\/:initiativeId\/related"/,
    );
    assert.match(relatedRoute, /findRelatedInitiativesForInitiative\(initiativeId\)/);
    const definitions = relatedService.match(
      /export async function findRelatedInitiativesForInitiative/g,
    );
    assert.equal(definitions?.length, 1);
    assert.equal(experience.includes("function findRelatedInitiativesForInitiative"), false);
  });

  it("E. related cache TTL and freshness stay on the canonical cache", () => {
    assert.equal(COMMUNITY_INTELLIGENCE_CACHE_TTL_MS, 60_000);
    assert.match(relatedService, /getCommunityIntelligenceCacheEntry\(initiativeId\)/);
    assert.match(relatedService, /isCommunityIntelligenceCacheEntryFresh\(cached\)/);
    assert.match(
      relatedService,
      /expiresAt: Date\.now\(\) \+ COMMUNITY_INTELLIGENCE_CACHE_TTL_MS/,
    );
    assert.equal(builder.includes("setCommunityIntelligenceCacheEntry"), false);
    assert.equal(builder.includes("COMMUNITY_INTELLIGENCE_CACHE_TTL_MS"), false);

    const initiativeId = "f337-related-cache";
    clearCommunityIntelligenceCacheForTests();
    setCommunityIntelligenceCacheEntry(initiativeId, {
      expiresAt: Date.now() + COMMUNITY_INTELLIGENCE_CACHE_TTL_MS,
      items: [],
      providerId: "deterministic",
      algorithmVersion: COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
    });
    assert.equal(
      isCommunityIntelligenceCacheEntryFresh(getCommunityIntelligenceCacheEntry(initiativeId)),
      true,
    );
    setCommunityIntelligenceCacheEntry(initiativeId, {
      expiresAt: Date.now() - 1,
      items: [],
      providerId: "deterministic",
      algorithmVersion: COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
    });
    assert.equal(
      isCommunityIntelligenceCacheEntryFresh(getCommunityIntelligenceCacheEntry(initiativeId)),
      false,
    );
    clearCommunityIntelligenceCacheForTests();
  });

  it("F/G/H. related failure, providers, and locale stay out of the primary builder", () => {
    assert.equal(builder.includes("generateContentTranslation"), false);
    assert.equal(builder.includes("resolveCommunitySimilarityProvider"), false);
    assert.doesNotMatch(builder, /locale\s*===/);
    assert.match(builder, /latestInitiatives: selectLatestInitiatives\(initiative\)/);
  });

  it("I. collaboration and participation journey stay on the primary builder", () => {
    assert.match(builder, /attachCollaborationStateToComments\(/);
    assert.match(builder, /buildCollectiveParticipationJourney\(/);
    assert.match(builder, /participationJourney: participationJourney \?\? undefined/);
  });
});
