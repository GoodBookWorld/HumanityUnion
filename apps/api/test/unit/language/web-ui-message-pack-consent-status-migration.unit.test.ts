/**
 * Temporary migration for rrpApplication.admin.fields.consentAccepted.
 * Delete this test with the migration after every affected published locale
 * has been repaired.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { normalizeLanguageRegistryLocaleKey, type WebUiMessageTree } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../../../src/modules/administration/administration.errors.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import { selectedTranslationProtectionError } from "../../../src/modules/web-ui-message-packs/plan-selected-packaged-web-ui-updates.js";
import {
  resetPackagedWebUiCatalogIndexForTests,
  setPackagedWebUiCatalogsDirForTests,
} from "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import {
  ADMIN_CONSENT_ACCEPTED_STATUS_PATH,
  assessConsentAcceptedStatusMigrationReadiness,
  decideConsentAcceptedStatusMigration,
  replaceConsentAcceptedStatusLeaf,
} from "../../../src/modules/web-ui-message-packs/repair-admin-consent-accepted-status.js";
import {
  WebUiMessagePackRevisionConflictError,
  WebUiMessagePackValidationError,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.errors.js";
import { upsertWebUiMessagePackMemory } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.memory.store.js";
import {
  getPublishedWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  applyAdminAddMissingWebUiFromPackaged,
  applyAdminConsentAcceptedStatusMigration,
  applyAdminUpdateSelectedWebUiFromPackaged,
  previewAdminConsentAcceptedStatusMigration,
  setWebUiMessagePackAdminAssertOverrideForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.service.js";
import {
  describeStructureMismatch,
  resetEnglishWebUiPathCacheForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCALE = "zz-ConsentMig";
const PATH = ADMIN_CONSENT_ACCEPTED_STATUS_PATH;
const ENGLISH = "Accepted on {at}";
const PACKAGED_VALUE = "Прийнято {at}";
const PUBLISHED_VALUE = "Прийнято ({version}) {at}";
const AFFECTED_LOCALES = ["ar", "de", "es", "fr", "he", "ka", "pt", "uk", "zh-Hant"] as const;
const CATALOG_DIR = path.resolve(here, "../../../assets/packaged-web-ui-catalogs");

const PACKAGED: WebUiMessageTree = {
  common: { save: "Зберегти" },
  rrpApplication: {
    admin: { fields: { consentAccepted: PACKAGED_VALUE } },
    consent: {
      label: "PACKAGED LEGAL MUST NOT BE COPIED",
      versionNote: "PACKAGED NOTE MUST NOT BE COPIED",
    },
  },
  legalPublic: { privacy: { title: "PACKAGED PRIVACY MUST NOT BE COPIED" } },
  regionalProgramPublic: {
    principles: { legal: "PACKAGED NAME MUST NOT BE COPIED" },
    presence: { notice: "PACKAGED NOTICE MUST NOT BE COPIED" },
  },
};

const PUBLISHED: WebUiMessageTree = {
  common: { save: "Зберегти" },
  rrpApplication: {
    admin: { fields: { consentAccepted: PUBLISHED_VALUE } },
    consent: {
      label: "Згода {siteName} <privacy>політика</privacy>.",
      versionNote: "Версія згоди: {version}",
    },
  },
  legalPublic: { privacy: { title: "Опублікована політика залишається" } },
  regionalProgramPublic: {
    principles: { legal: "Humanity Union Society є основою {siteName}." },
    presence: { notice: "Опубліковане повідомлення залишається" },
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

function writePackagedFixture(tree: WebUiMessageTree): void {
  const dir = mkdtempSync(path.join(tmpdir(), "hu-consent-status-"));
  writeFileSync(path.join(dir, `${LOCALE}.json`), JSON.stringify(tree), "utf8");
  setPackagedWebUiCatalogsDirForTests(dir);
  resetPackagedWebUiCatalogIndexForTests();
  resetEnglishWebUiPathCacheForTests();
}

function seedPublished(messages: WebUiMessageTree, revision = 1): void {
  const localeKey = normalizeLanguageRegistryLocaleKey(LOCALE);
  upsertWebUiMessagePackMemory(
    {
      packId: `pack-${LOCALE}`,
      locale: LOCALE,
      revision,
      status: "published",
      messages,
      createdAt: "2026-11-25T00:00:00.000Z",
      updatedAt: "2026-11-25T00:00:00.000Z",
      updatedByParticipantId: null,
      sourceNote: "seed",
    },
    localeKey,
  );
}

function applyBody(existingValue: string, expectedRevision = 1): Record<string, unknown> {
  return { confirm: true, expectedRevision, existingValue };
}

async function storedSnapshot(): Promise<string> {
  return JSON.stringify(await getPublishedWebUiMessagePackByLocale(LOCALE));
}

describe("temporary admin consent status migration", () => {
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
    writePackagedFixture(PACKAGED);
    setWebUiMessagePackAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin",
    }));
    seedPublished(PUBLISHED);
  });

  afterEach(() => {
    setWebUiMessagePackAdminAssertOverrideForTests(null);
    setPackagedWebUiCatalogsDirForTests(null);
    resetPackagedWebUiCatalogIndexForTests();
    resetEnglishWebUiPathCacheForTests();
    resetWebUiMessagePackStoreForTests();
    setWebUiMessagePackForceMemoryForTests(false);
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("repairs one approved path and preserves every other published leaf", async () => {
    const preview = await previewAdminConsentAcceptedStatusMigration({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { expectedRevision: 1, existingValue: PUBLISHED_VALUE },
    });
    assert.equal(preview.action, "repair");
    assert.equal(preview.proposedValue, PACKAGED_VALUE);
    assert.equal(preview.path, PATH);
    assert.equal((await getPublishedWebUiMessagePackByLocale(LOCALE))?.revision, 1);
    assert.equal(preview.readiness.participant.structuralInvalidCount, 0);
    assert.equal(preview.readiness.full.structuralInvalidCount, 0);

    const result = await applyAdminConsentAcceptedStatusMigration({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: applyBody(PUBLISHED_VALUE),
    });
    assert.equal(result.changed, true);
    assert.deepEqual(result.changedPaths, [PATH]);
    assert.equal(result.revision, 2);
    assert.equal(readLeaf(result.pack.messages, PATH), PACKAGED_VALUE);
    assert.equal(result.pack.sourceNote, "seed");
    assert.equal(
      readLeaf(result.pack.messages, "rrpApplication.consent.label"),
      "Згода {siteName} <privacy>політика</privacy>.",
    );
    assert.equal(
      readLeaf(result.pack.messages, "rrpApplication.consent.versionNote"),
      "Версія згоди: {version}",
    );
    assert.equal(
      readLeaf(result.pack.messages, "legalPublic.privacy.title"),
      "Опублікована політика залишається",
    );
    assert.equal(
      readLeaf(result.pack.messages, "regionalProgramPublic.principles.legal"),
      "Humanity Union Society є основою {siteName}.",
    );
    assert.equal(
      readLeaf(result.pack.messages, "regionalProgramPublic.presence.notice"),
      "Опубліковане повідомлення залишається",
    );
    assert.equal(readLeaf(result.pack.messages, "common.save"), "Зберегти");
    assert.equal(result.readiness.participant.structuralInvalidCount, 0);
    assert.equal(result.readiness.full.structuralInvalidCount, 0);

    const repeated = await applyAdminConsentAcceptedStatusMigration({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: applyBody(PACKAGED_VALUE, 2),
    });
    assert.equal(repeated.changed, false);
    assert.equal(repeated.revision, 2);
    assert.deepEqual(repeated.changedPaths, []);
  });

  it("keeps the ordinary selected-update lock and add-missing preservation", async () => {
    assert.equal(
      selectedTranslationProtectionError(PATH, PUBLISHED_VALUE, PACKAGED_VALUE, ENGLISH),
      "RRP consent string cannot be changed.",
    );
    const before = await storedSnapshot();
    await assert.rejects(
      () =>
        applyAdminUpdateSelectedWebUiFromPackaged({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: {
            expectedRevision: 1,
            updates: [{ path: PATH, existingValue: PUBLISHED_VALUE, proposedValue: PACKAGED_VALUE }],
          },
        }),
      (error: unknown) =>
        error instanceof WebUiMessagePackValidationError &&
        error.message.includes("RRP consent string cannot be changed."),
    );
    assert.equal(await storedSnapshot(), before);

    const added = await applyAdminAddMissingWebUiFromPackaged({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: { expectedRevision: 1 },
    });
    assert.equal(added.changed, false);
    assert.equal(readLeaf(added.pack?.messages, PATH), PUBLISHED_VALUE);
    assert.equal((await getPublishedWebUiMessagePackByLocale(LOCALE))?.revision, 1);
  });

  it("rejects stale revisions, mismatched values, and ineligible defects without writing", async () => {
    const before = await storedSnapshot();
    await assert.rejects(
      () =>
        applyAdminConsentAcceptedStatusMigration({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: applyBody(PUBLISHED_VALUE, 12),
        }),
      (error: unknown) => error instanceof WebUiMessagePackRevisionConflictError,
    );
    assert.equal(await storedSnapshot(), before);

    await assert.rejects(
      () =>
        applyAdminConsentAcceptedStatusMigration({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: applyBody("Прийнято {at}"),
        }),
      (error: unknown) =>
        error instanceof WebUiMessagePackValidationError &&
        error.message.includes("existingValue does not match"),
    );
    assert.equal(await storedSnapshot(), before);

    seedPublished({
      ...PUBLISHED,
      rrpApplication: {
        admin: { fields: { consentAccepted: "Прийнято" } },
        consent: {
          label: "Згода {siteName} <privacy>політика</privacy>.",
          versionNote: "Версія згоди: {version}",
        },
      },
    });
    const missingAt = await storedSnapshot();
    await assert.rejects(
      () =>
        applyAdminConsentAcceptedStatusMigration({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: applyBody("Прийнято"),
        }),
      (error: unknown) =>
        error instanceof WebUiMessagePackValidationError &&
        error.message.includes("cannot be changed"),
    );
    assert.equal(await storedSnapshot(), missingAt);
  });

  it("does not write when the published value is already structurally valid", async () => {
    seedPublished({
      ...PUBLISHED,
      rrpApplication: {
        admin: { fields: { consentAccepted: "Прийнято о {at}" } },
        consent: {
          label: "Згода {siteName} <privacy>політика</privacy>.",
          versionNote: "Версія згоди: {version}",
        },
      },
    });
    const before = await storedSnapshot();
    const result = await applyAdminConsentAcceptedStatusMigration({
      actorUserId: "admin-1",
      locale: LOCALE,
      body: applyBody("Прийнято о {at}"),
    });
    assert.equal(result.changed, false);
    assert.equal(result.revision, 1);
    assert.equal(await storedSnapshot(), before);
  });

  it("rejects a packaged value that still contains an unexpected placeholder", async () => {
    writePackagedFixture({
      ...PACKAGED,
      rrpApplication: {
        admin: { fields: { consentAccepted: "Прийнято {version} {at}" } },
        consent: {
          label: "PACKAGED LEGAL MUST NOT BE COPIED",
          versionNote: "PACKAGED NOTE MUST NOT BE COPIED",
        },
      },
    });
    const before = await storedSnapshot();
    await assert.rejects(
      () =>
        applyAdminConsentAcceptedStatusMigration({
          actorUserId: "admin-1",
          locale: LOCALE,
          body: applyBody(PUBLISHED_VALUE),
        }),
      (error: unknown) =>
        error instanceof WebUiMessagePackValidationError &&
        error.message.includes("unexpected {version}"),
    );
    assert.equal(await storedSnapshot(), before);
  });

  it("rejects unauthorized and malformed requests before any write", async () => {
    const before = await storedSnapshot();
    setWebUiMessagePackAdminAssertOverrideForTests(async () => {
      throw new AdministrationUnauthorizedError();
    });
    await assert.rejects(
      () =>
        applyAdminConsentAcceptedStatusMigration({
          actorUserId: "",
          locale: LOCALE,
          body: applyBody(PUBLISHED_VALUE),
        }),
      (error: unknown) => error instanceof AdministrationUnauthorizedError,
    );
    setWebUiMessagePackAdminAssertOverrideForTests(async () => {
      throw new AdministrationForbiddenError("Administrator access is required.");
    });
    await assert.rejects(
      () =>
        previewAdminConsentAcceptedStatusMigration({
          actorUserId: "member-1",
          locale: LOCALE,
          body: { expectedRevision: 1, existingValue: PUBLISHED_VALUE },
        }),
      (error: unknown) => error instanceof AdministrationForbiddenError,
    );

    setWebUiMessagePackAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin",
    }));
    const malformed: unknown[] = [
      null,
      [],
      { expectedRevision: 1, existingValue: PUBLISHED_VALUE },
      { confirm: "true", expectedRevision: 1, existingValue: PUBLISHED_VALUE },
      { confirm: true, existingValue: PUBLISHED_VALUE },
      { confirm: true, expectedRevision: null, existingValue: PUBLISHED_VALUE },
      { confirm: true, expectedRevision: "12", existingValue: PUBLISHED_VALUE },
      { confirm: true, expectedRevision: 1, existingValue: 12 },
      {
        confirm: true,
        expectedRevision: 1,
        existingValue: PUBLISHED_VALUE,
        proposedValue: PACKAGED_VALUE,
      },
      {
        confirm: true,
        expectedRevision: 1,
        existingValue: PUBLISHED_VALUE,
        path: PATH,
      },
      {
        confirm: true,
        expectedRevision: 1,
        existingValue: PUBLISHED_VALUE,
        updates: [{ path: PATH }],
      },
    ];
    for (const body of malformed) {
      await assert.rejects(
        () =>
          applyAdminConsentAcceptedStatusMigration({
            actorUserId: "admin-1",
            locale: LOCALE,
            body,
          }),
        (error: unknown) => error instanceof AdministrationValidationError,
      );
    }
    assert.equal(await storedSnapshot(), before);
  });

  it("lets only one concurrent request publish the same revision", async () => {
    const results = await Promise.allSettled([
      applyAdminConsentAcceptedStatusMigration({
        actorUserId: "admin-1",
        locale: LOCALE,
        body: applyBody(PUBLISHED_VALUE),
      }),
      applyAdminConsentAcceptedStatusMigration({
        actorUserId: "admin-2",
        locale: LOCALE,
        body: applyBody(PUBLISHED_VALUE),
      }),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(
      rejected[0]?.status === "rejected" &&
        rejected[0].reason instanceof WebUiMessagePackRevisionConflictError,
      true,
    );
    const stored = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(stored?.revision, 2);
    assert.equal(readLeaf(stored?.messages, PATH), PACKAGED_VALUE);
    assert.equal(
      readLeaf(stored?.messages, "rrpApplication.consent.label"),
      "Згода {siteName} <privacy>політика</privacy>.",
    );
  });
});

describe("consent status migration fixtures", () => {
  afterEach(() => {
    setPackagedWebUiCatalogsDirForTests(null);
    resetPackagedWebUiCatalogIndexForTests();
    resetEnglishWebUiPathCacheForTests();
  });

  it("uses one predicate for every affected packaged locale", () => {
    const source = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/web-ui-message-packs/repair-admin-consent-accepted-status.ts",
      ),
      "utf8",
    );
    assert.match(source, /Delete this module/);
    assert.match(source, /selectedTranslationProtectionError/);
    assert.match(source, /generic protected-key editor/);
    for (const locale of AFFECTED_LOCALES) {
      assert.equal(source.includes(`"${locale}"`), false);
      assert.equal(source.includes(`'${locale}'`), false);
    }

    const route = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/web-ui-message-packs/admin-web-ui-message-pack.routes.ts",
      ),
      "utf8",
    );
    assert.match(route, /repair-admin-consent-accepted-status\/preview/);
    assert.match(
      route,
      /authenticationMiddleware,\n {2}requireAuthenticationMiddleware,\n {2}async \(req, res\) => \{\n {4}try \{\n {6}const result = await previewAdminConsentAcceptedStatusMigration/,
    );
    assert.match(
      route,
      /authenticationMiddleware,\n {2}requireAuthenticationMiddleware,\n {2}async \(req, res\) => \{\n {4}try \{\n {6}const result = await applyAdminConsentAcceptedStatusMigration/,
    );

    for (const locale of AFFECTED_LOCALES) {
      const catalog = JSON.parse(
        readFileSync(path.join(CATALOG_DIR, `${locale}.json`), "utf8"),
      ) as WebUiMessageTree;
      const packagedValue = readLeaf(catalog, PATH);
      assert.equal(typeof packagedValue, "string");
      assert.equal(describeStructureMismatch(ENGLISH, packagedValue ?? ""), null);
      assert.equal(packagedValue?.includes("{at}"), true);
      assert.equal(packagedValue?.includes("{version}"), false);
      const publishedValue = packagedValue?.replace("{at}", "({version}) {at}") ?? "";
      const decision = decideConsentAcceptedStatusMigration({
        englishValue: ENGLISH,
        publishedValue,
        packagedValue: packagedValue ?? "",
      });
      assert.equal(decision.action, "repair");
      if (decision.action === "repair") {
        assert.equal(decision.proposedValue, packagedValue);
      }
      const repaired = replaceConsentAcceptedStatusLeaf(catalog, packagedValue ?? "");
      assert.equal(readLeaf(repaired, PATH), packagedValue);
      assert.equal(readLeaf(repaired, "rrpApplication.consent.label"), readLeaf(catalog, "rrpApplication.consent.label"));
      assert.equal(
        readLeaf(repaired, "rrpApplication.consent.versionNote"),
        readLeaf(catalog, "rrpApplication.consent.versionNote"),
      );
    }
  });

  it("includes structural validation in the real readiness calculation", { timeout: 120_000 }, () => {
    setPackagedWebUiCatalogsDirForTests(null);
    resetPackagedWebUiCatalogIndexForTests();
    resetEnglishWebUiPathCacheForTests();

    for (const locale of AFFECTED_LOCALES) {
      const catalog = JSON.parse(
        readFileSync(path.join(CATALOG_DIR, `${locale}.json`), "utf8"),
      ) as WebUiMessageTree;
      const packagedValue = readLeaf(catalog, PATH) ?? "";
      const defective = replaceConsentAcceptedStatusLeaf(
        catalog,
        packagedValue.replace("{at}", "({version}) {at}"),
      );
      const before = assessConsentAcceptedStatusMigrationReadiness(defective);
      const after = assessConsentAcceptedStatusMigrationReadiness(catalog);
      assert.equal(before.public.structuralInvalidCount, after.public.structuralInvalidCount);
      assert.equal(before.participant.structuralInvalidCount, after.participant.structuralInvalidCount + 1);
      assert.equal(before.full.structuralInvalidCount, after.full.structuralInvalidCount + 1);
      assert.equal(before.participant.missingKeyCount, after.participant.missingKeyCount);
      assert.equal(before.full.emptyKeyCount, after.full.emptyKeyCount);
    }

    const ukrainian = JSON.parse(
      readFileSync(path.join(CATALOG_DIR, "uk.json"), "utf8"),
    ) as WebUiMessageTree;
    const ready = assessConsentAcceptedStatusMigrationReadiness(ukrainian);
    for (const slice of [ready.public, ready.participant, ready.full]) {
      assert.equal(slice.dataReady, true);
      assert.equal(slice.missingKeyCount, 0);
      assert.equal(slice.emptyKeyCount, 0);
      assert.equal(slice.structuralInvalidCount, 0);
    }
    const ukrainianDefect = replaceConsentAcceptedStatusLeaf(
      ukrainian,
      "Прийнято ({version}) {at}",
    );
    const blocked = assessConsentAcceptedStatusMigrationReadiness(ukrainianDefect);
    assert.equal(blocked.public.dataReady, true);
    assert.equal(blocked.public.structuralInvalidCount, 0);
    assert.equal(blocked.participant.dataReady, false);
    assert.equal(blocked.participant.structuralInvalidCount, 1);
    assert.equal(blocked.participant.missingKeyCount, 0);
    assert.equal(blocked.participant.emptyKeyCount, 0);
    assert.equal(blocked.full.dataReady, false);
    assert.equal(blocked.full.structuralInvalidCount, 1);
    assert.equal(blocked.full.missingKeyCount, 0);
    assert.equal(blocked.full.emptyKeyCount, 0);
  });
});
