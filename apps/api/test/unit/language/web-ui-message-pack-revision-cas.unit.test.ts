/**
 * HU-LC-05C.4C.7F.7F — Admin WEB_UI pack optimistic concurrency (expectedRevision).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareAndSetWebUiMessagePack,
  getWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  WebUiMessagePackRevisionConflictError,
  WebUiMessagePackValidationError,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.errors.js";
import { loadBundledEnglishWebUiMessagePack } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import {
  setWebUiMessagePackAdminAssertOverrideForTests,
  upsertAdminWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.service.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCALE = "zz-CasRev";

describe("WEB_UI message pack revision compare-and-set", () => {
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
    setWebUiMessagePackAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-cas",
    }));
  });

  afterEach(() => {
    setWebUiMessagePackAdminAssertOverrideForTests(null);
  });

  it("matching revision update saves values and increments revision once", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const created = await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "published",
      messages: english as never,
      sourceNote: "seed",
    });
    assert.equal(created.revision, 1);

    const updated = await compareAndSetWebUiMessagePack({
      locale: LOCALE,
      expectedRevision: 1,
      status: "published",
      messages: english as never,
      sourceNote: "cas-update",
    });
    assert.equal(updated.revision, 2);
    assert.equal(updated.sourceNote, "cas-update");

    const stored = await getWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 2);
    assert.equal(stored?.sourceNote, "cas-update");
  });

  it("stale revision conflict performs no write", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "published",
      messages: english as never,
      sourceNote: "seed",
    });

    await assert.rejects(
      () =>
        compareAndSetWebUiMessagePack({
          locale: LOCALE,
          expectedRevision: 99,
          status: "published",
          messages: english as never,
          sourceNote: "should-not-write",
        }),
      (error: unknown) => error instanceof WebUiMessagePackRevisionConflictError,
    );

    const stored = await getWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
    assert.equal(stored?.sourceNote, "seed");
  });

  it("create with expectedRevision null inserts revision 1", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const created = await compareAndSetWebUiMessagePack({
      locale: LOCALE,
      expectedRevision: null,
      status: "published",
      messages: english as never,
      sourceNote: "create",
    });
    assert.equal(created.revision, 1);
    assert.equal(created.sourceNote, "create");
  });

  it("concurrent create with expectedRevision null conflicts", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await compareAndSetWebUiMessagePack({
      locale: LOCALE,
      expectedRevision: null,
      status: "published",
      messages: english as never,
    });

    await assert.rejects(
      () =>
        compareAndSetWebUiMessagePack({
          locale: LOCALE,
          expectedRevision: null,
          status: "published",
          messages: english as never,
        }),
      (error: unknown) => error instanceof WebUiMessagePackRevisionConflictError,
    );

    const stored = await getWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
  });

  it("Admin upsert requires expectedRevision (omitted → validation error)", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await assert.rejects(
      () =>
        upsertAdminWebUiMessagePack({
          actorUserId: "admin-1",
          body: {
            locale: LOCALE,
            messages: english,
            status: "published",
          },
        }),
      (error: unknown) =>
        error instanceof Error && /expectedRevision is required/i.test(error.message),
    );
  });

  it("Admin upsert rejects invalid expectedRevision", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await assert.rejects(
      () =>
        upsertAdminWebUiMessagePack({
          actorUserId: "admin-1",
          body: {
            locale: LOCALE,
            messages: english,
            status: "published",
            expectedRevision: 0,
          },
        }),
      (error: unknown) =>
        error instanceof Error &&
        /expectedRevision must be a positive integer or null/i.test(error.message),
    );
    await assert.rejects(
      () =>
        upsertAdminWebUiMessagePack({
          actorUserId: "admin-1",
          body: {
            locale: LOCALE,
            messages: english,
            status: "published",
            expectedRevision: "1",
          },
        }),
      (error: unknown) =>
        error instanceof Error &&
        /expectedRevision must be a positive integer or null/i.test(error.message),
    );
  });

  it("Admin upsert with matching expectedRevision succeeds", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "draft",
      messages: english as never,
      sourceNote: "seed",
    });

    const result = await upsertAdminWebUiMessagePack({
      actorUserId: "admin-1",
      body: {
        locale: LOCALE,
        messages: english,
        status: "published",
        expectedRevision: 1,
        sourceNote: "admin-import",
      },
    });
    assert.equal(result.pack.revision, 2);
    assert.equal(result.pack.status, "published");
    assert.equal(result.pack.sourceNote, "admin-import");
  });

  it("Admin authentication is required (unauthorized without actor)", async () => {
    setWebUiMessagePackAdminAssertOverrideForTests(null);
    const english = loadBundledEnglishWebUiMessagePack();
    await assert.rejects(
      () =>
        upsertAdminWebUiMessagePack({
          actorUserId: "",
          body: {
            locale: LOCALE,
            messages: english,
            status: "published",
            expectedRevision: null,
          },
        }),
      (error: unknown) =>
        error instanceof Error && /unauthor/i.test(error.name + error.message),
    );
    setWebUiMessagePackAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "admin-participant-1",
    }));
  });

  it("Admin route preserves authentication middleware — source contract", () => {
    const routes = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/web-ui-message-packs/admin-web-ui-message-pack.routes.ts",
      ),
      "utf8",
    );
    assert.match(routes, /authenticationMiddleware/);
    assert.match(routes, /requireAuthenticationMiddleware/);
    assert.match(routes, /actorUserId:\s*req\.auth!\.id/);
  });

  it("compareAndSet rejects invalid expectedRevision numbers", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    await assert.rejects(
      () =>
        compareAndSetWebUiMessagePack({
          locale: LOCALE,
          expectedRevision: -1,
          messages: english as never,
        }),
      (error: unknown) => error instanceof WebUiMessagePackValidationError,
    );
  });

  it("Mongo CAS filter is atomic (localeKey + revision) — source contract", () => {
    const repo = readFileSync(
      path.resolve(here, "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.ts"),
      "utf8",
    );
    assert.match(repo, /findOneAndUpdate\(/);
    assert.match(repo, /localeKey,\s*revision:\s*expectedRevision/);
    assert.match(repo, /insertOne\(/);
    assert.match(repo, /isMongoDuplicateKeyError/);
    assert.match(repo, /compareAndSetWebUiMessagePackMemory/);
  });

  it("Admin route maps revision conflict to HTTP 409 — source contract", () => {
    const routes = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/web-ui-message-packs/admin-web-ui-message-pack.routes.ts",
      ),
      "utf8",
    );
    assert.match(routes, /WebUiMessagePackRevisionConflictError/);
    assert.match(routes, /return 409/);
  });

  it("trusted internal upsert remains available without expectedRevision", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const first = await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "published",
      messages: english as never,
    });
    const second = await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "published",
      messages: english as never,
      sourceNote: "internal-overwrite",
    });
    assert.equal(first.revision, 1);
    assert.equal(second.revision, 2);
    assert.equal(second.sourceNote, "internal-overwrite");
  });
});
