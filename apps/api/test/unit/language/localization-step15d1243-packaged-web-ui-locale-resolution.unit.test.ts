/**
 * Step 15D.12.4.3 — Packaged WEB_UI locale-key resolution (case / canonical identity).
 * Deterministic. No Gemini. No staging/production writes.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { LanguageActivationJobRecord } from "@hu/types";

import {
  emptyPendingDomains,
  isLanguageActivationWebUiReadyForHistoricalEnqueue,
} from "../../../src/modules/language/language-localization-activation/index.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import { tryAdoptPackagedWebUiCatalog } from "../../../src/modules/web-ui-message-packs/adopt-packaged-web-ui-catalog.js";
import { ensureWebUiActivationCheckpoint } from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
import {
  hasPackagedWebUiCatalog,
  loadPackagedWebUiCatalog,
  resetPackagedWebUiCatalogIndexForTests,
  resolvePackagedWebUiCatalog,
  setPackagedWebUiCatalogIndexForTests,
  setPackagedWebUiCatalogsDirForTests,
} from "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import {
  getPublishedWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const INCLUDE_PATHS = [
  "common.language",
  "common.save",
  "common.cancel",
  "common.loading",
  "common.error",
  "common.retry",
] as const;

function stubJob(locale: string): LanguageActivationJobRecord {
  const stamp = "2026-09-25T12:00:00.000Z";
  return {
    jobId: `job-${locale}`,
    locale,
    languageId: `lang-${locale}`,
    generation: 1,
    status: "running",
    domains: emptyPendingDomains(),
    lastError: null,
    diagnosticSummary: null,
    createdAt: stamp,
    updatedAt: stamp,
    startedAt: stamp,
    completedAt: null,
    createdByParticipantId: "admin-test",
    searchEnabledSnapshot: false,
    seoIndexingEnabledSnapshot: false,
  };
}

describe("Step 15D.12.4.3 packaged WEB_UI locale resolution", () => {
  let fixtureDir: string | null = null;

  beforeEach(async () => {
    resetPackagedWebUiCatalogIndexForTests();
    setPackagedWebUiCatalogsDirForTests(null);
    setPackagedWebUiCatalogIndexForTests(null);
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    setWebUiActivationCheckpointForceMemoryForTests(true);
    resetWebUiActivationCheckpointStoreForTests();
  });

  afterEach(() => {
    setPackagedWebUiCatalogIndexForTests(null);
    setPackagedWebUiCatalogsDirForTests(null);
    resetPackagedWebUiCatalogIndexForTests();
    if (fixtureDir) {
      rmSync(fixtureDir, { recursive: true, force: true });
      fixtureDir = null;
    }
  });

  function useFixtureDir(): string {
    fixtureDir = mkdtempSync(path.join(tmpdir(), "hu-packaged-web-ui-"));
    setPackagedWebUiCatalogsDirForTests(fixtureDir);
    resetPackagedWebUiCatalogIndexForTests();
    return fixtureDir;
  }

  it("1. zh-hant resolves packaged zh-Hant.json", () => {
    const resolved = resolvePackagedWebUiCatalog("zh-hant");
    assert.equal(resolved.outcome, "found");
    if (resolved.outcome === "found") {
      assert.equal(resolved.fileStem, "zh-Hant");
      assert.equal(resolved.localeKey, "zh-hant");
      assert.ok(resolved.filePath.endsWith(`${path.sep}zh-Hant.json`));
    }
    assert.ok(loadPackagedWebUiCatalog("zh-hant"));
    assert.equal(hasPackagedWebUiCatalog("zh-hant"), true);
  });

  it("2. matching canonical casing still resolves", () => {
    const resolved = resolvePackagedWebUiCatalog("zh-Hant");
    assert.equal(resolved.outcome, "found");
    if (resolved.outcome === "found") {
      assert.equal(resolved.fileStem, "zh-Hant");
    }
    assert.ok(loadPackagedWebUiCatalog("uk"));
    assert.ok(loadPackagedWebUiCatalog("UK"));
    assert.ok(loadPackagedWebUiCatalog("ar"));
    assert.ok(loadPackagedWebUiCatalog("en"));
  });

  it("3. lookup is locale-agnostic (no zh-Hant special branch)", () => {
    const src = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.ts",
      ),
      "utf8",
    );
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    assert.equal(/zh-Hant|zh-hant|zh_Hant/.test(codeOnly), false);

    const dir = useFixtureDir();
    writeFileSync(
      path.join(dir, "pt-BR.json"),
      JSON.stringify({ common: { language: "Idioma" } }),
    );
    resetPackagedWebUiCatalogIndexForTests();
    const resolved = resolvePackagedWebUiCatalog("pt-br");
    assert.equal(resolved.outcome, "found");
    if (resolved.outcome === "found") {
      assert.equal(resolved.fileStem, "pt-BR");
    }
  });

  it("4. unknown locale returns absent; provider fallback path remains available", async () => {
    assert.equal(resolvePackagedWebUiCatalog("no-such-locale-xyz").outcome, "absent");
    assert.equal(loadPackagedWebUiCatalog("no-such-locale-xyz"), null);

    await createLanguageRegistryRecord({
      locale: "zz-UnknownPkg",
      englishName: "Test",
      nativeName: "zz",
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });

    const ensured = await ensureWebUiActivationCheckpoint({
      job: stubJob("zz-UnknownPkg"),
      deps: { includePaths: INCLUDE_PATHS },
    });
    assert.equal(ensured.skipped, false);
    assert.ok(ensured.checkpoint);
    assert.notEqual(ensured.adoptedFromPackaged, true);
    assert.equal(ensured.webUi.dataReady, false);
  });

  it("5. normalized filename collision does not silently select an asset", async () => {
    setPackagedWebUiCatalogIndexForTests({
      unique: new Map(),
      collisions: new Map([["xx-test", ["XX-TEST", "xx-Test"]]]),
    });

    const resolved = resolvePackagedWebUiCatalog("xx-test");
    assert.equal(resolved.outcome, "collision");
    if (resolved.outcome === "collision") {
      assert.equal(resolved.localeKey, "xx-test");
      assert.deepEqual([...resolved.fileStems].sort(), ["XX-TEST", "xx-Test"].sort());
      assert.match(resolved.detail, /collision/i);
      assert.match(resolved.detail, /xx-Test\.json/);
    }
    assert.equal(loadPackagedWebUiCatalog("xx-test"), null);
    assert.equal(hasPackagedWebUiCatalog("xx-test"), false);

    const adopted = await tryAdoptPackagedWebUiCatalog({ locale: "xx-test" });
    assert.equal(adopted.outcome, "rejected");
    if (adopted.outcome === "rejected") {
      assert.match(adopted.reason, /collision/i);
    }
    assert.equal(await getPublishedWebUiMessagePackByLocale("xx-test"), null);
  });

  it("6. valid resolved packaged catalog still adopts via V5 validation/publish path", async () => {
    const dir = useFixtureDir();
    const { unflattenWebUiMessageMap } = await import(
      "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js"
    );
    const { loadBundledEnglishWebUiMessagePack } = await import(
      "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js"
    );
    const english = loadBundledEnglishWebUiMessagePack() as Record<string, unknown>;
    const flat: Record<string, string> = {};
    for (const pathKey of INCLUDE_PATHS) {
      let cursor: unknown = english;
      for (const segment of pathKey.split(".")) {
        cursor = (cursor as Record<string, unknown>)?.[segment];
      }
      if (typeof cursor === "string") {
        flat[pathKey] = `·${cursor}`;
      }
    }
    // Canonical-cased filename; activation uses normalized key.
    writeFileSync(path.join(dir, "Zz-Case.json"), JSON.stringify(unflattenWebUiMessageMap(flat)));
    resetPackagedWebUiCatalogIndexForTests();

    assert.equal(resolvePackagedWebUiCatalog("zz-case").outcome, "found");

    await createLanguageRegistryRecord({
      locale: "Zz-Case",
      englishName: "Test Case",
      nativeName: "zz",
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });

    const ensured = await ensureWebUiActivationCheckpoint({
      job: stubJob("zz-case"),
      deps: { includePaths: INCLUDE_PATHS },
    });
    assert.equal(ensured.skipped, true);
    assert.equal(ensured.adoptedFromPackaged, true);
    assert.equal(ensured.webUi.dataReady, true);
    const published = await getPublishedWebUiMessagePackByLocale("zz-case");
    assert.ok(published);
    assert.equal(published?.status, "published");
    assert.match(published?.sourceNote ?? "", /packaged catalog adoption/);
  });

  it("7. CT/PLP gate remains blocked until authoritative WEB_UI READY", () => {
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: {
          ...emptyPendingDomains().webUi,
          status: "waiting_for_data",
          dataReady: false,
          preparationPhase: null,
        },
        publicWebUiDataReady: false,
        participantWebUiDataReady: false,
      }),
      false,
    );
  });
});
