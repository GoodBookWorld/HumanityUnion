/**
 * Stage A — civic_media recovery follows the active trusted explanation set.
 * No provider calls, no activation, no locale-specific repair.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import { TRUSTED_MEDIA_RESOURCES } from "../../../src/modules/civic-media-center/content/trusted-media.js";
import {
  discoverCivicMediaTranslationRecordIds,
  loadCivicMediaTranslationSource,
} from "../../../src/modules/language/content-translation-civic-loaders.js";
import { CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS } from "../../../src/modules/language/content-translation-staging-warm-operator-scope.js";
import {
  listContentTranslationWarmMemoryPendingForTests,
  markContentTranslationWarmMemoryPublishedForTests,
  resetContentTranslationWarmMemoryForTests,
  setContentTranslationWarmForceMemoryForTests,
} from "../../../src/modules/language/content-translation-warm-enqueue.js";
import {
  trustedMediaTranslationInputChanged,
} from "../../../src/modules/language/civic-media-translation-recovery.js";
import {
  resetLocalizationReconciliationDriverForTests,
  setLocalizationReconciliationDriverDepsForTests,
} from "../../../src/modules/language/localization-reconciliation-driver.js";
import {
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/language-registry/language-registry.repository.js";
import { selectCurrentlyRetryEligibleResiduals } from "../../../src/modules/language/public-localization-residual-retry.js";
import type { PublicLocalizationResidualWithPreflight } from "../../../src/modules/language/public-localization-retry-preflight.js";
import { failedAttemptSuppressesLiveSourceVersion } from "../../../src/modules/language/warm-attempt-version-ownership.js";
import { listPlpAutoBuildWorkForTests } from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";
import {
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";
import {
  activateAdminMediaResource,
  createAdminMediaResource,
  deactivateAdminMediaResource,
  deleteAdminMediaResource,
  resetMediaResourceSeedStateForTests,
  setMediaResourceAdminAssertOverrideForTests,
  updateAdminMediaResource,
} from "../../../src/modules/media-resources/media-resource.service.js";
import { resetMediaResourcesMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import {
  getMediaResourceByIdentity,
  setMediaResourceForceMemoryForTests,
} from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import { resetApprovedNewsSourcesCacheForTests } from "../../../src/modules/public-news/public-news.config.js";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function read(relativePath: string): string {
  return readFileSync(path.join(apiSrc, relativePath), "utf8");
}

async function flushScheduledWork(): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function installAdmin(): void {
  setMediaResourceAdminAssertOverrideForTests(async (userId) => {
    if (!userId.trim()) {
      throw new AdministrationForbiddenError("Administrator access is required.");
    }
    return { userId, memberId: `member-${userId}` };
  });
}

let sequence = 0;

async function createTrusted(input?: {
  readonly id?: string;
  readonly description?: string;
  readonly active?: boolean;
}) {
  sequence += 1;
  const id = input?.id ?? `stage-a-trusted-${sequence}`;
  return createAdminMediaResource({
    actorUserId: "admin-stage-a",
    id,
    resourceType: "TRUSTED_MEDIA",
    scopeType: "WORLD",
    countryCode: null,
    name: `Stage A ${id}`,
    logoLabel: "SA",
    logoUrl: null,
    websiteUrl: `https://${id}.example/`,
    categoryId: "international-wire-service",
    description: input?.description ?? "Stage A trusted explanation.",
    secondaryText: "International",
    active: input?.active ?? true,
  });
}

function civicWarmCount(): number {
  return listContentTranslationWarmMemoryPendingForTests().filter(
    (row) =>
      row.command.sourceKind === "civic_media" &&
      row.command.sourceRecordId === "civic-media-center",
  ).length;
}

function residual(deferred: boolean): PublicLocalizationResidualWithPreflight {
  return {
    family: "civic_media",
    presentationIdentity: {
      sourceKind: "civic_media",
      sourceRecordId: "civic-media-center",
    },
    targetLocale: "ar",
    translationState: "MISSING",
    retryPreflight: {
      semanticRetryDeferred: deferred,
      liveTranslationInvalid: false,
      liveTranslationStale: false,
      ready: !deferred,
    },
  } as PublicLocalizationResidualWithPreflight;
}

beforeEach(() => {
  process.env.HU_PLP_AUTO_BUILD_LOCALES = "";
  process.env.TRANSLATION_PROVIDER = "deterministic";
  setMediaResourceForceMemoryForTests(true);
  resetMediaResourcesMemoryForTests();
  resetMediaResourceSeedStateForTests();
  resetApprovedNewsSourcesCacheForTests();
  setMediaResourceAdminAssertOverrideForTests(null);
  setContentTranslationWarmForceMemoryForTests(true);
  resetContentTranslationWarmMemoryForTests();
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  resetLocalizationReconciliationDriverForTests();
  setLocalizationReconciliationDriverDepsForTests({
    listTargetLocales: async () => [],
  });
  installAdmin();
});

afterEach(() => {
  setMediaResourceAdminAssertOverrideForTests(null);
  resetMediaResourceSeedStateForTests();
  resetApprovedNewsSourcesCacheForTests();
  resetMediaResourcesMemoryForTests();
  setMediaResourceForceMemoryForTests(false);
  resetContentTranslationWarmMemoryForTests();
  setContentTranslationWarmForceMemoryForTests(false);
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  resetLocalizationReconciliationDriverForTests();
  resetLanguageRegistryStoreForTests();
  setLanguageRegistryForceMemoryForTests(false);
  delete process.env.HU_PLP_AUTO_BUILD_LOCALES;
});

describe("civic media translation recovery", () => {
  it("schedules civic_media recovery when an active trusted description changes", async () => {
    const created = await createTrusted({ description: "Original explanation." });
    await flushScheduledWork();
    resetContentTranslationWarmMemoryForTests();
    const before = await loadCivicMediaTranslationSource("civic-media-center");
    assert.ok(before);

    await updateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
      description: "Updated explanation for participants.",
    });
    await flushScheduledWork();

    const after = await loadCivicMediaTranslationSource("civic-media-center");
    assert.ok(after);
    assert.notEqual(after.sourceVersion, before.sourceVersion);
    assert.equal(civicWarmCount(), 1);
    const pending = listContentTranslationWarmMemoryPendingForTests()[0];
    assert.equal(pending?.command.sourceKind, "civic_media");
    assert.equal(pending?.command.sourceRecordId, "civic-media-center");
    assert.equal(pending?.command.reason, "public_update");
    assert.equal(pending?.command.sourceVersion, undefined);
  });

  it("schedules recovery when the active trusted set changes", async () => {
    const created = await createTrusted({ active: false, description: "Held explanation." });
    await flushScheduledWork();
    assert.equal(civicWarmCount(), 0);
    const inactiveVersion = await loadCivicMediaTranslationSource("civic-media-center");

    await activateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
    });
    await flushScheduledWork();
    const activeVersion = await loadCivicMediaTranslationSource("civic-media-center");
    assert.notEqual(activeVersion?.sourceVersion, inactiveVersion?.sourceVersion);
    assert.equal(civicWarmCount(), 1);

    resetContentTranslationWarmMemoryForTests();
    await deactivateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
    });
    await flushScheduledWork();
    const removedVersion = await loadCivicMediaTranslationSource("civic-media-center");
    assert.equal(removedVersion?.sourceVersion, inactiveVersion?.sourceVersion);
    assert.equal(civicWarmCount(), 1);
    assert.equal(
      listPlpAutoBuildWorkForTests().some((row) => row.entityId === created.id),
      false,
    );
  });

  it("does not schedule content translation for name, URL, or logo edits", async () => {
    const created = await createTrusted();
    await flushScheduledWork();
    resetContentTranslationWarmMemoryForTests();
    const before = await loadCivicMediaTranslationSource("civic-media-center");

    await updateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
      name: "Renamed outlet",
    });
    await updateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
      websiteUrl: "https://renamed-stage-a.example/news",
    });
    await updateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
      logoUrl: "https://cdn.example/stage-a-logo.png",
    });
    await flushScheduledWork();

    const after = await loadCivicMediaTranslationSource("civic-media-center");
    assert.equal(after?.sourceVersion, before?.sourceVersion);
    assert.equal(civicWarmCount(), 0);
    assert.equal(listPlpAutoBuildWorkForTests().length, 0);
  });

  it("does not enqueue a second warm when the translation input is unchanged", async () => {
    const created = await createTrusted({ description: "Stable explanation." });
    await flushScheduledWork();
    assert.equal(civicWarmCount(), 1);

    await updateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
      description: "  Stable explanation.  ",
    });
    await updateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
      description: "Replacement explanation.",
    });
    await flushScheduledWork();
    assert.equal(civicWarmCount(), 1);

    const pending = listContentTranslationWarmMemoryPendingForTests()[0];
    assert.ok(pending);
    markContentTranslationWarmMemoryPublishedForTests(pending.eventId);
    assert.equal(civicWarmCount(), 0);

    await updateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
      description: "Later explanation.",
    });
    await flushScheduledWork();
    assert.equal(civicWarmCount(), 1);
  });

  it("preserves the current civic_media source version when the input is unchanged", async () => {
    const created = await createTrusted();
    const current = await loadCivicMediaTranslationSource("civic-media-center");
    assert.ok(current);
    await updateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
      name: "Identity only",
      secondaryText: "Country label only",
    });
    const again = await loadCivicMediaTranslationSource("civic-media-center");
    assert.equal(again?.sourceVersion, current.sourceVersion);
    assert.equal(
      trustedMediaTranslationInputChanged(
        { ...created, name: "before" },
        { ...created, name: "after" },
      ),
      false,
    );
  });

  it("keeps a missing current civic_media version eligible and blocks same-version terminal retries", () => {
    assert.ok(CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS.includes("civic_media"));
    assert.deepEqual(discoverCivicMediaTranslationRecordIds(), ["civic-media-center"]);
    assert.equal(
      failedAttemptSuppressesLiveSourceVersion({
        disposition: "failed",
        attemptSourceVersion: "v-older",
        liveSourceVersion: "v-live",
      }),
      false,
    );
    assert.equal(
      failedAttemptSuppressesLiveSourceVersion({
        disposition: "failed",
        attemptSourceVersion: "v-live",
        liveSourceVersion: "v-live",
      }),
      true,
    );
    const selected = selectCurrentlyRetryEligibleResiduals([
      residual(false),
      residual(true),
    ]);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.retryPreflight.semanticRetryDeferred, false);
    assert.equal(selected[0]?.presentationIdentity.sourceRecordId, "civic-media-center");
  });

  it("continues trusted PLP only when the explanation fingerprint changes", async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-zh-Hant", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    process.env.HU_PLP_AUTO_BUILD_LOCALES = "zh-Hant";

    const created = await createTrusted({ description: "First PLP explanation." });
    await flushScheduledWork();
    const first = listPlpAutoBuildWorkForTests().filter((row) => row.entityId === created.id);
    assert.equal(first.length, 1);
    assert.equal(first[0]?.entityType, "civic_media_trusted");
    assert.equal(first[0]?.locale, "zh-hant");

    resetPlpAutoBuildWorkStoreForTests();
    await updateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
      name: "Name does not rebuild PLP",
      websiteUrl: "https://stage-a-plp-name.example/",
    });
    assert.equal(listPlpAutoBuildWorkForTests().length, 0);

    await updateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
      description: "Second PLP explanation.",
    });
    const second = listPlpAutoBuildWorkForTests().filter((row) => row.entityId === created.id);
    assert.equal(second.length, 1);
    assert.notEqual(second[0]?.canonicalVersion, first[0]?.canonicalVersion);
  });

  it("hard-deletes an inactive non-catalog row without a civic_media warm", async () => {
    const created = await createTrusted();
    await deactivateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
    });
    await flushScheduledWork();
    resetContentTranslationWarmMemoryForTests();
    resetPlpAutoBuildWorkStoreForTests();
    const before = await loadCivicMediaTranslationSource("civic-media-center");

    const removed = await deleteAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: created.id,
      resourceType: "TRUSTED_MEDIA",
      hard: true,
    });
    await flushScheduledWork();

    assert.equal(removed.resource, null);
    assert.equal(
      await getMediaResourceByIdentity({
        resourceType: "TRUSTED_MEDIA",
        id: created.id,
      }),
      null,
    );
    const after = await loadCivicMediaTranslationSource("civic-media-center");
    assert.equal(after?.sourceVersion, before?.sourceVersion);
    assert.equal(civicWarmCount(), 0);
    assert.equal(listPlpAutoBuildWorkForTests().length, 0);
  });

  it("rebuilds catalog PLP after a hard delete whose explanation differed from the catalog", async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-ar", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    process.env.HU_PLP_AUTO_BUILD_LOCALES = "ar";

    const catalog = TRUSTED_MEDIA_RESOURCES.find((resource) => resource.id === "reuters");
    assert.ok(catalog);
    await updateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: "reuters",
      resourceType: "TRUSTED_MEDIA",
      description: "Temporary explanation that is not the catalog text.",
    });
    await deactivateAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: "reuters",
      resourceType: "TRUSTED_MEDIA",
    });
    resetContentTranslationWarmMemoryForTests();
    resetPlpAutoBuildWorkStoreForTests();

    await deleteAdminMediaResource({
      actorUserId: "admin-stage-a",
      id: "reuters",
      resourceType: "TRUSTED_MEDIA",
      hard: true,
    });

    assert.equal(civicWarmCount(), 0);
    const plp = listPlpAutoBuildWorkForTests().filter((row) => row.entityId === "reuters");
    assert.equal(plp.length, 1);
    assert.equal(plp[0]?.locale, "ar");
    assert.equal(plp[0]?.trigger, "CANONICAL_CONTENT_UPDATED");
  });

  it("does not call a translation provider from the recovery schedule", () => {
    const recovery = read("modules/language/civic-media-translation-recovery.ts");
    const service = read("modules/media-resources/media-resource.service.ts");
    assert.match(recovery, /notifyPublicPresentationChanged/);
    assert.doesNotMatch(recovery, /gemini|getOrCreateContentTranslation|generateContentTranslation/i);
    assert.match(service, /scheduleCivicMediaRecoveryIfTranslationInputChanged/);
    assert.doesNotMatch(
      service,
      /gemini|getOrCreateContentTranslation|generateContentTranslation/i,
    );
  });
});
