/**
 * HU-LC-05C.4C.7F.7G — Admin additive fill of missing WEB_UI keys from packaged catalog.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { normalizeLanguageRegistryLocaleKey, type WebUiMessageTree } from "@hu/types";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  listLanguageRegistry,
  resetLanguageRegistryStoreForTests,
  resolveLanguageRegistryLocale,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import { mergeMissingPackagedWebUiMessages } from "../../../src/modules/web-ui-message-packs/merge-missing-packaged-web-ui-messages.js";
import { upsertWebUiMessagePackMemory } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.memory.store.js";
import {
  loadPackagedWebUiCatalog,
  resetPackagedWebUiCatalogIndexForTests,
  setPackagedWebUiCatalogsDirForTests,
} from "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import {
  WebUiMessagePackRevisionConflictError,
  WebUiMessagePackValidationError,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.errors.js";
import {
  compareAndSetWebUiMessagePack,
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
import {
  collectStringPaths,
  resetEnglishWebUiPathCacheForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

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
    resetEnglishWebUiPathCacheForTests();
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

  it("adds packaged account deletion keys and keeps an approved translation", () => {
    const catalogs = path.resolve(here, "../../../assets/packaged-web-ui-catalogs");
    setPackagedWebUiCatalogsDirForTests(catalogs);
    resetPackagedWebUiCatalogIndexForTests();
    assert.equal(loadPackagedWebUiCatalog("zz-future-language"), null);
    const english = loadPackagedWebUiCatalog("en") as {
      auth: Record<string, string>;
    };
    assert.match(english.auth.deleteAccountScheduled ?? "", /\{deadline\}/);
    const merge = mergeMissingPackagedWebUiMessages({
      existing: { auth: { deleteAccountTitle: "APPROVED TITLE" } },
      packaged: english,
    });
    const auth = (merge.messages as { auth: Record<string, string> }).auth;
    assert.equal(auth.deleteAccountTitle, "APPROVED TITLE");
    assert.equal(auth.deleteAccountIntro, english.auth.deleteAccountIntro);
    assert.equal(merge.addedPaths.includes("auth.deleteAccountTitle"), false);
    assert.equal(merge.addedPaths.includes("auth.deleteAccountIntro"), true);
  });

  const DELETION_KEYS = [
    "deleteAccountTitle",
    "deleteAccountIntro",
    "deleteAccountConsequences",
    "deleteAccountButton",
    "deleteAccountSendCode",
    "deleteAccountCodeLabel",
    "deleteAccountConfirm",
    "deleteAccountCodeSent",
    "deleteAccountScheduled",
    "deleteAccountUnavailable",
    "recoveryTitle",
    "recoveryIntro",
    "recoveryEmail",
    "recoverySendCode",
    "recoveryPassword",
    "recoveryCode",
    "recoverySubmit",
    "recoverySent",
    "recoverySuccess",
    "recoverySignIn",
    "recoveryFailed",
    "deleteAccountPasswordIncorrect",
    "deleteAccountCodeInvalid",
    "deleteAccountMailFailed",
    "deleteAccountAdminBlocked",
    "deleteAccountSuspendedBlocked",
    "deleteAccountRrpBlocked",
    "deleteAccountEditorBlocked",
    "deleteAccountConflict",
    "deleteAccountGenericError",
  ] as const;
  const PUBLISHED_LOCALES = ["ar", "de", "es", "fr", "he", "ka", "pt", "uk", "zh-Hant"] as const;

  function readLeaf(messages: WebUiMessageTree, dottedPath: string): string | undefined {
    let cursor: unknown = messages;
    for (const segment of dottedPath.split(".")) {
      if (cursor == null || typeof cursor !== "object" || Array.isArray(cursor)) {
        return undefined;
      }
      cursor = (cursor as Record<string, unknown>)[segment];
    }
    return typeof cursor === "string" ? cursor : undefined;
  }

  function seedHistoricalPublishedPack(
    locale: string,
    messages: WebUiMessageTree,
    sourceNote = "approved",
  ): void {
    const localeKey = normalizeLanguageRegistryLocaleKey(locale);
    upsertWebUiMessagePackMemory(
      {
        packId: `web-ui-pack-${localeKey}`,
        locale,
        revision: 1,
        status: "published",
        messages,
        createdAt: "2026-11-01T00:00:00.000Z",
        updatedAt: "2026-11-01T00:00:00.000Z",
        updatedByParticipantId: null,
        sourceNote,
        sourceFingerprintsByPath: null,
      },
      localeKey,
    );
  }

  it("adds the deletion keys without changing a published placeholder mismatch", async () => {
    const catalogs = path.resolve(here, "../../../assets/packaged-web-ui-catalogs");
    setPackagedWebUiCatalogsDirForTests(catalogs);
    resetPackagedWebUiCatalogIndexForTests();
    resetEnglishWebUiPathCacheForTests();
    const registry = await listLanguageRegistry();
    for (const locale of PUBLISHED_LOCALES) {
      if (registry.some((record) => record.locale === locale)) {
        continue;
      }
      await createLanguageRegistryRecord({
        locale,
        englishName: locale,
        nativeName: locale,
        textDirection: locale === "he" ? "rtl" : "ltr",
        fallbackLocale: "en",
        enabled: true,
        contentTranslationEnabled: false,
        searchEnabled: false,
        seoIndexingEnabled: false,
        pwaPersistedReadingEnabled: false,
        uiTranslationStatus: "none",
      });
    }

    for (const locale of PUBLISHED_LOCALES) {
      const packaged = loadPackagedWebUiCatalog(locale) as WebUiMessageTree & {
        auth: Record<string, string>;
        rrpApplication: { admin: { fields: { consentAccepted: string } } };
      };
      const existing = structuredClone(packaged);
      for (const key of DELETION_KEYS) {
        delete existing.auth[key];
      }
      const approvedConsent = `${existing.rrpApplication.admin.fields.consentAccepted} {version}`;
      existing.rrpApplication.admin.fields.consentAccepted = approvedConsent;
      const approvedLeaves = new Map(
        collectStringPaths(existing).map((pathKey) => [pathKey, readLeaf(existing, pathKey)]),
      );
      seedHistoricalPublishedPack(locale, existing);

      const result = await applyAdminAddMissingWebUiFromPackaged({
        actorUserId: "admin-1",
        locale,
        body: { expectedRevision: 1 },
      });
      assert.equal(result.changed, true, locale);
      assert.equal(result.addedKeyCount, DELETION_KEYS.length, locale);
      assert.equal(result.pack.revision, 2, locale);

      const stored = await getPublishedWebUiMessagePackByLocale(locale);
      assert.equal(stored?.revision, 2, locale);
      assert.equal(stored?.sourceNote, "approved", locale);
      const storedAuth = (stored?.messages as { auth: Record<string, string> }).auth;
      for (const key of DELETION_KEYS) {
        assert.equal(storedAuth[key], packaged.auth[key], `${locale}.${key}`);
      }
      for (const [pathKey, value] of approvedLeaves) {
        assert.equal(readLeaf(stored!.messages, pathKey), value, `${locale}.${pathKey}`);
      }
      assert.equal(
        readLeaf(stored!.messages, "rrpApplication.admin.fields.consentAccepted"),
        approvedConsent,
        locale,
      );
      const direction = (await resolveLanguageRegistryLocale(locale))?.textDirection;
      assert.equal(direction, locale === "ar" || locale === "he" ? "rtl" : "ltr", locale);
    }
  });

  it("rejects a new placeholder mismatch and leaves the published pack unchanged", async () => {
    const approvedConsent = "accepted {version} on {at}";
    setPackagedWebUiCatalogsDirForTests(
      writePackagedFixture({
        common: { loading: "Завантаження" },
        auth: { deleteAccountScheduled: "due {version}" },
        rrpApplication: {
          admin: { fields: { consentAccepted: "packaged consent {at}" } },
        },
      }),
    );
    resetPackagedWebUiCatalogIndexForTests();
    seedHistoricalPublishedPack(LOCALE, {
      rrpApplication: { admin: { fields: { consentAccepted: approvedConsent } } },
    });

    await assert.rejects(
      () =>
        applyAdminAddMissingWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: { expectedRevision: 1 },
        }),
      (error: unknown) =>
        error instanceof WebUiMessagePackValidationError &&
        error.message === "Merged WEB_UI catalog failed English foundation validation.",
    );
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
    assert.equal(stored?.sourceNote, "approved");
    assert.equal(
      readLeaf(stored!.messages, "rrpApplication.admin.fields.consentAccepted"),
      approvedConsent,
    );
    assert.equal(readLeaf(stored!.messages, "common.loading"), undefined);
    assert.equal(readLeaf(stored!.messages, "auth.deleteAccountScheduled"), undefined);
  });

  it("rejects an unknown new key without a partial write", async () => {
    setPackagedWebUiCatalogsDirForTests(
      writePackagedFixture({
        common: { loading: "Завантаження" },
        notARealCatalog: { invented: "no" },
      }),
    );
    resetPackagedWebUiCatalogIndexForTests();
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
          body: { expectedRevision: 1 },
        }),
      (error: unknown) => error instanceof WebUiMessagePackValidationError,
    );
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
    assert.equal(readLeaf(stored!.messages, "common.loading"), undefined);
    assert.equal(readLeaf(stored!.messages, "common.save"), "ADMIN-SAVE");
  });

  it("rejects a malformed new value and an overwrite before revision changes", async () => {
    seedHistoricalPublishedPack(LOCALE, {
      common: { save: "ADMIN-SAVE" },
      rrpApplication: {
        admin: { fields: { consentAccepted: "accepted {version} on {at}" } },
      },
    });
    await assert.rejects(
      () =>
        compareAndSetWebUiMessagePack({
          locale: LOCALE,
          expectedRevision: 1,
          preserveExistingPublishedLeaves: true,
          messages: {
            common: { save: "ADMIN-SAVE", broken: 1 },
            rrpApplication: {
              admin: { fields: { consentAccepted: "accepted {version} on {at}" } },
            },
          } as never,
        }),
      (error: unknown) => error instanceof WebUiMessagePackValidationError,
    );
    await assert.rejects(
      () =>
        compareAndSetWebUiMessagePack({
          locale: LOCALE,
          expectedRevision: 1,
          preserveExistingPublishedLeaves: true,
          messages: {
            common: { save: "REPLACED" },
            rrpApplication: {
              admin: { fields: { consentAccepted: "accepted {version} on {at}" } },
            },
          } as never,
        }),
      (error: unknown) =>
        error instanceof WebUiMessagePackValidationError &&
        /cannot be changed/.test(error.message),
    );
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
    assert.equal(readLeaf(stored!.messages, "common.save"), "ADMIN-SAVE");
    assert.equal(
      readLeaf(stored!.messages, "rrpApplication.admin.fields.consentAccepted"),
      "accepted {version} on {at}",
    );
  });

  it("keeps full-tree validation for ordinary catalog writes", async () => {
    await assert.rejects(
      () =>
        upsertWebUiMessagePack({
          locale: LOCALE,
          status: "published",
          messages: {
            rrpApplication: {
              admin: { fields: { consentAccepted: "accepted {version} on {at}" } },
            },
          } as never,
        }),
      (error: unknown) => error instanceof WebUiMessagePackValidationError,
    );
    assert.equal(await getWebUiMessagePackByLocale(LOCALE), null);
    await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "published",
      messages: { common: { save: "Keep" } } as never,
    });
    await assert.rejects(
      () =>
        compareAndSetWebUiMessagePack({
          locale: LOCALE,
          expectedRevision: 1,
          messages: {
            common: { save: "Keep" },
            rrpApplication: {
              admin: { fields: { consentAccepted: "accepted {version} on {at}" } },
            },
          } as never,
        }),
      (error: unknown) => error instanceof WebUiMessagePackValidationError,
    );
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
    assert.equal(readLeaf(stored!.messages, "common.save"), "Keep");
  });

  it("still rejects a brand-new catalog that fails the English foundation", async () => {
    setPackagedWebUiCatalogsDirForTests(
      writePackagedFixture({
        auth: { deleteAccountScheduled: "due {version}" },
      }),
    );
    resetPackagedWebUiCatalogIndexForTests();
    await assert.rejects(
      () =>
        applyAdminAddMissingWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: { expectedRevision: null },
        }),
      (error: unknown) =>
        error instanceof WebUiMessagePackValidationError &&
        error.message === "Packaged WEB_UI catalog failed English foundation validation.",
    );
    assert.equal(await getWebUiMessagePackByLocale(LOCALE), null);
  });

  it("keeps English as the fallback catalog and does not publish an English pack", async () => {
    const loader = readFileSync(
      path.resolve(here, "../../../../web/src/features/i18n/load-ui-messages.ts"),
      "utf8",
    );
    assert.match(loader, /packSource: "english-only"/);
    assert.match(loader, /deepMergeMessages\(englishPack\.messages, overlay\.messages\)/);
    await assert.rejects(
      () =>
        applyAdminAddMissingWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: "en",
          body: { expectedRevision: null },
        }),
      (error: unknown) =>
        error instanceof WebUiMessagePackValidationError &&
        /canonical English catalog cannot be replaced/.test(error.message),
    );
    assert.equal(await getWebUiMessagePackByLocale("en"), null);
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
