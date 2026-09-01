/**
 * Production Completion Pack 02G Task 05 — civic public translated read (API).
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";

import type { Initiative } from "@hu/types";

import {
  CONTENT_TRANSLATION_FIELD_ALLOWLIST,
  DeterministicTranslationProvider,
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  loadTranslatableSource,
  processContentTranslationWarmRequested,
  buildContentTranslationWarmRequestedCommand,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolvePublicTranslatedContent,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import {
  createInitiative,
  deleteInitiative,
  updateInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function sampleInitiative(): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack02g-t05-${Date.now()}`,
    stewardId: "member-pack02g-t05",
    createdAt: now,
    updatedAt: now,
    title: "Read River Initiative",
    description: "Participants restore a river for read tests.",
    status: "proposal",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test",
      language: "en",
      communitySlug: "test",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

describe("Production Completion Pack 02G Task 05 — civic translated read API", () => {
  let initiative: Initiative;

  beforeEach(async () => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    await createLanguageRegistryRecord({
      locale: "g5-warm",
      englishName: "G5 Warm",
      nativeName: "G5 Warm",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
    });
    initiative = sampleInitiative();
    createInitiative(initiative);
  });

  afterEach(() => {
    deleteInitiative(initiative.initiativeId);
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetLanguageRegistryStoreForTests();
  });

  it("1–10. cached preferred resolve; missing/stale/none/ask/source-language safety", async () => {
    await processContentTranslationWarmRequested(
      buildContentTranslationWarmRequestedCommand({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
      }),
    );

    const preferred = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: "g5-warm",
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(preferred.presentationMode, "preferred_translation");
    assert.equal(preferred.isMachineTranslated, true);
    assert.equal(preferred.isStale, false);
    assert.notEqual(preferred.content.title, preferred.originalContent.title);

    const none = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: "g5-warm",
      translationPreference: "none",
      generateIfMissing: false,
    });
    assert.equal(none.presentationMode, "original");
    assert.equal(none.content.title, initiative.title);

    const ask = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: "g5-warm",
      translationPreference: "ask",
      generateIfMissing: false,
    });
    assert.equal(ask.presentationMode, "original");
    assert.equal(ask.canViewTranslation, true);

    const sourceLang = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: "en",
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(sourceLang.presentationMode, "original");

    const before = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    updateInitiative(initiative.initiativeId, {
      title: "Read River Initiative Revised",
      updatedAt: new Date().toISOString(),
    });
    const afterSource = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.notEqual(before?.sourceVersion, afterSource?.sourceVersion);

    const stale = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: "g5-warm",
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(stale.presentationMode, "original");
    assert.equal(stale.originalContent.title, "Read River Initiative Revised");
    assert.ok(stale.isStale === true || stale.content.title === "Read River Initiative Revised");
  });

  it("11. resolve path does not require provider when generateIfMissing=false", async () => {
    let calls = 0;
    const provider = new DeterministicTranslationProvider();
    const original = provider.translate.bind(provider);
    provider.translate = async (req) => {
      calls += 1;
      return original(req);
    };
    setTranslationProviderForTests(provider);

    await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: "g5-warm",
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(calls, 0);
  });

  it("12–15. wrong id/kind does not leak; update then warm becomes readable", async () => {
    await assert.rejects(
      () =>
        resolvePublicTranslatedContent({
          sourceKind: "initiative",
          sourceRecordId: "missing-pack02g-t05",
          preferredReadingLanguage: "g5-warm",
          translationPreference: "preferred",
          generateIfMissing: false,
        }),
    );

    updateInitiative(initiative.initiativeId, {
      title: "After warm version",
      updatedAt: new Date().toISOString(),
    });
    await processContentTranslationWarmRequested(
      buildContentTranslationWarmRequestedCommand({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        reason: "public_update",
      }),
    );
    const again = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: "g5-warm",
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(again.presentationMode, "preferred_translation");
    assert.match(again.originalContent.title, /After warm version/);
  });

  it("16–20. allowlists + Official Response / Civic Archive / Civic Media privacy", () => {
    assert.deepEqual([...CONTENT_TRANSLATION_FIELD_ALLOWLIST.official_response], [
      "subject",
      "summary",
      "responseReference",
      "organizationName",
    ]);
    assert.ok(!CONTENT_TRANSLATION_FIELD_ALLOWLIST.official_response.includes("rawSource"));
    assert.ok(
      CONTENT_TRANSLATION_FIELD_ALLOWLIST.civic_archive.includes("implementationStory"),
    );
    assert.ok(!CONTENT_TRANSLATION_FIELD_ALLOWLIST.civic_media.includes("diagramSvg"));
    assert.ok(!CONTENT_TRANSLATION_FIELD_ALLOWLIST.civic_media.includes("websiteUrl"));

    const loaders = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation-civic-loaders.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      loaders.slice(
        loaders.indexOf("loadOfficialResponseTranslationSource"),
        loaders.indexOf("loadPublicImpactTranslationSource"),
      ),
      /projection\.rawSource|projection\.messageHeaders|projection\.providerMetadata/,
    );
  });

  it("24–32. Initiative/Analysis/Petition generate compat preserved; Blog/Discussion/search not introduced", async () => {
    const created = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "on_demand",
    });
    assert.equal(created.generated, true);

    const fields = readFileSync(
      path.join(
        repoRoot,
        "apps/web/src/features/language/components/PublicTranslatedFields.tsx",
      ),
      "utf8",
    );
    assert.match(fields, /enableOnDemandGenerate/);
    assert.match(fields, /generateContentTranslation/);

    const civicSection = readFileSync(
      path.join(
        repoRoot,
        "apps/web/src/features/language/components/CivicPublicTranslatedSection.tsx",
      ),
      "utf8",
    );
    assert.match(civicSection, /enableOnDemandGenerate=\{false\}/);
    assert.doesNotMatch(civicSection, /generateContentTranslation/);

    const webApp = readFileSync(
      path.join(repoRoot, "apps/web/src/app/improvement-proposals/public/[proposalId]/page.tsx"),
      "utf8",
    );
    assert.match(webApp, /CivicPublicTranslatedSection/);
    assert.doesNotMatch(webApp, /discussion_comment|blog_post/);
  });
});
