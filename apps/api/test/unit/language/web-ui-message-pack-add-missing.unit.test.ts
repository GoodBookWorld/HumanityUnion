/**
 * HU-LC-05C.4C.7F.7G — Admin additive fill of missing WEB_UI keys from packaged catalog.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { WebUiMessageTree } from "@hu/types";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import { mergeMissingPackagedWebUiMessages } from "../../../src/modules/web-ui-message-packs/merge-missing-packaged-web-ui-messages.js";
import {
  resetPackagedWebUiCatalogIndexForTests,
  setPackagedWebUiCatalogsDirForTests,
} from "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import { WebUiMessagePackRevisionConflictError } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.errors.js";
import {
  getPublishedWebUiMessagePackByLocale,
  getWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  applyAdminAddMissingWebUiFromPackaged,
  previewAdminAddMissingWebUiFromPackaged,
  setWebUiMessagePackAdminAssertOverrideForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.service.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCALE = "zz-AddMiss";

/** English-foundation paths only (validation-safe). */
const PACKAGED: WebUiMessageTree = {
  common: {
    save: "Зберегти",
    cancel: "Скасувати",
    loading: "Завантаження",
    error: "Помилка",
  },
};

const PARTIAL_EXISTING: WebUiMessageTree = {
  common: {
    save: "ADMIN-SAVE",
    cancel: "ADMIN-CANCEL",
  },
};

function writePackagedFixture(tree: WebUiMessageTree): string {
  const dir = mkdtempSync(path.join(tmpdir(), "hu-packaged-web-ui-"));
  writeFileSync(path.join(dir, `${LOCALE}.json`), JSON.stringify(tree), "utf8");
  return dir;
}

