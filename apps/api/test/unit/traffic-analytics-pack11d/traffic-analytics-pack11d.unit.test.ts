/**
 * Pack 11D — insights period/comparison unit tests (no Mongo).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseTrafficInsightsPeriod,
  percentChange,
  resolveInsightsPeriodWindow,
} from "../../../src/modules/traffic-analytics/index.js";

describe("Pack 11D — insights period helpers", () => {
  it("parses insights periods and resolves UTC windows", () => {
    assert.equal(parseTrafficInsightsPeriod("30d"), "30d");
    assert.equal(parseTrafficInsightsPeriod("all"), "all");
    assert.equal(parseTrafficInsightsPeriod("7d"), null);

    const now = new Date("2026-08-22T15:00:00.000Z");
    const thirty = resolveInsightsPeriodWindow("30d", now);
    assert.equal(thirty.startDay, "2026-07-24");
    assert.equal(thirty.endDay, "2026-08-22");
    assert.equal(thirty.bucketGranularity, "day");
    assert.ok(thirty.previous);

    const all = resolveInsightsPeriodWindow("all", now);
    assert.equal(all.startDay, null);
    assert.equal(all.previous, null);
    assert.equal(all.bucketGranularity, "month");
  });

  it("handles previous-period percent change without Infinity", () => {
    assert.deepEqual(percentChange(0, 0), { percent: 0, isNew: false });
    assert.deepEqual(percentChange(10, 0), { percent: null, isNew: true });
    assert.deepEqual(percentChange(15, 10), { percent: 50, isNew: false });
    assert.deepEqual(percentChange(5, 10), { percent: -50, isNew: false });
  });
});
