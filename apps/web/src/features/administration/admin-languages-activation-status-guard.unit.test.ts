/**
 * F.3.4 — one in-flight activation-status request per language id.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, afterEach } from "node:test";
import { fileURLToPath } from "node:url";

import type { LanguageActivationAdminView } from "@hu/types";

import {
  freshActivationReadinessBinding,
  isActivationStatusInFlight,
  resetActivationStatusGuardForTests,
  runGuardedActivationStatus,
} from "./admin-languages-activation-status-guard";
import { shouldPollLanguageActivationJob } from "./admin-languages-activation-poll";

const here = path.dirname(fileURLToPath(import.meta.url));

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("activation-status in-flight guard", () => {
  afterEach(() => {
    resetActivationStatusGuardForTests();
  });

  it("1–3 first poll starts, a pending tick does not, and a later poll can", async () => {
    const first = deferred<string>();
    let starts = 0;
    const started = runGuardedActivationStatus("lang-uk", () => {
      starts += 1;
      return first.promise;
    });
    const skipped = runGuardedActivationStatus("lang-uk", () => {
      starts += 1;
      return Promise.resolve("second");
    });
    assert.equal(started.started, true);
    assert.equal(skipped.started, false);
    assert.equal(starts, 1);
    assert.equal(isActivationStatusInFlight("lang-uk"), true);
    assert.equal(skipped.promise, started.promise);
    first.resolve("ok");
    assert.equal(await started.promise, "ok");
    assert.equal(isActivationStatusInFlight("lang-uk"), false);

    const again = runGuardedActivationStatus("lang-uk", () => {
      starts += 1;
      return Promise.resolve("later");
    });
    assert.equal(again.started, true);
    assert.equal(starts, 2);
    assert.equal(await again.promise, "later");
  });

  it("4 locale A pending does not block locale B", async () => {
    const pending = deferred<string>();
    const a = runGuardedActivationStatus("lang-uk", () => pending.promise);
    let bStarts = 0;
    const b = runGuardedActivationStatus("lang-zh", () => {
      bStarts += 1;
      return Promise.resolve("zh");
    });
    assert.equal(a.started, true);
    assert.equal(b.started, true);
    assert.equal(bStarts, 1);
    assert.equal(await b.promise, "zh");
    pending.resolve("uk");
    assert.equal(await a.promise, "uk");
  });

  it("5–6 hydration and polling share one guard per locale", async () => {
    const pending = deferred<string>();
    const hydration = runGuardedActivationStatus("lang-uk", () => pending.promise);
    const poll = runGuardedActivationStatus("lang-uk", () => Promise.resolve("poll"));
    assert.equal(hydration.started, true);
    assert.equal(poll.started, false);
    assert.equal(poll.promise, hydration.promise);

    pending.resolve("hydrated");
    assert.equal(await hydration.promise, "hydrated");

    const polling = deferred<string>();
    const pollStart = runGuardedActivationStatus("lang-ka", () => polling.promise);
    const hydrationLater = runGuardedActivationStatus("lang-ka", () =>
      Promise.resolve("hydrate"),
    );
    assert.equal(pollStart.started, true);
    assert.equal(hydrationLater.started, false);
    polling.resolve("polled");
    assert.equal(await pollStart.promise, "polled");
  });

  it("7–8 failure and success both clear the guard", async () => {
    const failing = deferred<string>();
    const failed = runGuardedActivationStatus("lang-ar", () => failing.promise);
    failing.reject(new Error("timeout"));
    await assert.rejects(failed.promise);
    assert.equal(isActivationStatusInFlight("lang-ar"), false);
    const next = runGuardedActivationStatus("lang-ar", () => Promise.resolve("recovered"));
    assert.equal(next.started, true);
    assert.equal(await next.promise, "recovered");
    assert.equal(isActivationStatusInFlight("lang-ar"), false);
  });

  it("9 polling eligibility stays queued and running only", () => {
    assert.equal(shouldPollLanguageActivationJob("queued"), true);
    assert.equal(shouldPollLanguageActivationJob("running"), true);
    assert.equal(shouldPollLanguageActivationJob("completed"), false);
    assert.equal(shouldPollLanguageActivationJob("failed"), false);
    assert.equal(shouldPollLanguageActivationJob("waiting_for_data"), false);
    assert.equal(shouldPollLanguageActivationJob(null), false);
  });

  it("10–11 manual Readiness joins the in-flight request and binds one readiness object", async () => {
    const section = readFileSync(
      path.join(here, "components/AdminLanguagesSection.tsx"),
      "utf8",
    );
    const readinessStart = section.indexOf("async function handleCheckReadiness");
    const readiness = section.slice(readinessStart, readinessStart + 1600);
    assert.match(readiness, /runGuardedActivationStatus\(row\.languageId/);
    assert.match(readiness, /freshActivationReadinessBinding\(view\)/);
    assert.doesNotMatch(
      readiness.slice(readiness.indexOf("runGuardedActivationStatus")),
      /if \(!guarded\.started\) return/,
    );

    const pending = deferred<{ readiness: { state: string } }>();
    let starts = 0;
    const poll = runGuardedActivationStatus("lang-uk", () => {
      starts += 1;
      return pending.promise;
    });
    const manual = runGuardedActivationStatus("lang-uk", () => {
      starts += 1;
      return Promise.resolve({ readiness: { state: "OTHER" } });
    });
    assert.equal(manual.started, false);
    assert.equal(starts, 1);
    const view = { readiness: { state: "BACKFILL_REQUIRED" } };
    pending.resolve(view);
    const settled = await manual.promise;
    const bound = freshActivationReadinessBinding(
      settled as LanguageActivationAdminView,
    );
    assert.equal(bound.activation, settled);
    assert.equal(bound.readiness, settled.readiness);
    assert.equal(bound.readiness, view.readiness);
    assert.equal(await poll.promise, settled);
  });
});
