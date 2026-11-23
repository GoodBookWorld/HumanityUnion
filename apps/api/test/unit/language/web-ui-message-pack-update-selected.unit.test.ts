/**
 * HU-LOC-BRAND-01E — update explicit published WEB_UI keys from the packaged catalog.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { normalizeLanguageRegistryLocaleKey, type WebUiMessageTree } from "@hu/types";

import { AdministrationUnauthorizedError } from "../../../src/modules/administration/administration.errors.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  resolveLanguageRegistryLocale,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import { selectedTranslationProtectionError } from "../../../src/modules/web-ui-message-packs/plan-selected-packaged-web-ui-updates.js";
import {
  loadPackagedWebUiCatalog,
  resetPackagedWebUiCatalogIndexForTests,
  setPackagedWebUiCatalogsDirForTests,
} from "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import {
  WebUiMessagePackRevisionConflictError,
  WebUiMessagePackValidationError,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.errors.js";
import { upsertWebUiMessagePackMemory } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.memory.store.js";
import {
  compareAndSetWebUiMessagePack,
  getPublishedWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  applyAdminAddMissingWebUiFromPackaged,
  applyAdminUpdateSelectedWebUiFromPackaged,
  previewAdminUpdateSelectedWebUiFromPackaged,
  setWebUiMessagePackAdminAssertOverrideForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.service.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCALE = "zz-SelUpd";

const PACKAGED: WebUiMessageTree = {
  common: { save: "Save", cancel: "Cancel" },
  auth: {
    loginSubtitle: "Access your {siteName} workspace.",
    registerSubtitle: "Create your {siteName} Participant account.",
  },
  regionalProgramPublic: {
    principles: {
      legal: "Humanity Union Society remains the legal entity of {siteName}.",
    },
  },
  legalPublic: {
    privacy: { title: "Revised policy title" },
  },
  rrpApplication: {
    admin: {
      fields: { consentAccepted: "Accepted on {at}" },
    },
  },
};

function readLeaf(tree: unknown, dotted: string): string | undefined {
  let current = tree;
  for (const segment of dotted.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

function writePackagedFixture(tree: WebUiMessageTree): string {
  const dir = mkdtempSync(path.join(tmpdir(), "hu-selected-web-ui-"));
  writeFileSync(path.join(dir, `${LOCALE}.json`), JSON.stringify(tree), "utf8");
  return dir;
}

async function seedPack(messages: WebUiMessageTree): Promise<void> {
  await upsertWebUiMessagePack({
    locale: LOCALE,
    status: "published",
    messages,
    sourceNote: "seed",
  });
}

describe("WEB_UI update selected translations", () => {
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
      enabled: false,
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
      participantId: "participant-admin-selected",
    }));
  });

  afterEach(() => {
    setWebUiMessagePackAdminAssertOverrideForTests(null);
    setPackagedWebUiCatalogsDirForTests(null);
    resetPackagedWebUiCatalogIndexForTests();
  });

  it("preview is read-only and shows the selected replacement", async () => {
    await seedPack({
      common: { save: "KEEP" },
      auth: { loginSubtitle: "old {siteName}" },
    });
    const preview = await previewAdminUpdateSelectedWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { paths: ["auth.loginSubtitle"] },
    });
    assert.equal(preview.locale, LOCALE);
    assert.equal(preview.currentRevision, 1);
    assert.equal(preview.packStatus, "published");
    assert.equal(preview.selectedKeyCount, 1);
    assert.equal(preview.validationErrors.length, 0);
    assert.equal(preview.entries[0]?.existingValue, "old {siteName}");
    assert.equal(preview.entries[0]?.proposedValue, "Access your {siteName} workspace.");
    assert.deepEqual(preview.entries[0]?.errors, []);
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
    assert.equal(readLeaf(stored?.messages, "auth.loginSubtitle"), "old {siteName}");
    assert.equal(readLeaf(stored?.messages, "common.save"), "KEEP");
  });

  it("updates only the selected key and keeps published status", async () => {
    await seedPack({
      common: { save: "KEEP" },
      auth: { loginSubtitle: "old {siteName}", registerSubtitle: "old register {siteName}" },
    });
    const result = await applyAdminUpdateSelectedWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: {
        expectedRevision: 1,
        updates: [
          {
            path: "auth.loginSubtitle",
            existingValue: "old {siteName}",
            proposedValue: "Access your {siteName} workspace.",
          },
        ],
      },
    });
    assert.equal(result.updatedKeyCount, 1);
    assert.equal(result.pack.status, "published");
    assert.equal(result.pack.revision, 2);
    assert.equal(result.pack.sourceNote, "seed");
    assert.equal(readLeaf(result.pack.messages, "auth.loginSubtitle"), "Access your {siteName} workspace.");
    assert.equal(readLeaf(result.pack.messages, "auth.registerSubtitle"), "old register {siteName}");
    assert.equal(readLeaf(result.pack.messages, "common.save"), "KEEP");
  });

  it("rejects invalid placeholders, unknown keys, duplicates, and missing values without writing", async () => {
    await seedPack({
      common: { save: "KEEP" },
      auth: { loginSubtitle: "old {siteName}" },
    });
    const broken = structuredClone(PACKAGED) as {
      auth: { loginSubtitle: string };
    };
    broken.auth.loginSubtitle = "broken";
    setPackagedWebUiCatalogsDirForTests(writePackagedFixture(broken as WebUiMessageTree));
    resetPackagedWebUiCatalogIndexForTests();

    const placeholder = await previewAdminUpdateSelectedWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { paths: ["auth.loginSubtitle"] },
    });
    assert.match(placeholder.entries[0]?.errors.join(" ") ?? "", /Invalid placeholder set/);

    const unknown = await previewAdminUpdateSelectedWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { paths: ["not.a.real.key"] },
    });
    assert.match(unknown.entries[0]?.errors.join(" ") ?? "", /Unknown key path/);

    const duplicate = await previewAdminUpdateSelectedWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { paths: ["common.save", "common.save"] },
    });
    assert.match(duplicate.validationErrors.join(" "), /Duplicate selected path: common.save/);

    const missing = await previewAdminUpdateSelectedWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { paths: ["common.cancel"] },
    });
    assert.match(missing.entries[0]?.errors.join(" ") ?? "", /Missing selected published value/);

    await assert.rejects(
      () =>
        applyAdminUpdateSelectedWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: {
            expectedRevision: 1,
            updates: [
              {
                path: "auth.loginSubtitle",
                existingValue: "old {siteName}",
                proposedValue: "broken",
              },
            ],
          },
        }),
      (error: unknown) => error instanceof WebUiMessagePackValidationError,
    );
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
    assert.equal(readLeaf(stored?.messages, "auth.loginSubtitle"), "old {siteName}");
    assert.equal(readLeaf(stored?.messages, "common.save"), "KEEP");
  });

  it("rejects a stale revision and a full-catalog body without writing", async () => {
    await seedPack({
      common: { save: "KEEP" },
      auth: { loginSubtitle: "old {siteName}" },
    });
    await assert.rejects(
      () =>
        applyAdminUpdateSelectedWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: {
            expectedRevision: 99,
            updates: [
              {
                path: "auth.loginSubtitle",
                existingValue: "old {siteName}",
                proposedValue: "Access your {siteName} workspace.",
              },
            ],
          },
        }),
      (error: unknown) => error instanceof WebUiMessagePackRevisionConflictError,
    );
    await assert.rejects(
      () =>
        applyAdminUpdateSelectedWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: {
            expectedRevision: 1,
            messages: { common: { save: "CHANGED" } },
            updates: [
              {
                path: "auth.loginSubtitle",
                existingValue: "old {siteName}",
                proposedValue: "Access your {siteName} workspace.",
              },
            ],
          },
        }),
      (error: unknown) => /Full catalog replacement/.test((error as Error).message),
    );
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
    assert.equal(readLeaf(stored?.messages, "common.save"), "KEEP");
  });

  it("applies every selected key or none", async () => {
    await seedPack({
      common: { save: "KEEP" },
      auth: {
        loginSubtitle: "old {siteName}",
        registerSubtitle: "old register {siteName}",
      },
    });
    const broken = structuredClone(PACKAGED) as {
      auth: { loginSubtitle: string; registerSubtitle: string };
    };
    broken.auth.loginSubtitle = "broken";
    setPackagedWebUiCatalogsDirForTests(writePackagedFixture(broken as WebUiMessageTree));
    resetPackagedWebUiCatalogIndexForTests();
    await assert.rejects(
      () =>
        applyAdminUpdateSelectedWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: {
            expectedRevision: 1,
            updates: [
              {
                path: "auth.registerSubtitle",
                existingValue: "old register {siteName}",
                proposedValue: "Create your {siteName} Participant account.",
              },
              {
                path: "auth.loginSubtitle",
                existingValue: "old {siteName}",
                proposedValue: "broken",
              },
            ],
          },
        }),
      (error: unknown) => error instanceof WebUiMessagePackValidationError,
    );
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
    assert.equal(readLeaf(stored?.messages, "auth.registerSubtitle"), "old register {siteName}");
    assert.equal(readLeaf(stored?.messages, "auth.loginSubtitle"), "old {siteName}");
  });

  it("rejects other-key changes, legal name, consent, and privacy text", async () => {
    const localeKey = normalizeLanguageRegistryLocaleKey(LOCALE);
    upsertWebUiMessagePackMemory(
      {
        packId: `pack-${LOCALE}`,
        locale: LOCALE,
        revision: 1,
        status: "published",
        messages: {
          common: { save: "KEEP" },
          auth: { loginSubtitle: "old {siteName}" },
          regionalProgramPublic: {
            principles: { legal: "Humanity Union Society founded {siteName}." },
          },
          legalPublic: { privacy: { title: "Privacy Policy" } },
          rrpApplication: {
            admin: { fields: { consentAccepted: "Accepted on {at} version {version}" } },
          },
        },
        createdAt: "2026-11-23T00:00:00.000Z",
        updatedAt: "2026-11-23T00:00:00.000Z",
        updatedByParticipantId: null,
        sourceNote: "seed",
      },
      localeKey,
    );

    const published = await getPublishedWebUiMessagePackByLocale(LOCALE);
    for (const pathKey of [
      "regionalProgramPublic.principles.legal",
      "legalPublic.privacy.title",
      "rrpApplication.admin.fields.consentAccepted",
    ]) {
      const existingValue = readLeaf(published?.messages, pathKey);
      const proposedValue = readLeaf(PACKAGED, pathKey);
      assert.equal(typeof existingValue, "string");
      assert.equal(typeof proposedValue, "string");
      await assert.rejects(
        () =>
          applyAdminUpdateSelectedWebUiFromPackaged({
            actorUserId: "admin-1",
            locale: LOCALE,
            body: {
              expectedRevision: 1,
              updates: [{ path: pathKey, existingValue, proposedValue }],
            },
          }),
        (error: unknown) => error instanceof WebUiMessagePackValidationError,
      );
    }

    await assert.rejects(
      () =>
        compareAndSetWebUiMessagePack({
          locale: LOCALE,
          expectedRevision: 1,
          status: "published",
          allowedChangedPaths: ["common.save"],
          messages: {
            common: { save: "Save" },
            auth: { loginSubtitle: "changed {siteName}" },
          },
        }),
      (error: unknown) =>
        error instanceof WebUiMessagePackValidationError &&
        /cannot modify other keys/.test(error.message),
    );

    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 1);
    assert.equal(
      readLeaf(stored?.messages, "rrpApplication.admin.fields.consentAccepted"),
      "Accepted on {at} version {version}",
    );
    assert.match(readLeaf(stored?.messages, "regionalProgramPublic.principles.legal") ?? "", /Humanity Union Society/);
    assert.equal(readLeaf(stored?.messages, "legalPublic.privacy.title"), "Privacy Policy");
    assert.equal(readLeaf(stored?.messages, "common.save"), "KEEP");
    assert.match(
      selectedTranslationProtectionError("videoChat.room.title", "Stay", "Leave") ?? "",
      /Video Chat/,
    );
  });

  it("keeps full-catalog validation and Add missing preservation", async () => {
    await seedPack({
      common: { save: "KEEP" },
      auth: { loginSubtitle: "old {siteName}" },
    });
    await assert.rejects(
      () =>
        compareAndSetWebUiMessagePack({
          locale: LOCALE,
          expectedRevision: 1,
          status: "published",
          messages: { auth: { loginSubtitle: "broken" } },
        }),
      (error: unknown) => error instanceof WebUiMessagePackValidationError,
    );
    const added = await applyAdminAddMissingWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { expectedRevision: 1 },
    });
    assert.equal(added.changed, true);
    assert.equal(readLeaf(added.pack.messages, "common.save"), "KEEP");
    assert.equal(readLeaf(added.pack.messages, "common.cancel"), "Cancel");
    assert.equal(readLeaf(added.pack.messages, "auth.loginSubtitle"), "old {siteName}");
    const service = readFileSync(
      path.join(here, "../../../src/modules/web-ui-message-packs/web-ui-message-pack.service.ts"),
      "utf8",
    );
    assert.match(service, /Preserves every existing leaf/);
    const planner = readFileSync(
      path.join(here, "../../../src/modules/web-ui-message-packs/plan-selected-packaged-web-ui-updates.ts"),
      "utf8",
    );
    assert.doesNotMatch(planner, /gemini|TranslationProvider|generateTranslation/);
  });

  it("requires an administrator and does not run for an anonymous actor", async () => {
    setWebUiMessagePackAdminAssertOverrideForTests(null);
    await assert.rejects(
      () =>
        previewAdminUpdateSelectedWebUiFromPackaged({
          actorUserId: "",
          locale: LOCALE,
          body: { paths: ["auth.loginSubtitle"] },
        }),
      (error: unknown) => error instanceof AdministrationUnauthorizedError,
    );
  });

  it("preview and apply accept an escaped French apostrophe and reject the quoted placeholder", async () => {
    await seedPack({
      auth: { loginSubtitle: "ancien {siteName}" },
    });
    const escaped = structuredClone(PACKAGED) as { auth: { loginSubtitle: string } };
    escaped.auth.loginSubtitle = "Accès à l''{siteName}.";
    setPackagedWebUiCatalogsDirForTests(writePackagedFixture(escaped as WebUiMessageTree));
    resetPackagedWebUiCatalogIndexForTests();
    const preview = await previewAdminUpdateSelectedWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { paths: ["auth.loginSubtitle"] },
    });
    assert.deepEqual(preview.entries[0]?.errors, []);
    assert.equal(preview.entries[0]?.proposedValue, "Accès à l''{siteName}.");
    const applied = await applyAdminUpdateSelectedWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: {
        expectedRevision: preview.currentRevision,
        updates: [
          {
            path: "auth.loginSubtitle",
            existingValue: "ancien {siteName}",
            proposedValue: "Accès à l''{siteName}.",
          },
        ],
      },
    });
    assert.equal(readLeaf(applied.pack.messages, "auth.loginSubtitle"), "Accès à l''{siteName}.");

    const quoted = structuredClone(PACKAGED) as { auth: { loginSubtitle: string } };
    quoted.auth.loginSubtitle = "Accès à l'{siteName}.";
    setPackagedWebUiCatalogsDirForTests(writePackagedFixture(quoted as WebUiMessageTree));
    resetPackagedWebUiCatalogIndexForTests();
    const rejected = await previewAdminUpdateSelectedWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { paths: ["auth.loginSubtitle"] },
    });
    assert.match(rejected.entries[0]?.errors.join(" ") ?? "", /missing \{siteName\}/);
    await assert.rejects(
      () =>
        applyAdminUpdateSelectedWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: {
            expectedRevision: rejected.currentRevision,
            updates: [
              {
                path: "auth.loginSubtitle",
                existingValue: "Accès à l''{siteName}.",
                proposedValue: "Accès à l'{siteName}.",
              },
            ],
          },
        }),
      (error: unknown) => error instanceof WebUiMessagePackValidationError,
    );
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(readLeaf(stored?.messages, "auth.loginSubtitle"), "Accès à l''{siteName}.");
  });

  it("updates one packaged value for every published non-English language", async () => {
    setPackagedWebUiCatalogsDirForTests(null);
    resetPackagedWebUiCatalogIndexForTests();
    const locales = ["ar", "de", "es", "fr", "he", "ka", "pt", "uk", "zh-Hant"] as const;
    for (const locale of locales) {
      if (!(await resolveLanguageRegistryLocale(locale))) {
        await createLanguageRegistryRecord({
          locale,
          englishName: locale,
          nativeName: locale,
          textDirection: locale === "ar" || locale === "he" ? "rtl" : "ltr",
          fallbackLocale: "en",
          enabled: false,
          contentTranslationEnabled: false,
          searchEnabled: false,
          seoIndexingEnabled: false,
          pwaPersistedReadingEnabled: false,
          uiTranslationStatus: "none",
        });
      }
      const before = await resolveLanguageRegistryLocale(locale);
      assert.ok(before);
      const packaged = loadPackagedWebUiCatalog(locale);
      const proposed = readLeaf(packaged, "auth.loginSubtitle");
      assert.match(proposed ?? "", /\{siteName\}/);
      await upsertWebUiMessagePack({
        locale,
        status: "published",
        messages: {
          common: { save: "KEEP" },
          auth: { loginSubtitle: "old {siteName}" },
        },
      });
      const preview = await previewAdminUpdateSelectedWebUiFromPackaged({
        actorUserId: "admin-1",
        locale,
        body: { paths: ["auth.loginSubtitle"] },
      });
      assert.equal(preview.entries[0]?.proposedValue, proposed);
      assert.deepEqual(preview.entries[0]?.errors, []);
      const revision = preview.currentRevision;
      assert.equal(typeof revision, "number");
      const result = await applyAdminUpdateSelectedWebUiFromPackaged({
        actorUserId: "admin-1",
        locale,
        body: {
          expectedRevision: revision,
          updates: [
            {
              path: "auth.loginSubtitle",
              existingValue: "old {siteName}",
              proposedValue: proposed,
            },
          ],
        },
      });
      assert.equal(result.pack.status, "published");
      assert.equal(result.pack.revision, (revision as number) + 1);
      assert.equal(readLeaf(result.pack.messages, "auth.loginSubtitle"), proposed);
      assert.equal(readLeaf(result.pack.messages, "common.save"), "KEEP");
      const after = await resolveLanguageRegistryLocale(locale);
      assert.equal(after?.textDirection, before.textDirection);
      assert.equal(after?.enabled, before.enabled);
      assert.equal(after?.textDirection, locale === "ar" || locale === "he" ? "rtl" : "ltr");
    }
  });
});
