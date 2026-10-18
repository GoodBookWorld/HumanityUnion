import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PARTICIPANT_SELECTION_CAP,
  classifyRestoreTargets,
  classifySuspendTargets,
  countEmailWarnings,
  createSequentialParticipantMutationRunner,
  pageCheckboxState,
  selectAllParticipantsOnPage,
  toggleParticipantSelection,
  type ParticipantSelectionRecord,
} from "./participant-directory-selection";

function row(
  memberId: string,
  status: ParticipantSelectionRecord["status"],
  role: ParticipantSelectionRecord["role"] = "member",
): ParticipantSelectionRecord {
  return { memberId, status, role };
}

describe("Participant directory selection", () => {
  it("selects by memberId and caps the set at 25", () => {
    let selected: string[] = [];

    for (let index = 0; index < PARTICIPANT_SELECTION_CAP; index += 1) {
      const next = toggleParticipantSelection(selected, `member-${index}`);
      assert.equal(next.limitReached, false);
      selected = next.selectedIds;
    }

    const blocked = toggleParticipantSelection(selected, "member-extra");
    assert.equal(blocked.limitReached, true);
    assert.equal(blocked.selectedIds.length, PARTICIPANT_SELECTION_CAP);
    assert.equal(blocked.selectedIds.includes("member-extra"), false);

    const removed = toggleParticipantSelection(blocked.selectedIds, "member-0");
    assert.equal(removed.selectedIds.includes("member-0"), false);
    assert.equal(removed.limitReached, false);
  });

  it("select-all changes only the current page", () => {
    const firstPage = ["m-1", "m-2"];
    const selected = selectAllParticipantsOnPage(["kept-from-other-page"], firstPage);
    assert.deepEqual(selected.selectedIds, ["kept-from-other-page", "m-1", "m-2"]);

    const clearedPage = selectAllParticipantsOnPage(selected.selectedIds, firstPage);
    assert.deepEqual(clearedPage.selectedIds, ["kept-from-other-page"]);
    assert.equal(pageCheckboxState(clearedPage.selectedIds, firstPage), "unchecked");
    assert.equal(pageCheckboxState(["m-1"], firstPage), "indeterminate");
    assert.equal(pageCheckboxState(["m-1", "m-2"], firstPage), "checked");
  });

  it("stops a page select-all at the cap and leaves later rows unselected", () => {
    const existing = Array.from({ length: 24 }, (_, index) => `existing-${index}`);
    const next = selectAllParticipantsOnPage(existing, ["page-a", "page-b"]);
    assert.equal(next.limitReached, true);
    assert.equal(next.selectedIds.includes("page-a"), true);
    assert.equal(next.selectedIds.includes("page-b"), false);
    assert.equal(next.selectedIds.length, 25);
  });

  it("classifies suspend and restore eligibility without calling ineligible accounts", () => {
    const records = [
      row("active-member", "active"),
      row("disabled-member", "disabled"),
      row("other-admin", "active", "admin"),
      row("self", "active"),
    ];

    const suspend = classifySuspendTargets(records, "self");
    assert.deepEqual(
      suspend.eligible.map((record) => record.memberId),
      ["active-member"],
    );
    assert.deepEqual(
      suspend.skipped.map((record) => record.memberId),
      ["disabled-member", "other-admin", "self"],
    );

    const restore = classifyRestoreTargets(records);
    assert.deepEqual(
      restore.eligible.map((record) => record.memberId),
      ["disabled-member"],
    );
    assert.equal(restore.skipped.length, 3);
  });

  it("runs mutations sequentially, keeps earlier successes, and blocks a second batch", async () => {
    const runner = createSequentialParticipantMutationRunner();
    const calls: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const result = await runner.run(["ok-1", "fail-1", "ok-2"], async (memberId) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      calls.push(memberId);
      await Promise.resolve();
      inFlight -= 1;

      if (memberId === "fail-1") {
        throw new Error("already suspended");
      }

      return {
        emailQueued: memberId !== "ok-2",
        emailWarning: memberId === "ok-2" ? "mailbox unavailable" : undefined,
      };
    });

    assert.deepEqual(calls, ["ok-1", "fail-1", "ok-2"]);
    assert.equal(maxInFlight, 1);
    assert.equal(result.blockedDuplicate, false);
    assert.deepEqual(
      result.succeeded.map((row) => row.memberId),
      ["ok-1", "ok-2"],
    );
    assert.equal(result.failed[0]?.message, "already suspended");
    assert.equal(countEmailWarnings(result.succeeded), 1);

    let releaseFirst: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const overlap = createSequentialParticipantMutationRunner();
    const first = overlap.run(["slow"], async () => {
      await gate;
      return { emailQueued: true };
    });
    const second = await overlap.run(["other"], async () => ({ emailQueued: true }));
    assert.equal(second.blockedDuplicate, true);
    assert.equal(second.succeeded.length, 0);
    releaseFirst?.();
    const finished = await first;
    assert.equal(finished.succeeded[0]?.memberId, "slow");
    assert.equal(overlap.isRunning(), false);
  });

  it("does not call past the 25 account maximum", async () => {
    const runner = createSequentialParticipantMutationRunner();
    const ids = Array.from({ length: 26 }, (_, index) => `member-${index}`);
    const called: string[] = [];
    const result = await runner.run(ids, async (memberId) => {
      called.push(memberId);
      return { emailQueued: true };
    });

    assert.equal(called.length, 25);
    assert.equal(result.succeeded.length, 25);
    assert.equal(called.includes("member-25"), false);
  });
});
