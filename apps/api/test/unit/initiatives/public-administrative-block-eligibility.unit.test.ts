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

import { createAccessToken } from "../../../src/modules/auth/auth-tokens.js";
import { isBlogPostPubliclyDeliverable } from "../../../src/modules/blog/blog-publication-delivery.service.js";
import { selectCandidateInitiatives } from "../../../src/modules/community-intelligence/community-intelligence-matching.js";
import { findRelatedInitiativesForInitiative } from "../../../src/modules/community-intelligence/community-intelligence.service.js";
import { listCountryInitiativeCardProjections } from "../../../src/modules/country-statistics/country-public.service.js";
import {
  isPublicInitiative,
  resetGlobalSearchIndexForTests,
} from "../../../src/modules/global-search/global-search.index.js";
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
    track(initiative("hu04a-http-blocked", { administrativelyBlocked: true }));
    track(initiative("hu04a-http-hidden", { visibility: { policy: "steward_only" } }));
    track(initiative("hu04a-http-open"));
    track(
      initiative("hu04a-http-election", {
        lifecycleProfile: "PUBLIC_CHOICE",
        administrativelyBlocked: true,
      }),
    );

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
    const server: Server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    try {
      const port = (server.address() as AddressInfo).port;
      const headers = { Authorization: `Bearer ${adminToken}` };

      async function read(path: string) {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
        return { status: response.status, body: await response.json() };
      }

      const blockedGet = await read("/public/initiatives/hu04a-http-blocked");
      const hiddenGet = await read("/public/initiatives/hu04a-http-hidden");
      const blockedExperience = await read("/public/initiatives/hu04a-http-blocked/experience");
      const hiddenExperience = await read("/public/initiatives/hu04a-http-hidden/experience");
      const blockedRoster = await read("/public/initiatives/hu04a-http-election/candidates");
      const openResponse = await fetch(
        `http://127.0.0.1:${port}/public/initiatives/hu04a-http-open`,
        { headers },
      );

      assert.equal(blockedGet.status, 404);
      assert.equal(hiddenGet.status, 404);
      assert.deepEqual(blockedGet.body, hiddenGet.body);
      assert.equal(blockedGet.body.message, "Initiative not found.");
      assert.notEqual(openResponse.status, 404);
      assert.equal(blockedExperience.status, 404);
      assert.equal(hiddenExperience.status, 404);
      assert.deepEqual(blockedExperience.body, hiddenExperience.body);
      assert.equal(blockedRoster.status, 404);
      assert.equal(blockedRoster.body.message, "Initiative not found.");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
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
  });
});
