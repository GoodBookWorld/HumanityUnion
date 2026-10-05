/**
 * F.3.43.1 — initial initiative revisions enter the shared CT warm path.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import type { Initiative } from "@hu/types";

import {
  listContentTranslationWarmMemoryPendingForTests,
  resetContentTranslationWarmMemoryForTests,
  setContentTranslationWarmForceMemoryForTests,
} from "../../../src/modules/language/content-translation-warm-enqueue.js";
import { createInitialInitiativeVersionRevision } from "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const servicePath = path.resolve(
  here,
  "../../../src/modules/initiative-version-revision/initiative-version-revision.service.ts",
);

function readService(): string {
  return readFileSync(servicePath, "utf8");
}

function sliceFunction(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, startMarker);
  assert.ok(end > start, endMarker);
  return source.slice(start, end);
}

function buildInitiative(initiativeId: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: "initial-revision-ct-steward",
    title: "Fixture",
    description: "Fixture",
    status: "proposal",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: "public" },
    metadata: {
      activityArea: "Environment",
      communitySlug: "fixture-community",
      category: "Environment",
    },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as Initiative;
}

async function flushWarmSchedule(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("initial initiative revision CT convergence", () => {
  beforeEach(() => {
    setContentTranslationWarmForceMemoryForTests(true);
    resetContentTranslationWarmMemoryForTests();
  });

  it("A/B — a new initial revision schedules warm for that persisted revision id", async () => {
    const initiativeId = `initiative-initial-ct-${Date.now()}`;
    const created = createInitialInitiativeVersionRevision(buildInitiative(initiativeId), "author-1");
    await flushWarmSchedule();

    const pending = listContentTranslationWarmMemoryPendingForTests();
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.command.sourceKind, "initiative_revision");
    assert.equal(pending[0]?.command.sourceRecordId, created.revisionId);
    assert.equal(pending[0]?.command.reason, "public_mutation");
    assert.equal(pending[0]?.command.targetLocales, undefined);
  });

  it("C — a failed create does not schedule CT work", async () => {
    assert.throws(() => createInitialInitiativeVersionRevision(null as never, "author-1"));
    await flushWarmSchedule();
    assert.equal(listContentTranslationWarmMemoryPendingForTests().length, 0);
  });

  it("C — returning an existing revision does not schedule another warm", async () => {
    const initiativeId = `initiative-initial-ct-existing-${Date.now()}`;
    const initiative = buildInitiative(initiativeId);
    const created = createInitialInitiativeVersionRevision(initiative, "author-1");
    await flushWarmSchedule();
    resetContentTranslationWarmMemoryForTests();

    const again = createInitialInitiativeVersionRevision(initiative, "author-1");
    await flushWarmSchedule();

    assert.equal(again.revisionId, created.revisionId);
    assert.equal(listContentTranslationWarmMemoryPendingForTests().length, 0);
  });

  it("D/E — no locale branch; publish warm contract stays the shared scheduler", () => {
    const source = readService();
    const initial = sliceFunction(
      source,
      "export function createInitialInitiativeVersionRevision",
      "export function resolveInitiativeVersionForNewAnalysis",
    );
    const publish = sliceFunction(
      source,
      "export function publishInitiativeRevision",
      "async function notifyLifecycleStageRevisionPublished",
    );

    assert.equal(/locale\s*===\s*["'](uk|ar|he|ka|zh-Hant|en)["']/.test(initial), false);
    assert.match(initial, /scheduleContentTranslationWarmAfterMutation\(\{/);
    assert.match(initial, /sourceKind: "initiative_revision"/);
    const persistAt = initial.indexOf("createRevision(revision)");
    const warmAt = initial.indexOf("scheduleContentTranslationWarmAfterMutation");
    assert.ok(persistAt >= 0 && warmAt > persistAt);

    assert.match(publish, /sourceKind: "initiative_revision"/);
    assert.match(publish, /sourceKind: "initiative"/);
    assert.match(publish, /reason: "public_mutation"/);
    assert.match(publish, /reason: "public_update"/);
    assert.equal(publish.includes("targetLocales"), false);
  });
});
