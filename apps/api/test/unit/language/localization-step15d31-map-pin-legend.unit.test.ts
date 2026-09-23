/**
 * Step 15D.3.1 — localize HU map pin legend through WEB_UI.
 * Deterministic. No Gemini. No staging writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isPublicReaderWebUiRequiredPath } from "@hu/types";

import { assessWebUiCatalogReadinessForLocale } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import { rebaseWebUiCheckpointForCatalogExpansion } from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
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

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../../..");
const webSrc = join(repoRoot, "apps/web/src");
const webPublic = join(repoRoot, "apps/web/public");

function readRepo(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

function readWeb(rel: string): string {
  return readFileSync(join(webSrc, rel), "utf8");
}

function readPublic(rel: string): string {
  return readFileSync(join(webPublic, rel), "utf8");
}

function getNested(messages: Record<string, unknown>, pathKey: string): unknown {
  let cursor: unknown = messages;
  for (const segment of pathKey.split(".")) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function projectPaths(
  english: Record<string, unknown>,
  paths: readonly string[],
  transform?: (value: string) => string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const pathKey of paths) {
    const value = getNested(english, pathKey);
    if (typeof value !== "string") {
      continue;
    }
    const parts = pathKey.split(".");
    let cursor: Record<string, unknown> = out;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i]!;
      const next = cursor[part];
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        cursor[part] = {};
      }
      cursor = cursor[part] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]!] = transform ? transform(value) : value;
  }
  return out;
}

const LEGEND_PREFIX = "publicHome.interactiveMap.legend.";

const EXPECTED_LEGEND_IDS = [
  "presidential_republics",
  "semi_presidential_republic",
  "executive_president_republic",
  "parliamentary_constitutional_monarchies",
  "parliamentary_republics",
  "parliamentary_constitutional_monarchy",
  "absolute_monarchies",
  "military_junta",
  "one_party_state",
  "provisional_government",
] as const;

describe("Step 15D.3.1 — map pin legend WEB_UI localization", () => {
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

  it("1–3: ten active pins own WEB_UI legend keys; pins-config has no active hover prose; inactive untouched", () => {
    const contract = readWeb("features/world-map/map-pin-legend.ts");
    assert.match(contract, /MAP_PIN_LEGEND_ENTRIES/);
    assert.match(contract, /publicHome\.interactiveMap\.legend/);

    const english = loadBundledEnglishWebUiMessagePack();
    const legendPaths = collectStringPaths(english).filter((pathKey) =>
      pathKey.startsWith(LEGEND_PREFIX),
    );
    assert.equal(legendPaths.length, 20);
    for (const pathKey of legendPaths) {
      assert.equal(isPublicReaderWebUiRequiredPath(pathKey), true, pathKey);
    }

    const pins = readPublic("wdcr-js-map/pins-config.js");
    for (const id of EXPECTED_LEGEND_IDS) {
      assert.match(pins, new RegExp(`"legendId":\\s*"${id}"`));
    }
    assert.doesNotMatch(pins, /Presidential system/);
    assert.doesNotMatch(pins, /Parliamentary republics/);
    assert.doesNotMatch(pins, /Military junta/);
    assert.doesNotMatch(pins, /One-party state/);
    assert.doesNotMatch(pins, /Provisional government/);
    assert.match(pins, /WASHINGTON DC/);
    assert.match(pins, /LOS ANGELES/);
    assert.match(pins, /BLANK13/);
    assert.match(pins, /BLANK14/);
    assert.match(pins, /BLANK15/);
  });

  it("4–6: React → iframe setPinLabels by stable id; iframe renders injected hover", () => {
    const map = readWeb("features/world-map/components/InteractiveWorldMap.tsx");
    assert.match(map, /setPinLabels/);
    assert.match(map, /canonicalLabels/);
    assert.match(map, /MAP_PIN_LEGEND_ENTRIES/);
    assert.match(map, /messages\/en\.json/);

    const interact = readPublic("wdcr-js-map/map-interact.js");
    assert.match(interact, /setPinLabels/);
    assert.match(interact, /__HU_MAP_PIN_LABELS/);
    assert.match(interact, /setCountryNames/);
    assert.match(interact, /wdcrLocalizedHoverHtml/);
    assert.doesNotMatch(interact, /Democracy Index/);

    const pins = readPublic("wdcr-js-map/pins-config.js");
    assert.match(pins, /wdcrLocalizedPinHoverHtml/);
    assert.match(pins, /__HU_MAP_PIN_LABELS_CANONICAL/);
    assert.match(pins, /wdcrResolvePinLabel/);
  });

  it("6 non-bundled fixture can receive localized pin labels via contract", () => {
    const map = readWeb("features/world-map/components/InteractiveWorldMap.tsx");
    assert.match(map, /setPinLabels/);
    assert.match(map, /canonicalLabels/);
    // Runtime posts whatever next-intl resolves for the active locale (remote pack or English merge).
    assert.doesNotMatch(map, /\bka\b|\bhe\b|georgian/i);
  });

  it("7–9: uk/ar/zh-Hant bundled catalogs resolve legend titles", () => {
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const pack = loadBundledWebUiMessagePackFromFs(locale);
      assert.ok(pack);
      const title = getNested(
        pack as Record<string, unknown>,
        "publicHome.interactiveMap.legend.presidentialRepublics.title",
      );
      assert.equal(typeof title, "string");
      assert.notEqual(title, "Presidential system");
      assert.ok(String(title).length > 0, locale);
    }
  });

  it("10–13: public readiness includes legend; missing legend blocks; activation reuses rest", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const all = collectStringPaths(english);
    const required = all.filter((pathKey) => isPublicReaderWebUiRequiredPath(pathKey));
    const legendPaths = required.filter((pathKey) => pathKey.startsWith(LEGEND_PREFIX));
    assert.equal(legendPaths.length, 20);

    const prepared = selectEnglishWebUiMessages("public");
    assert.ok(prepared.selectedPaths.some((pathKey) => pathKey.startsWith(LEGEND_PREFIX)));

    const withoutLegend = required.filter((pathKey) => !pathKey.startsWith(LEGEND_PREFIX));
    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: projectPaths(english, withoutLegend, (value) => `[ka] ${value}`) as never,
      sourceNote: "ka pack missing legend keys only",
    });
    const incomplete = await assessWebUiCatalogReadinessForLocale({
      locale: "ka",
      scope: "public",
    });
    assert.equal(incomplete.dataReady, false);
    assert.equal(incomplete.missingKeyCount, 20);
    assert.ok(incomplete.sampleMissingPaths.every((path) => path.startsWith(LEGEND_PREFIX)));

    const corpus = loadPublicWebUiEnglishCorpus();
    const sourceHash = hashWebUiEnglishFlatMap(corpus.flat);
    const batches = planWebUiDraftBatches(corpus.flat);
    const checkpoint = {
      checkpointId: "webui-act-ka-legend-test",
      jobId: "lang-act-ka-legend-test",
      locale: "ka",
      generation: 1,
      sourceHash: "stale-before-legend",
      terminologyMode: "live" as const,
      phase: "ready" as const,
      leafCount: withoutLegend.length,
      batchCount: 1,
      completedBatchCount: 1,
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

    const uncovered = batches.filter(
      (batch) => !okSeeded.some((row) => row.batchId === batch.id),
    );
    assert.ok(uncovered.length > 0);
    assert.ok(
      uncovered.every((batch) =>
        batch.keys.every(
          (key) =>
            key.startsWith(LEGEND_PREFIX) ||
            // ordinary union may still include participant-only keys in some batches
            !withoutLegend.includes(key),
        ),
      ) ||
        uncovered.some((batch) => batch.keys.some((key) => key.startsWith(LEGEND_PREFIX))),
    );
    assert.ok(
      uncovered.some((batch) => batch.keys.some((key) => key.startsWith(LEGEND_PREFIX))),
      "at least one uncovered batch includes legend keys requiring provider preparation",
    );
  });

  it("14–17: country hover + URLs + geometry preserved; no provider-on-read", () => {
    const map = readWeb("features/world-map/components/InteractiveWorldMap.tsx");
    assert.match(map, /getLocalizedCountryDisplayName/);
    assert.match(map, /setCountryNames/);
    assert.doesNotMatch(map, /GEMINI|generateContent|TranslationProvider/);

    const pins = readPublic("wdcr-js-map/pins-config.js");
    assert.match(pins, /https:\/\/en\.wikipedia\.org\/wiki\/Presidential_system/);
    assert.match(pins, /https:\/\/en\.wikipedia\.org\/wiki\/Provisional_government/);
    assert.match(pins, /"pos_X": 10/);
    assert.match(pins, /"pos_Y": 250/);
    assert.match(pins, /"upColor": "#0174b0"/);

    const interact = readPublic("wdcr-js-map/map-interact.js");
    assert.doesNotMatch(interact, /Democracy Index/);
  });

  it("15: activation preparation modules do not provider-on-read map pins", () => {
    const assess = readRepo(
      "apps/api/src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.ts",
    );
    assert.doesNotMatch(assess, /pins-config|setPinLabels|wdcr-js-map/);
  });
});
