/**
 * Step 15D.1 — expand ordinary public WEB_UI coverage + catalog expansion reuse.
 * Deterministic. No Gemini. No staging writes.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  isOrdinaryWebUiRequiredPath,
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
  PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES,
} from "@hu/types";

import { assessWebUiCatalogReadinessForLocale } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
  rebaseWebUiCheckpointForCatalogExpansion,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
import {
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
  planWebUiDraftBatches,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  collectStringPaths,
  loadBundledEnglishWebUiMessagePack,
  loadBundledWebUiMessagePackFromFs,
  selectEnglishWebUiMessages,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

const STEP15D1_FAMILIES = [
  "publicStatistics.",
  "pwa.",
  "worldInitiativesPublic.",
  "publicInitiativeMiniCard.",
  "search.",
  "supportPublic.",
] as const;

function readPath(messages: Record<string, unknown>, dottedPath: string): unknown {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function projectPaths(
  english: Record<string, unknown>,
  paths: readonly string[],
  transform?: (value: string, pathKey: string) => string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const pathKey of paths) {
    const value = readPath(english, pathKey);
    if (typeof value !== "string") {
      continue;
    }
    const segments = pathKey.split(".");
    let cursor: Record<string, unknown> = out;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]!;
      const next = cursor[segment];
      if (next == null || typeof next !== "object" || Array.isArray(next)) {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1]!] = transform ? transform(value, pathKey) : value;
  }
  return out;
}

describe("Step 15D.1 — ordinary public WEB_UI coverage", () => {
  beforeEach(() => {
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    setWebUiActivationCheckpointForceMemoryForTests(true);
    resetWebUiActivationCheckpointStoreForTests();
  });

  afterEach(() => {
    resetWebUiMessagePackStoreForTests();
    resetWebUiActivationCheckpointStoreForTests();
  });

  it("1–8 expands required families and keeps workspace/author excluded", () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const required = collectStringPaths(english).filter((pathKey) =>
      isPublicReaderWebUiRequiredPath(pathKey),
    );
    for (const family of STEP15D1_FAMILIES) {
      assert.ok(
        (PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES as readonly string[]).includes(family),
        family,
      );
      assert.ok(
        required.some((pathKey) => pathKey.startsWith(family)),
        `required includes ${family}`,
      );
    }
    assert.equal(required.some((pathKey) => pathKey.startsWith("workspace.")), false);
    assert.equal(
      required.some((pathKey) => pathKey.startsWith("initiativeExperience.manage.")),
      false,
    );
    assert.equal(
      required.some((pathKey) => pathKey.startsWith("initiativeExperience.author.sidebar.")),
      false,
    );
    assert.equal(
      required.some((pathKey) => pathKey.startsWith("initiativeExperience.author.actions.")),
      false,
    );
  });

  it("9 derives one canonical required count for API preparation", () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const ordinary = [
      ...new Set(
        collectStringPaths(english).filter((pathKey) =>
          isOrdinaryWebUiRequiredPath(pathKey, isPublicReaderWebUiRequiredPath),
        ),
      ),
    ].sort();
    const prepared = selectEnglishWebUiMessages("public");
    assert.equal(prepared.selectedPaths.length, ordinary.length);
    assert.deepEqual([...prepared.selectedPaths].sort(), ordinary);
    assert.ok(prepared.participantRequiredKeyCount > 0);
    assert.ok(prepared.selectedPaths.some((pathKey) => isParticipantWebUiRequiredPath(pathKey)));
    const corpus = loadPublicWebUiEnglishCorpus();
    assert.equal(corpus.requiredPaths.length, ordinary.length);
  });

  it("10 preparation export contains the new public families", () => {
    const prepared = selectEnglishWebUiMessages("public");
    for (const family of STEP15D1_FAMILIES) {
      assert.ok(
        prepared.selectedPaths.some((pathKey) => pathKey.startsWith(family)),
        family,
      );
    }
  });

  it("11–12 old pre-15D.1 remote pack is not WEB_UI-ready under expanded scope", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const all = collectStringPaths(english);
    const legacyPrefixes = PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES.filter(
      (prefix) => !(STEP15D1_FAMILIES as readonly string[]).includes(prefix),
    );
    const legacyPaths = all.filter((pathKey) =>
      legacyPrefixes.some(
        (prefix) => pathKey === prefix.slice(0, -1) || pathKey.startsWith(prefix),
      ),
    );
    assert.equal(legacyPaths.length, 2260);
    const required = all.filter((pathKey) => isPublicReaderWebUiRequiredPath(pathKey));
    assert.ok(required.length > 2260);
    assert.equal(required.length - legacyPaths.length, 229);

    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: projectPaths(english, legacyPaths) as never,
      sourceNote: "legacy 2260-key public pack",
    });
    const readiness = await assessWebUiCatalogReadinessForLocale({ locale: "ka" });
    assert.equal(readiness.dataReady, false);
    assert.equal(readiness.requiredKeyCount, required.length);
    assert.equal(readiness.missingKeyCount, required.length - legacyPaths.length);
    assert.ok(
      readiness.sampleMissingPaths.some(
        (path) =>
          path.startsWith("search.") ||
          path.startsWith("pwa.") ||
          path.startsWith("supportPublic.") ||
          path.startsWith("publicStatistics."),
      ),
    );
  });

  it("13–15 seeds published values so covered batches skip provider work", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const required = collectStringPaths(english).filter((pathKey) =>
      isPublicReaderWebUiRequiredPath(pathKey),
    );
    const legacyPrefixes = PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES.filter(
      (prefix) => !(STEP15D1_FAMILIES as readonly string[]).includes(prefix),
    );
    const legacyPaths = required.filter((pathKey) =>
      legacyPrefixes.some(
        (prefix) => pathKey === prefix.slice(0, -1) || pathKey.startsWith(prefix),
      ),
    );
    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: projectPaths(english, legacyPaths, (value) => `[ka] ${value}`) as never,
      sourceNote: "partial ka pack",
    });

    const corpus = loadPublicWebUiEnglishCorpus();
    const sourceHash = hashWebUiEnglishFlatMap(corpus.flat);
    const batches = planWebUiDraftBatches(corpus.flat);
    const checkpoint = {
      checkpointId: "webui-act-ka-expand-test",
      jobId: "lang-act-ka-expand-test",
      locale: "ka",
      generation: 1,
      sourceHash: "stale-before-expansion",
      terminologyMode: "live" as const,
      phase: "ready" as const,
      leafCount: legacyPaths.length,
      batchCount: 379,
      completedBatchCount: 379,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Georgian",
      nativeName: "ქართული",
      textDirection: "ltr" as const,
      detail: "Public interface ready",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await upsertWebUiActivationCheckpoint(checkpoint);

    const rebased = await rebaseWebUiCheckpointForCatalogExpansion({
      checkpoint,
      sourceHash,
      flat: corpus.flat,
      requiredPaths: corpus.requiredPaths,
    });
    assert.equal(rebased.sourceHash, sourceHash);
    assert.equal(rebased.phase, "primary");
    assert.equal(rebased.batchCount, batches.length);
    assert.ok(rebased.completedBatchCount > 0);
    assert.ok(rebased.completedBatchCount < batches.length);

    const seededBatches = await listWebUiActivationBatches(rebased.checkpointId, "primary");
    const okSeeded = seededBatches.filter((batch) => batch.status === "ok");
    assert.equal(okSeeded.length, rebased.completedBatchCount);
    assert.ok(okSeeded.every((batch) => batch.reason === "reused from published pack"));
    assert.ok(
      okSeeded.every((batch) =>
        batch.keys.every((key) => String(batch.values[key] ?? "").startsWith("[ka] ")),
      ),
    );

    const firstMissing = batches.find((batch) => !okSeeded.some((row) => row.batchId === batch.id));
    assert.ok(firstMissing);
    assert.ok(
      STEP15D1_FAMILIES.some((family) =>
        firstMissing.keys.some((key) => key.startsWith(family)),
      ) ||
        firstMissing.keys.some(
          (key) =>
            isParticipantWebUiRequiredPath(key) && !isPublicReaderWebUiRequiredPath(key),
        ),
      "first uncovered batch is a 15D.1 public family or participant-only path",
    );
  });

  it("19 uk/ar/zh-Hant bundled catalogs satisfy the expanded predicate", async () => {
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const pack = loadBundledWebUiMessagePackFromFs(locale);
      assert.ok(pack, locale);
      const readiness = await assessWebUiCatalogReadinessForLocale({ locale });
      assert.equal(readiness.dataReady, true, locale);
      assert.equal(readiness.missingKeyCount, 0, locale);
    }
  });
});
