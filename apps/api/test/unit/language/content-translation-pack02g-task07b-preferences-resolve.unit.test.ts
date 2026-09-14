/**
 * Pack 02G Task 07B — participant language context must use canonical Preferences repository.
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
  DeterministicTranslationProvider,
  ensureLanguageRegistrySeeded,
  processContentTranslationWarmRequested,
  buildContentTranslationWarmRequestedCommand,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolveParticipantLanguageContext,
  resolvePublicTranslatedContent,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import { updateMemberPreferencesForAuthUser } from "../../../src/modules/preferences/preferences.service.js";
import { getPreferencesByMemberId } from "../../../src/modules/preferences/preferences.store.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const MEMBER_ID = "member-pack02g-t07b-prefs-resolve";

function sampleInitiative(): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack02g-t07b-${Date.now()}`,
    stewardId: MEMBER_ID,
    createdAt: now,
    updatedAt: now,
    title: "Preferences Resolve River",
    description: "Staging prefs must unlock Ukrainian display.",
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

describe("Production Completion Pack 02G Task 07B — preferences resolve hotfix", () => {
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
    initiative = sampleInitiative();
    createInitiative(initiative);

    await updateMemberPreferencesForAuthUser(MEMBER_ID, {
      experiencePreferences: {
        interfaceLanguage: "uk",
        readingLanguages: ["uk"],
        writingLanguages: ["en"],
        translationPreference: "preferred",
      },
    });
  });

  afterEach(() => {
    deleteInitiative(initiative.initiativeId);
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("A. persisted preferred+uk prefs resolve current Ukrainian as preferred_translation", async () => {
    await processContentTranslationWarmRequested(
      buildContentTranslationWarmRequestedCommand({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
      }),
    );

    // Resolve like the HTTP route: participantId only — no translationPreference override.
    const resolved = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      participantId: MEMBER_ID,
      generateIfMissing: false,
    });

    assert.equal(resolved.presentationMode, "preferred_translation");
    assert.equal(resolved.activeLanguage, "uk");
    assert.equal(resolved.isMachineTranslated, true);
    assert.equal(resolved.isStale, false);
    assert.notEqual(resolved.content.title, resolved.originalContent.title);
    assert.equal(resolved.originalContent.title, initiative.title);
  });

  it("B. missing preferences still resolve original/default safely", async () => {
    await processContentTranslationWarmRequested(
      buildContentTranslationWarmRequestedCommand({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
      }),
    );

    const context = await resolveParticipantLanguageContext("member-pack02g-t07b-missing");
    assert.equal(context.preferredReadingLanguage, "en");
    assert.equal(context.translationDisplayPreference, "none");

    const resolved = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      participantId: "member-pack02g-t07b-missing",
      generateIfMissing: false,
    });
    assert.equal(resolved.presentationMode, "original");
    assert.equal(resolved.content.title, initiative.title);
  });

  it("C. language query override remains effective", async () => {
    await processContentTranslationWarmRequested(
      buildContentTranslationWarmRequestedCommand({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
      }),
    );

    // Participant prefers uk+preferred, but explicit language=en must stay original.
    const overridden = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      participantId: MEMBER_ID,
      preferredReadingLanguage: "en",
      generateIfMissing: false,
    });
    assert.equal(overridden.presentationMode, "original");
    assert.equal(overridden.content.title, initiative.title);

    const context = await resolveParticipantLanguageContext(MEMBER_ID);
    assert.equal(context.preferredReadingLanguage, "uk");
    assert.equal(context.translationDisplayPreference, "preferred");
  });

  it("D. resolve path does not depend on legacy preferences.store Map", async () => {
    assert.equal(getPreferencesByMemberId(MEMBER_ID), null);

    const source = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/participant-language-context.ts",
      ),
      "utf8",
    );
    assert.match(source, /findPreferencesByMemberId/);
    assert.doesNotMatch(source, /preferences\.store/);
    assert.doesNotMatch(source, /getPreferencesByMemberId/);

    const context = await resolveParticipantLanguageContext(MEMBER_ID);
    assert.equal(context.preferredReadingLanguage, "uk");
    assert.equal(context.translationDisplayPreference, "preferred");
  });
});
