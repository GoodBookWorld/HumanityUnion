/**
 * Public Choice Results & Retention Pack 02C — focused contracts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_CHOICE_RESULTS_RETENTION_HOURS,
  buildPublicChoiceCandidatePresentationSlotPlan,
  computePublicChoiceResultsExpireAt,
  isPublicChoiceResultsDownloadAvailable,
  isPublicChoiceResultsRetentionExpired,
  isPublicChoiceResultsWithinRetentionWindow,
  resolvePublicChoiceResultsRetentionStatus,
  resolvePublicChoiceVotingCloseAt,
} from "@hu/types";

describe("Public Choice Pack 02C — retention policy", () => {
  it("uses a single 72-hour retention constant", () => {
    assert.equal(PUBLIC_CHOICE_RESULTS_RETENTION_HOURS, 72);
  });

  it("derive expireAt from canonical close time", () => {
    const closeAt = "2026-01-01T00:00:00.000Z";
    const expireAt = computePublicChoiceResultsExpireAt(closeAt);
    assert.equal(expireAt, "2026-01-04T00:00:00.000Z");
  });

  it("download available after close and before +72h; unavailable at >=72h and before close", () => {
    const votingCloseAt = "2026-01-01T12:00:00.000Z";

    assert.equal(
      isPublicChoiceResultsDownloadAvailable({
        votingOpen: true,
        votingCloseAt: null,
      }),
      false,
    );

    assert.equal(
      isPublicChoiceResultsWithinRetentionWindow({
        votingCloseAt,
        nowIso: "2026-01-01T11:59:59.000Z",
      }),
      false,
    );

    assert.equal(
      isPublicChoiceResultsDownloadAvailable({
        votingOpen: false,
        votingCloseAt,
        nowIso: "2026-01-01T12:00:00.000Z",
      }),
      true,
    );

    assert.equal(
      isPublicChoiceResultsDownloadAvailable({
        votingOpen: false,
        votingCloseAt,
        nowIso: "2026-01-04T11:59:59.000Z",
      }),
      true,
    );

    assert.equal(
      isPublicChoiceResultsRetentionExpired({
        votingCloseAt,
        nowIso: "2026-01-04T12:00:00.000Z",
      }),
      true,
    );

    assert.equal(
      isPublicChoiceResultsDownloadAvailable({
        votingOpen: false,
        votingCloseAt,
        nowIso: "2026-01-04T12:00:00.000Z",
      }),
      false,
    );
  });

  it("resolvePublicChoiceVotingCloseAt prefers closedAt then elapsed closesAt", () => {
    assert.equal(
      resolvePublicChoiceVotingCloseAt({
        status: "closed",
        closedAt: "2026-01-02T00:00:00.000Z",
        closesAt: "2026-01-01T00:00:00.000Z",
      }),
      "2026-01-02T00:00:00.000Z",
    );

    assert.equal(
      resolvePublicChoiceVotingCloseAt({
        status: "opened",
        closesAt: "2026-01-01T00:00:00.000Z",
        nowIso: "2026-01-01T00:00:01.000Z",
      }),
      "2026-01-01T00:00:00.000Z",
    );

    assert.equal(
      resolvePublicChoiceVotingCloseAt({
        status: "opened",
        closesAt: "2026-01-02T00:00:00.000Z",
        nowIso: "2026-01-01T00:00:00.000Z",
      }),
      null,
    );
  });

  it("tombstone resultsExpiredAt forces expired status", () => {
    assert.equal(
      resolvePublicChoiceResultsRetentionStatus({
        votingOpen: false,
        votingCloseAt: "2026-01-01T00:00:00.000Z",
        resultsExpiredAt: "2026-01-04T00:00:00.000Z",
        hasElectionData: false,
      }),
      "results_expired",
    );
  });
});

describe("Public Choice Pack 02C — six-slot placeholders", () => {
  it("0→6, 1→5, 5→1, 6→0, >6→0 placeholders", () => {
    assert.deepEqual(buildPublicChoiceCandidatePresentationSlotPlan(0), {
      realCount: 0,
      placeholderCount: 6,
      totalSlots: 6,
    });
    assert.deepEqual(buildPublicChoiceCandidatePresentationSlotPlan(1), {
      realCount: 1,
      placeholderCount: 5,
      totalSlots: 6,
    });
    assert.deepEqual(buildPublicChoiceCandidatePresentationSlotPlan(5), {
      realCount: 5,
      placeholderCount: 1,
      totalSlots: 6,
    });
    assert.deepEqual(buildPublicChoiceCandidatePresentationSlotPlan(6), {
      realCount: 6,
      placeholderCount: 0,
      totalSlots: 6,
    });
    assert.deepEqual(buildPublicChoiceCandidatePresentationSlotPlan(8), {
      realCount: 8,
      placeholderCount: 0,
      totalSlots: 8,
    });
  });
});
