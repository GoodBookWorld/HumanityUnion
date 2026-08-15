import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Initiative, PublicInitiativeWithVersionHistory } from "@hu/types";

import { deleteAuthUsersByEmailPrefix } from "../../../src/modules/auth/auth-user.repository.js";
import { buildStageRecords } from "../../../src/modules/initiatives/public-initiative-experience.service.js";
import { toPublicInitiativeProjection } from "../../../src/modules/initiatives/public-initiative.projection.js";
import { getPublicInitiativeVersionHistory } from "../../../src/modules/initiative-version-revision/public-initiative-version-revision.projection.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

/**
 * Performance Recovery Task — Part 9/11.
 *
 * `buildPublicInitiativeExperienceProjection` fetches an Initiative's
 * version history once and passes it into `buildStageRecords` as
 * `precomputedVersionHistory`, instead of `buildStageRecords` issuing its
 * own second, redundant fetch for the exact same data (previously fetched
 * twice per Single Initiative page request). This is a black-box
 * characterization test: it hands `buildStageRecords` a deliberately
 * fabricated version history (whose content could not come from a real
 * lookup for this Initiative) and asserts the "revision" stage records
 * reflect exactly that fabricated data — proving the parameter is actually
 * consumed rather than ignored, without needing to mock/spy on the
 * repository call itself.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("pie-version-history-dedupe");

function buildInitiativeFixture(): Initiative {
  const now = new Date().toISOString();

  return {
    initiativeId: `${TEST_PREFIX}-initiative`,
    stewardId: `${TEST_PREFIX}-steward-member-id`,
    createdAt: now,
    updatedAt: now,
    title: "Version History Dedupe Fixture Initiative",
    description: "Fixture Initiative used to verify buildStageRecords reuses precomputed version history.",
    status: "draft",
    lifecyclePhase: "draft",
    visibility: { policy: "steward_only" },
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

describe("buildStageRecords — reuses precomputed version history (Performance Recovery Task)", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await deleteAuthUsersByEmailPrefix(TEST_PREFIX);
    await disconnectMongoClient();
  });

  it("uses the passed-in precomputedVersionHistory for the 'revision' stage instead of re-fetching", async () => {
    const initiative = buildInitiativeFixture();
    const publicInitiative = await toPublicInitiativeProjection(initiative);

    const realVersionHistory = await getPublicInitiativeVersionHistory(initiative.initiativeId);

    const fabricatedVersionHistory: PublicInitiativeWithVersionHistory = {
      currentVersion: 999,
      revisions: [
        {
          revisionId: `${TEST_PREFIX}-fabricated-revision`,
          version: 999,
          revisionSummary: "Fabricated summary that cannot come from a real lookup.",
          authorDisplayName: "Fabricated Author",
          publishedAt: initiative.updatedAt,
          isCurrent: true,
        },
      ],
      metrics: {
        revisionCount: 1,
        acceptedProposalImplementationRate: 0,
        averageAcceptedPerRevision: 0,
        averageRevisionIntervalDays: null,
        implementedProposalCount: 0,
      },
    };

    // Sanity check: the fabricated fixture is genuinely distinguishable
    // from whatever a real fetch for this brand-new Initiative returns.
    assert.notDeepEqual(fabricatedVersionHistory, realVersionHistory);

    const stageRecords = await buildStageRecords(
      initiative,
      publicInitiative,
      fabricatedVersionHistory,
    );

    const revisionRecords = stageRecords.get("revision");
    assert.equal(revisionRecords?.length, 1);
    assert.equal(revisionRecords?.[0]?.recordId, `${TEST_PREFIX}-fabricated-revision`);
    assert.equal(revisionRecords?.[0]?.title, "Version 999");
    assert.equal(revisionRecords?.[0]?.authorDisplayName, "Fabricated Author");
  });

  it("falls back to fetching version history internally when precomputedVersionHistory is omitted", async () => {
    const initiative = buildInitiativeFixture();
    const publicInitiative = await toPublicInitiativeProjection(initiative);
    const realVersionHistory = await getPublicInitiativeVersionHistory(initiative.initiativeId);

    const stageRecords = await buildStageRecords(initiative, publicInitiative);

    const revisionRecords = stageRecords.get("revision");
    assert.equal(revisionRecords?.length, realVersionHistory.revisions.length);
    assert.deepEqual(
      revisionRecords?.map((record) => record.recordId),
      realVersionHistory.revisions.map((revision) => revision.revisionId),
    );
  });
});
