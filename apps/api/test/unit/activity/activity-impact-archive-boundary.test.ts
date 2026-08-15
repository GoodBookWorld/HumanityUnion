import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE, CIVIC_ARTIFACT_TYPES, isCivicArtifactType } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { buildActivityAggregateForCreate } from "../../../src/modules/activity/domain/create-activity.aggregate.js";
import { toActivityDetailDto, toActivityMongoDocument } from "../../../src/modules/activity/infrastructure/activity.persistence.js";

/**
 * Recovery Task 19 — Confirm and Enforce the Boundary Between Initiative
 * Civic Artifacts and Activity Impact/Archive Records.
 *
 * Inspection finding (see Task 19 report): no `activity-impact` or
 * `activity-archive` module exists anywhere in `apps/api/src/modules`. The
 * only "Impact" and "Archive" civic artifacts in the codebase are the
 * canonical, already ancestry-validated `initiative-public-impact`
 * (Recovery Task 17) and `public-civic-archive` (Recovery Task 18) modules.
 * The `activity` module itself carries no Initiative linkage, no Impact
 * sub-concept, and no Archive sub-concept.
 *
 * This file pins that finding as an executable architectural-boundary
 * contract, so that if an `activity-impact` or `activity-archive` module is
 * ever introduced, or if the `activity` module ever grows an
 * `initiativeId`/`impactId`/`archiveId` field, this test fails and forces a
 * re-audit rather than allowing a silent boundary violation.
 *
 * No production code is changed by this task: there is no demonstrated
 * defect to repair. This is a boundary-characterization test suite only.
 */

describe("Activity Impact / Activity Archive boundary (Recovery Task 19)", () => {
  describe("module existence", () => {
    it("has no activity-impact module under apps/api/src/modules", async () => {
      await assert.rejects(
        () => import("../../../src/modules/activity-impact/index.js"),
        /Cannot find module|ERR_MODULE_NOT_FOUND/,
      );
    });

    it("has no activity-archive module under apps/api/src/modules", async () => {
      await assert.rejects(
        () => import("../../../src/modules/activity-archive/index.js"),
        /Cannot find module|ERR_MODULE_NOT_FOUND/,
      );
    });
  });

  describe("canonical vocabulary contains no Activity-scoped Impact/Archive members", () => {
    it("CIVIC_ARTIFACT_TYPES excludes every Activity-Impact/Activity-Archive spelling", () => {
      const forbidden = [
        "activity",
        "activity_impact",
        "activity-impact",
        "activityImpact",
        "activity_archive",
        "activity-archive",
        "activityArchive",
      ];

      for (const value of forbidden) {
        assert.equal(
          (CIVIC_ARTIFACT_TYPES as readonly string[]).includes(value),
          false,
          `expected "${value}" to be absent from CIVIC_ARTIFACT_TYPES`,
        );
        assert.equal(isCivicArtifactType(value), false, `expected isCivicArtifactType("${value}") to be false`);
      }
    });

    it('"impact" resolves only to the canonical initiative-public-impact module, never to an Activity module', () => {
      assert.equal(CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE.impact, "initiative-public-impact");
      assert.notEqual(CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE.impact, "activity");
      assert.notEqual(CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE.impact, "activity-impact");
    });

    it("no CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE entry names an Activity-scoped module", () => {
      const activityModuleNames = new Set(["activity", "activity-impact", "activity-archive"]);

      for (const artifactType of CIVIC_ARTIFACT_TYPES) {
        const canonicalModule = CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE[artifactType];

        assert.equal(
          activityModuleNames.has(canonicalModule),
          false,
          `"${artifactType}" must not resolve to Activity-scoped module "${canonicalModule}"`,
        );
      }
    });
  });

  describe("Activity aggregate carries no Initiative/Impact/Archive identity", () => {
    it("ActivityRecord has no initiativeId, impactId, or archiveId fields", () => {
      const activity = buildActivityAggregateForCreate({
        command: {
          title: "Boundary check activity",
          description: "Confirms Activity carries no canonical civic artifact identity.",
          activityType: "civic_participation",
          visibility: "public",
        },
        creatorMemberId: "member-boundary-1",
      });

      assert.equal("initiativeId" in activity, false);
      assert.equal("impactId" in activity, false);
      assert.equal("archiveId" in activity, false);
    });

    it("ActivityDetailDto (public API shape) has no initiativeId, impactId, or archiveId fields", () => {
      const activity = buildActivityAggregateForCreate({
        command: {
          title: "Boundary check activity",
          description: "Confirms the Activity DTO carries no canonical civic artifact identity.",
          activityType: "civic_participation",
          visibility: "public",
        },
        creatorMemberId: "member-boundary-2",
      });

      const dto = toActivityDetailDto(activity);

      assert.equal("initiativeId" in dto, false);
      assert.equal("impactId" in dto, false);
      assert.equal("archiveId" in dto, false);
    });

    it("the persisted Activity Mongo document has no initiativeId, impactId, or archiveId fields", () => {
      const activity = buildActivityAggregateForCreate({
        command: {
          title: "Boundary check activity",
          description: "Confirms the persisted Activity shape carries no canonical civic artifact identity.",
          activityType: "civic_participation",
          visibility: "public",
        },
        creatorMemberId: "member-boundary-3",
      });

      const document = toActivityMongoDocument(activity);

      assert.equal("initiativeId" in document, false);
      assert.equal("impactId" in document, false);
      assert.equal("archiveId" in document, false);
    });
  });

  describe("no cross-store collection collision", () => {
    it("the Activity collection is distinct from Initiative Public Impact and Public Civic Archive collections", () => {
      assert.notEqual(MONGO_COLLECTIONS.activities, MONGO_COLLECTIONS.initiativePublicImpacts);
      assert.notEqual(MONGO_COLLECTIONS.activities, MONGO_COLLECTIONS.publicImpactEvidence);
      assert.notEqual(MONGO_COLLECTIONS.activities, MONGO_COLLECTIONS.publicCivicArchiveRecords);
    });

    it("there is exactly one activities collection name and it is not reused by any other declared collection", () => {
      const names = Object.values(MONGO_COLLECTIONS);
      const activityOccurrences = names.filter((name) => name === MONGO_COLLECTIONS.activities);

      assert.equal(activityOccurrences.length, 1);
    });
  });
});
