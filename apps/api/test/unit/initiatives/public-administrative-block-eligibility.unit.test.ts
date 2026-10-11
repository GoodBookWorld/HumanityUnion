/**
 * HU-INIT-04A — ordinary-public Initiative eligibility includes the administrative block.
 * Block and unblock commands themselves are unchanged: they only flip the flag.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
delete process.env.MONGODB_URI;

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { after, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

import express from "express";
import type { BlogPost, Initiative } from "@hu/types";

import type { GlobalSearchIndexEntry } from "../../../src/modules/global-search/global-search.types.js";
import { createAccessToken } from "../../../src/modules/auth/auth-tokens.js";
import { isBlogPostPubliclyDeliverable } from "../../../src/modules/blog/blog-publication-delivery.service.js";
import { COMMUNITY_SIMILARITY_ALGORITHM_VERSION } from "../../../src/modules/community-intelligence/community-intelligence.constants.js";
import {
  getCommunityIntelligenceCacheEntry,
  setCommunityIntelligenceCacheEntry,
} from "../../../src/modules/community-intelligence/community-intelligence-cache.js";
import { selectCandidateInitiatives } from "../../../src/modules/community-intelligence/community-intelligence-matching.js";
import { findRelatedInitiativesForInitiative } from "../../../src/modules/community-intelligence/community-intelligence.service.js";
import { listCountryInitiativeCardProjections } from "../../../src/modules/country-statistics/country-public.service.js";
import { searchPublicCivicRecords } from "../../../src/modules/global-search/global-search.service.js";
import {
  getGlobalSearchIndex,
  isPublicInitiative,
  resetGlobalSearchIndexForTests,
  setGlobalSearchIndexForTests,
} from "../../../src/modules/global-search/global-search.index.js";
import { invalidateOrdinaryPublicInitiativeCaches } from "../../../src/modules/initiatives/invalidate-ordinary-public-initiative-caches.js";
import { buildCommunityLatestInitiativesProjection } from "../../../src/modules/initiatives/initiative-public-projection.access.js";
import { isInitiativeEligibleForPublicProjection } from "../../../src/modules/initiatives/initiative-public-projection.access.js";
import { listWorldInitiativeCardProjections } from "../../../src/modules/initiatives/initiative-world-initiatives.projection.js";
import {
  createInitiative,
  deleteInitiative,
  listInitiatives,
  updateInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import publicInitiativeExperienceRouter from "../../../src/modules/initiatives/public-initiative-experience.routes.js";
import { publicChoiceResultsRetentionRouter } from "../../../src/modules/public-choice-results-retention/public-choice-results-retention.routes.js";
import publicInitiativeRouter from "../../../src/modules/initiatives/public-initiative.routes.js";
import { publicChoiceCandidateRouter } from "../../../src/modules/public-choice-candidate/public-choice-candidate.routes.js";
import { listPublicChoiceCandidatesForInitiative } from "../../../src/modules/public-choice-candidate/public-choice-candidate.service.js";
import { resetPublicChoiceCandidatesForTests } from "../../../src/modules/public-choice-candidate/public-choice-candidate.memory.store.js";
import { insertPublicChoiceCandidate } from "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js";
import { listPublicSitemapInitiatives } from "../../../src/modules/sitemap/public-sitemap.service.js";

const createdIds: string[] = [];

function initiative(
  initiativeId: string,
  overrides: Partial<Initiative> & { metadata?: Partial<Initiative["metadata"]> } = {},
): Initiative {
  const now = "2026-10-11T00:00:00.000Z";
  const { metadata, ...rest } = overrides;
  return {
    initiativeId,
    stewardId: "hu04a-steward",
    createdAt: now,
    updatedAt: now,
    title: `HU04A ${initiativeId}`,
    description: "Ordinary public eligibility fixture.",
    status: "discussion",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "Governance",
      tags: [],
      region: "",
      language: "en",
      communitySlug: "",
      activityArea: "Governance",
      participationScope: "country",
      countrySlug: "ca",
      ...metadata,
    },
    revisions: [],
    contributions: [],
    timeline: [],
    ...rest,
  };
}

function track(record: Initiative): Initiative {
  createdIds.push(record.initiativeId);
  return createInitiative(record);
}

after(() => {
  for (const initiativeId of createdIds) {
    deleteInitiative(initiativeId);
  }
  resetPublicChoiceCandidatesForTests();
  resetGlobalSearchIndexForTests();
});

describe("HU-INIT-04A ordinary-public eligibility", () => {
  it("excludes a blocked projected public Initiative and keeps an unblocked one", () => {
    const open = track(initiative("hu04a-open"));
    const blocked = track(
      initiative("hu04a-blocked", {
        administrativelyBlocked: true,
        administrativeBlockAuthority: "ADMIN",
      }),
    );

    assert.equal(isInitiativeEligibleForPublicProjection(open), true);
    assert.equal(blocked.lifecyclePhase, "projected");
    assert.equal(blocked.visibility.policy, "public");
    assert.equal(blocked.status, "discussion");
    assert.equal(isInitiativeEligibleForPublicProjection(blocked), false);
  });

  it("keeps archived and steward-only Initiatives non-public after unblock", () => {
    track(
      initiative("hu04a-archived", {
        administrativelyBlocked: true,
        lifecyclePhase: "archived",
        status: "archived",
      }),
    );
    track(
      initiative("hu04a-steward", {
        administrativelyBlocked: true,
        visibility: { policy: "steward_only" },
      }),
    );

    const archived = updateInitiative("hu04a-archived", { administrativelyBlocked: false });
    const stewardOnly = updateInitiative("hu04a-steward", { administrativelyBlocked: false });

    assert.equal(archived?.administrativelyBlocked, undefined);
    assert.equal(archived?.lifecyclePhase, "archived");
    assert.equal(isInitiativeEligibleForPublicProjection(archived!), false);
    assert.equal(stewardOnly?.visibility.policy, "steward_only");
    assert.equal(stewardOnly?.lifecyclePhase, "projected");
    assert.equal(isInitiativeEligibleForPublicProjection(stewardOnly!), false);
  });

  it("omits blocked Initiatives from world, community, country election, sitemap, search, and related content", async () => {
    track(
      initiative("hu04a-world-open", {
        metadata: { participationScope: "world", communitySlug: "" },
      }),
    );
    track(
      initiative("hu04a-world-blocked", {
        administrativelyBlocked: true,
        metadata: { participationScope: "world", communitySlug: "" },
      }),
    );
    track(
      initiative("hu04a-community-open", {
        metadata: { communitySlug: "nelson-community-garden", participationScope: "country" },
      }),
    );
    track(
      initiative("hu04a-community-blocked", {
        administrativelyBlocked: true,
        metadata: { communitySlug: "nelson-community-garden", participationScope: "country" },
      }),
    );
    track(
      initiative("hu04a-election-open", {
        lifecycleProfile: "PUBLIC_CHOICE",
        metadata: { participationScope: "country", countrySlug: "ca", communitySlug: "" },
      }),
    );
    track(
      initiative("hu04a-election-blocked", {
        lifecycleProfile: "PUBLIC_CHOICE",
        administrativelyBlocked: true,
        metadata: { participationScope: "country", countrySlug: "ca", communitySlug: "" },
      }),
    );
    track(initiative("hu04a-related-source"));
    track(initiative("hu04a-related-open"));
    track(initiative("hu04a-related-blocked", { administrativelyBlocked: true }));

    const worldIds = listWorldInitiativeCardProjections(listInitiatives()).map(
      (card) => card.initiativeId,
    );
    assert.ok(worldIds.includes("hu04a-world-open"));
    assert.equal(worldIds.includes("hu04a-world-blocked"), false);

    const community = buildCommunityLatestInitiativesProjection("nelson-community-garden");
    const communityIds = community?.initiatives.map((card) => card.initiativeId) ?? [];
    assert.ok(communityIds.includes("hu04a-community-open"));
    assert.equal(communityIds.includes("hu04a-community-blocked"), false);

    const elections = await listCountryInitiativeCardProjections("ca", {
      lifecycleProfile: "PUBLIC_CHOICE",
    });
    const electionIds = elections.map((card) => card.initiativeId);
    assert.ok(electionIds.includes("hu04a-election-open"));
    assert.equal(electionIds.includes("hu04a-election-blocked"), false);
    assert.equal(
      elections.some((card) => card.administrativelyBlocked === true),
      false,
    );

    const sitemapIds = listPublicSitemapInitiatives().map((entry) => entry.initiativeId);
    assert.ok(sitemapIds.includes("hu04a-open"));
    assert.equal(sitemapIds.includes("hu04a-blocked"), false);
    assert.equal(sitemapIds.includes("hu04a-archived"), false);
    assert.equal(sitemapIds.includes("hu04a-steward"), false);

    assert.equal(isPublicInitiative("hu04a-open"), true);
    assert.equal(isPublicInitiative("hu04a-blocked"), false);
    assert.equal(isPublicInitiative("hu04a-archived"), false);
    assert.equal(isPublicInitiative("hu04a-steward"), false);
    const indexSource = readFileSync(
      fileURLToPath(new URL("../../../src/modules/global-search/global-search.index.ts", import.meta.url)),
      "utf8",
    );
    const initiativeLoop = indexSource.slice(
      indexSource.indexOf("for (const initiative of listInitiatives())"),
      indexSource.indexOf("for (const analysis of listAnalyses())"),
    );
    assert.match(initiativeLoop, /isPublicInitiative\(initiative\.initiativeId\)/);
    assert.doesNotMatch(initiativeLoop, /draft/);

    const relatedCandidates = selectCandidateInitiatives(
      { initiativeId: "hu04a-related-source", metadata: initiative("unused").metadata },
      listInitiatives(),
    ).map((item) => item.initiativeId);
    assert.ok(relatedCandidates.includes("hu04a-related-open"));
    assert.equal(relatedCandidates.includes("hu04a-related-blocked"), false);

    const relatedToBlocked = await findRelatedInitiativesForInitiative("hu04a-related-blocked");
    assert.deepEqual(relatedToBlocked.items, []);
  });

  it("hides a blocked parent roster and omits a blocked candidate from a public election", async () => {
    track(
      initiative("hu04a-roster-parent", {
        lifecycleProfile: "PUBLIC_CHOICE",
        administrativelyBlocked: true,
      }),
    );
    await assert.rejects(
      () => listPublicChoiceCandidatesForInitiative("hu04a-roster-parent"),
      /Initiative not found/,
    );

    track(initiative("hu04a-roster-open", { lifecycleProfile: "PUBLIC_CHOICE" }));
    const now = "2026-10-11T00:00:00.000Z";
    await insertPublicChoiceCandidate({
      candidateId: "hu04a-candidate-open",
      initiativeId: "hu04a-roster-open",
      name: "Open Candidate",
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
    await insertPublicChoiceCandidate({
      candidateId: "hu04a-candidate-blocked",
      initiativeId: "hu04a-roster-open",
      name: "Blocked Candidate",
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
      administrativelyBlocked: true,
      administrativeBlockAuthority: "ADMIN",
    });

    const roster = await listPublicChoiceCandidatesForInitiative("hu04a-roster-open");
    assert.deepEqual(
      roster.map((candidate) => candidate.candidateId),
      ["hu04a-candidate-open"],
    );

    const elections = await listCountryInitiativeCardProjections("ca", {
      lifecycleProfile: "PUBLIC_CHOICE",
    });
    const openElection = elections.find((card) => card.initiativeId === "hu04a-roster-open");
    assert.equal(openElection?.candidateCount, 1);
  });

  it("returns the same 404 for blocked public reads, including with an admin token", async () => {
    const blockedTitle = "HU04B-SECRET-BLOCKED-TITLE";
    const blockedDescription = "HU04B-SECRET-BLOCKED-DESCRIPTION";
    const blockedCandidate = "HU04B-SECRET-CANDIDATE";
    track(
      initiative("hu04a-http-blocked", {
        administrativelyBlocked: true,
        title: blockedTitle,
        description: blockedDescription,
      }),
    );
    track(initiative("hu04a-http-hidden", { visibility: { policy: "steward_only" } }));
    track(initiative("hu04a-http-open"));
    track(
      initiative("hu04a-http-election", {
        lifecycleProfile: "PUBLIC_CHOICE",
        administrativelyBlocked: true,
        title: blockedTitle,
        description: blockedDescription,
      }),
    );
    const now = "2026-10-11T00:00:00.000Z";
    await insertPublicChoiceCandidate({
      candidateId: "hu04a-http-secret-candidate",
      initiativeId: "hu04a-http-election",
      name: blockedCandidate,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });

    const adminToken = createAccessToken({
      sub: "hu04a-admin-user",
      memberId: "hu04a-admin-member",
      role: "admin",
      displayName: "HU04A Admin",
      email: "hu04a-admin@example.com",
    });
    const app = express();
    app.use("/public/initiatives", publicInitiativeRouter);
    app.use("/public/initiatives", publicInitiativeExperienceRouter);
    app.use("/public/initiatives", publicChoiceCandidateRouter);
    app.use("/public/initiatives", publicChoiceResultsRetentionRouter);
    const server: Server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    try {
      const port = (server.address() as AddressInfo).port;
      const adminHeaders = { Authorization: `Bearer ${adminToken}` };

      async function read(path: string, headers?: Record<string, string>) {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
        const text = await response.text();
        return { status: response.status, text, body: JSON.parse(text) as { message?: string } };
      }

      const paths = [
        "/public/initiatives/hu04a-http-blocked",
        "/public/initiatives/hu04a-http-blocked/experience",
        "/public/initiatives/hu04a-http-election/candidates",
        "/public/initiatives/hu04a-http-election/public-choice-results/status",
        "/public/initiatives/hu04a-http-election/public-choice-results/download",
      ];

      for (const path of paths) {
        const anonymous = await read(path);
        const admin = await read(path, adminHeaders);
        assert.equal(anonymous.status, 404, path);
        assert.equal(admin.status, 404, path);
        assert.equal(anonymous.text, admin.text, path);
        assert.equal(anonymous.body.message, "Initiative not found.");
        assert.equal(anonymous.text.includes(blockedTitle), false, path);
        assert.equal(anonymous.text.includes(blockedDescription), false, path);
        assert.equal(anonymous.text.includes(blockedCandidate), false, path);
      }

      const hiddenGet = await read("/public/initiatives/hu04a-http-hidden", adminHeaders);
      const blockedGet = await read("/public/initiatives/hu04a-http-blocked", adminHeaders);
      const hiddenExperience = await read(
        "/public/initiatives/hu04a-http-hidden/experience",
        adminHeaders,
      );
      const blockedExperience = await read(
        "/public/initiatives/hu04a-http-blocked/experience",
        adminHeaders,
      );
      assert.deepEqual(blockedGet.body, hiddenGet.body);
      assert.deepEqual(blockedExperience.body, hiddenExperience.body);

      const openResponse = await fetch(`http://127.0.0.1:${port}/public/initiatives/hu04a-http-open`, {
        headers: adminHeaders,
      });
      assert.notEqual(openResponse.status, 404);
      const openStatus = await read(
        "/public/initiatives/hu04a-http-open/public-choice-results/status",
        adminHeaders,
      );
      assert.equal(openStatus.status, 200);
      assert.equal(openStatus.text.includes(blockedTitle), false);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("drops a warm search index entry and a cached related title after a block", async () => {
    track(initiative("hu04a-search-open", { title: "HU04B Open Search Title" }));
    track(
      initiative("hu04a-search-blocked", {
        administrativelyBlocked: true,
        title: "HU04B Secret Search Title",
        description: "HU04B Secret Search Description",
      }),
    );
    track(initiative("hu04a-related-cache-source", { title: "HU04B Related Source" }));

    const blockedEntry = searchEntry("hu04a-search-blocked", "HU04B Secret Search Title");
    const openEntry = searchEntry("hu04a-search-open", "HU04B Open Search Title");
    const childEntry = searchEntry("analysis-of-blocked", "HU04B Secret Analysis Title");
    childEntry.entityType = "analysis";
    childEntry.initiativeId = "hu04a-search-blocked";
    childEntry.normalizedEntityType = "analysis";
    setGlobalSearchIndexForTests([openEntry, blockedEntry, childEntry]);

    const results = await searchPublicCivicRecords({ q: "HU04B", limit: 10, offset: 0 });
    const serialized = JSON.stringify(results);
    assert.match(serialized, /HU04B Open Search Title/);
    assert.equal(serialized.includes("HU04B Secret Search Title"), false);
    assert.equal(serialized.includes("HU04B Secret Analysis Title"), false);
    assert.equal(serialized.includes("HU04B Secret Search Description"), false);

    setCommunityIntelligenceCacheEntry("hu04a-related-cache-source", {
      expiresAt: Date.now() + 60_000,
      providerId: "hu04b-test",
      algorithmVersion: COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
      items: [
        {
          initiativeId: "hu04a-search-blocked",
          title: "HU04B Secret Search Title",
          relationshipType: "related",
          score: 1,
          reasons: [],
          sharedTopics: [],
          sharedParticipationAreas: [],
          sharedPriorities: [],
          keyDifferences: [],
          publicUrl: "/initiatives/public/hu04a-search-blocked",
        },
      ],
    });
    const related = await findRelatedInitiativesForInitiative("hu04a-related-cache-source");
    assert.deepEqual(related.items, []);
    assert.equal(JSON.stringify(related).includes("HU04B Secret Search Title"), false);

    setGlobalSearchIndexForTests([blockedEntry]);
    setCommunityIntelligenceCacheEntry("hu04a-related-cache-source", {
      expiresAt: Date.now() + 60_000,
      providerId: "hu04b-test",
      algorithmVersion: COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
      items: [
        {
          initiativeId: "hu04a-search-blocked",
          title: "HU04B Secret Search Title",
          relationshipType: "related",
          score: 1,
          reasons: [],
          sharedTopics: [],
          sharedParticipationAreas: [],
          sharedPriorities: [],
          keyDifferences: [],
          publicUrl: "/initiatives/public/hu04a-search-blocked",
        },
      ],
    });
    invalidateOrdinaryPublicInitiativeCaches("hu04a-search-blocked");
    await assert.rejects(() => getGlobalSearchIndex(), /MongoDB skipped in NODE_TEST_ENV/);
    assert.equal(getCommunityIntelligenceCacheEntry("hu04a-related-cache-source"), undefined);
    const adminModeration = readFileSync(
      fileURLToPath(
        new URL(
          "../../../src/modules/administration/admin-initiative-moderation.service.ts",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    const editorModeration = readFileSync(
      fileURLToPath(
        new URL("../../../src/modules/editor-grants/editor-moderation.service.ts", import.meta.url),
      ),
      "utf8",
    );
    assert.equal(
      adminModeration.match(/invalidateOrdinaryPublicInitiativeCaches\(/g)?.length,
      2,
    );
    assert.equal(
      editorModeration.match(/invalidateOrdinaryPublicInitiativeCaches\(/g)?.length,
      2,
    );
  });

  it("leaves Blog public delivery blocked and does not treat a block as a lifecycle change", () => {
    const publishedAt = "2026-01-01T00:00:00.000Z";
    const blockedPost = {
      status: "published",
      administrativelyBlocked: true,
      publishedAt,
    } as BlogPost;
    const openPost = {
      status: "published",
      administrativelyBlocked: false,
      publishedAt,
    } as BlogPost;

    assert.equal(isBlogPostPubliclyDeliverable(blockedPost), false);
    assert.equal(isBlogPostPubliclyDeliverable(openPost), true);

    const blogService = readFileSync(
      fileURLToPath(new URL("../../../src/modules/blog/blog.service.ts", import.meta.url)),
      "utf8",
    );
    const blogRepository = readFileSync(
      fileURLToPath(
        new URL("../../../src/modules/blog/persistence/blog.repository.ts", import.meta.url),
      ),
      "utf8",
    );
    const publicSlug = blogService.slice(
      blogService.indexOf("export async function getPublicBlogPostBySlug"),
      blogService.indexOf("export async function getPublicBlogPostBySlug") + 1200,
    );
    assert.match(publicSlug, /post\.administrativelyBlocked === true/);
    assert.match(publicSlug, /BlogNotFoundError/);
    assert.match(blogRepository, /administrativelyBlocked: \{ \$ne: true \}/);
  });
});

function searchEntry(entityId: string, title: string): GlobalSearchIndexEntry {
  const normalizedTitle = title.trim().toLowerCase();
  return {
    entityType: "initiative",
    entityId,
    title,
    summary: "",
    country: "",
    region: "",
    community: "",
    activityArea: "",
    status: "",
    publicUrl: `/initiatives/public/${entityId}`,
    updatedAt: "2026-10-11T00:00:00.000Z",
    initiativeId: entityId,
    normalizedTitle,
    normalizedSummary: "",
    normalizedCountry: "",
    normalizedRegion: "",
    normalizedCommunity: "",
    normalizedActivityArea: "",
    normalizedStatus: "",
    normalizedEntityType: "initiative",
    normalizedCountryLabel: "",
    normalizedRegionLabel: "",
    normalizedCountryCode: "",
    normalizedRegionCode: "",
    normalizedTranslatedTitles: {},
    normalizedTranslatedSummaries: {},
    normalizedTerminologyAliasesByLanguage: {},
  };
}