describe("WEB_UI add missing from packaged catalog", () => {
  beforeEach(async () => {
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await createLanguageRegistryRecord({
      locale: LOCALE,
      englishName: `Test ${LOCALE}`,
      nativeName: LOCALE,
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: true,
      contentTranslationEnabled: false,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });
    setPackagedWebUiCatalogsDirForTests(writePackagedFixture(PACKAGED));
    resetPackagedWebUiCatalogIndexForTests();
    setWebUiMessagePackAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-add-missing",
    }));
  });

  afterEach(() => {
    setWebUiMessagePackAdminAssertOverrideForTests(null);
    setPackagedWebUiCatalogsDirForTests(null);
    resetPackagedWebUiCatalogIndexForTests();
  });

  it("merge helper preserves existing values and adds only missing leaves", () => {
    const merge = mergeMissingPackagedWebUiMessages({
      existing: PARTIAL_EXISTING,
      packaged: PACKAGED,
    });
    assert.equal(merge.existingKeyCount, 2);
    assert.equal(merge.missingKeyCount, 2);
    assert.equal(merge.expectedFinalCount, 4);
    assert.equal(merge.changed, true);
    assert.deepEqual(merge.addedPaths, ["common.error", "common.loading"]);
    assert.equal(
      (merge.messages as { common: { save: string } }).common.save,
      "ADMIN-SAVE",
    );
    assert.equal(
      (merge.messages as { common: { cancel: string } }).common.cancel,
      "ADMIN-CANCEL",
    );
    assert.equal(
      (merge.messages as { common: { loading: string } }).common.loading,
      "Завантаження",
    );
  });

  it("preview counts match additive merge", async () => {
    await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "published",
      messages: PARTIAL_EXISTING as never,
    });
    const preview = await previewAdminAddMissingWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
    });
    assert.equal(preview.packagedCatalogExists, true);
    assert.equal(preview.currentRevision, 1);
    assert.equal(preview.existingKeyCount, 2);
    assert.equal(preview.missingKeyCount, 2);
    assert.equal(preview.expectedFinalCount, 4);
    assert.equal(preview.packStatus, "published");
  });

  it("apply adds missing keys, preserves existing, increments revision once", async () => {
    await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "published",
      messages: PARTIAL_EXISTING as never,
      sourceNote: "seed",
    });
    const result = await applyAdminAddMissingWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { expectedRevision: 1 },
    });
    assert.equal(result.changed, true);
    assert.equal(result.addedKeyCount, 2);
    assert.equal(result.pack.revision, 2);
    assert.equal(
      (result.pack.messages as { common: { save: string } }).common.save,
      "ADMIN-SAVE",
    );
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 2);
    assert.equal(
      (stored?.messages as { common: { loading: string } }).common.loading,
      "Завантаження",
    );
  });

  it("stale revision conflicts and performs no write", async () => {
    await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "published",
      messages: PARTIAL_EXISTING as never,
    });
    await assert.rejects(
      () =>
        applyAdminAddMissingWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: { expectedRevision: 99 },
        }),
      (error: unknown) => error instanceof WebUiMessagePackRevisionConflictError,
    );
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
    assert.equal(
      Object.keys((stored?.messages as { common: object }).common).length,
      2,
    );
  });

  it("no-op when nothing missing does not increment revision", async () => {
    await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "published",
      messages: PACKAGED as never,
    });
    const result = await applyAdminAddMissingWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { expectedRevision: 1 },
    });
    assert.equal(result.changed, false);
    assert.equal(result.addedKeyCount, 0);
    assert.equal(result.pack.revision, 1);
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
  });

  it("missing packaged catalog is reported by preview and rejected on apply", async () => {
    setPackagedWebUiCatalogsDirForTests(mkdtempSync(path.join(tmpdir(), "hu-empty-packaged-")));
    resetPackagedWebUiCatalogIndexForTests();
    const preview = await previewAdminAddMissingWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
    });
    assert.equal(preview.packagedCatalogExists, false);
    assert.equal(preview.missingKeyCount, 0);
    await assert.rejects(
      () =>
        applyAdminAddMissingWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: { expectedRevision: null },
        }),
      (error: unknown) =>
        error instanceof Error && /No packaged WEB_UI catalog/i.test(error.message),
    );
  });

  it("create with expectedRevision null inserts packaged catalog", async () => {
    const result = await applyAdminAddMissingWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { expectedRevision: null },
    });
    assert.equal(result.changed, true);
    assert.equal(result.pack.revision, 1);
    assert.equal(result.addedKeyCount, 4);
    assert.equal(result.pack.status, "published");
  });

  it("concurrent create conflicts when pack already exists", async () => {
    await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "published",
      messages: PARTIAL_EXISTING as never,
    });
    await assert.rejects(
      () =>
        applyAdminAddMissingWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: { expectedRevision: null },
        }),
      (error: unknown) => error instanceof WebUiMessagePackRevisionConflictError,
    );
    assert.equal((await getWebUiMessagePackByLocale(LOCALE))?.revision, 1);
  });

  it("Admin authentication is required", async () => {
    setWebUiMessagePackAdminAssertOverrideForTests(null);
    await assert.rejects(
      () =>
        previewAdminAddMissingWebUiFromPackaged({
          actorUserId: "",
          locale: LOCALE,
        }),
      (error: unknown) =>
        error instanceof Error && /unauthor/i.test(error.name + error.message),
    );
    setWebUiMessagePackAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-add-missing",
    }));
  });

  it("omitted expectedRevision is rejected", async () => {
    await assert.rejects(
      () =>
        applyAdminAddMissingWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: {},
        }),
      (error: unknown) =>
        error instanceof Error && /expectedRevision is required/i.test(error.message),
    );
  });

  it("route contracts: preview GET, apply POST, 409 mapping, auth — source", () => {
    const routes = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/web-ui-message-packs/admin-web-ui-message-pack.routes.ts",
      ),
      "utf8",
    );
    assert.match(routes, /\/:locale\/add-missing-from-packaged/);
    assert.match(routes, /previewAdminAddMissingWebUiFromPackaged/);
    assert.match(routes, /applyAdminAddMissingWebUiFromPackaged/);
    assert.match(routes, /authenticationMiddleware/);
    assert.match(routes, /return 409/);
    const repo = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.ts",
      ),
      "utf8",
    );
    assert.match(repo, /findOneAndUpdate\(/);
    assert.match(repo, /localeKey,\s*revision:\s*expectedRevision/);
    assert.match(repo, /insertOne\(/);
  });

  it("memory adapter parity: two sequential applies — second is no-op", async () => {
    await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "published",
      messages: PARTIAL_EXISTING as never,
    });
    const first = await applyAdminAddMissingWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { expectedRevision: 1 },
    });
    assert.equal(first.changed, true);
    assert.equal(first.pack.revision, 2);
    const second = await applyAdminAddMissingWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { expectedRevision: 2 },
    });
    assert.equal(second.changed, false);
    assert.equal(second.pack.revision, 2);
  });
});
