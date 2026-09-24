/**
 * Step 15D.7 — universal localization coverage guard.
 * Deterministic. No Gemini. No staging writes. No locale-specific setup.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  classifyWebUiCoveragePath,
  isLocalizationReadyForSearch,
  isLocalizationReadyForSeo,
  isParticipantAuthOwnAccountPath,
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
  listUnknownWebUiCoveragePaths,
  PARTICIPANT_AUTH_OWN_ACCOUNT_PATHS,
  type LanguageLocalizationReadinessReport,
} from "@hu/types";

import { assessWebUiCatalogReadinessForLocale } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
  rebaseWebUiCheckpointForCatalogExpansion,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
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

function readWeb(rel: string): string {
  return readFileSync(join(webSrc, rel), "utf8");
}

function readRepo(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

function readPath(messages: Record<string, unknown>, dottedPath: string): unknown {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function projectPaths(
  english: Record<string, unknown>,
  paths: readonly string[],
  transform?: (value: string) => string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const pathKey of paths) {
    const value = readPath(english, pathKey);
    if (typeof value !== "string") {
      continue;
    }
    const segments = pathKey.split(".");
    let cursor: Record<string, unknown> = out;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]!;
      const next = cursor[segment];
      if (next == null || typeof next !== "object" || Array.isArray(next)) {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1]!] = transform ? transform(value) : value;
  }
  return out;
}

describe("Step 15D.7 — universal localization coverage guard", () => {
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

  it("1–2 own-account auth paths are Participant-required; login/signup remain Public-only", () => {
    for (const pathKey of PARTICIPANT_AUTH_OWN_ACCOUNT_PATHS) {
      assert.equal(isParticipantAuthOwnAccountPath(pathKey), true, pathKey);
      assert.equal(isParticipantWebUiRequiredPath(pathKey), true, pathKey);
    }
    assert.equal(isParticipantWebUiRequiredPath("auth.newPassword"), true);
    assert.equal(isParticipantWebUiRequiredPath("auth.forgotPassword"), true);
    assert.equal(isParticipantWebUiRequiredPath("auth.email"), true);
    assert.equal(isParticipantWebUiRequiredPath("auth.logIn"), true);
    assert.equal(isParticipantWebUiRequiredPath("auth.confirmEmail"), true);

    assert.equal(isParticipantWebUiRequiredPath("auth.loginTitle"), false);
    assert.equal(isParticipantWebUiRequiredPath("auth.registerTitle"), false);
    assert.equal(isParticipantWebUiRequiredPath("auth.password"), false);
    assert.equal(isParticipantWebUiRequiredPath("auth.resetPasswordTitle"), false);
    assert.equal(isPublicReaderWebUiRequiredPath("auth.loginTitle"), true);
    assert.equal(isPublicReaderWebUiRequiredPath("auth.registerTitle"), true);
  });

  it("3–4 Avatar chrome uses WEB_UI and is Participant-required", () => {
    const avatarField = readWeb("features/media-upload/components/AvatarImageUploadField.tsx");
    assert.match(avatarField, /useTranslations\("memberProfile\.avatar"\)/);
    assert.match(avatarField, /t\("replace"\)/);
    assert.match(avatarField, /t\("choose"\)/);
    assert.match(avatarField, /t\("remove"\)/);
    assert.match(avatarField, /t\("uploading"\)/);
    assert.doesNotMatch(avatarField, /["']Replace Avatar["']/);
    assert.doesNotMatch(avatarField, /["']Choose Avatar["']/);
    assert.doesNotMatch(avatarField, /["']Remove Avatar["']/);

    const crop = readWeb("features/media-upload/components/AvatarCropEditor.tsx");
    assert.match(crop, /useTranslations\("memberProfile\.avatar"\)/);
    assert.doesNotMatch(crop, /["']Save Avatar["']/);

    assert.equal(isParticipantWebUiRequiredPath("memberProfile.avatar.replace"), true);
    assert.equal(isParticipantWebUiRequiredPath("memberProfile.avatar.choose"), true);
    assert.equal(isParticipantWebUiRequiredPath("memberProfile.avatar.remove"), true);
    assert.equal(isParticipantWebUiRequiredPath("memberProfile.avatar.uploading"), true);
  });

  it("5–14 keeps expanded ordinary surfaces in and privileged tooling out", () => {
    assert.equal(isPublicReaderWebUiRequiredPath("participantPublic.sections.biography"), true);
    assert.equal(isParticipantWebUiRequiredPath("initiativeExperience.manage.createHeading"), true);
    assert.equal(isParticipantWebUiRequiredPath("civicActivity.intro"), true);
    assert.equal(isParticipantWebUiRequiredPath("preferences.title"), true);
    assert.equal(isParticipantWebUiRequiredPath("workspace.publishingPage.title"), true);
    assert.equal(
      isParticipantWebUiRequiredPath("workspace.publishingPage.myPublications.title"),
      true,
    );
    assert.equal(isParticipantWebUiRequiredPath("authoringPage.becomeAuthor.title"), true);
    assert.equal(isPublicReaderWebUiRequiredPath("publicHome.interactiveMap.legend.presidentialRepublics.title"), true);
    assert.equal(isPublicReaderWebUiRequiredPath("publicNews.card.createInitiative"), true);
    assert.equal(isPublicReaderWebUiRequiredPath("publicGeo.shared.world"), true);

    assert.equal(isParticipantWebUiRequiredPath("workspace.editorialPage.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorialReview"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorPanel.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.administration.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.adminPanel.title"), false);
  });

  it("15 map legend remains Public-required", () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const legend = collectStringPaths(english).filter((pathKey) =>
      pathKey.startsWith("publicHome.interactiveMap.legend."),
    );
    assert.ok(legend.length >= 10);
    assert.ok(legend.every((pathKey) => isPublicReaderWebUiRequiredPath(pathKey)));
  });

  it("16–17 every common bundled-reference path has explicit classification; unknown fails", () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const all = collectStringPaths(english);
    const uk = new Set(collectStringPaths(loadBundledWebUiMessagePackFromFs("uk")!));
    const ar = new Set(collectStringPaths(loadBundledWebUiMessagePackFromFs("ar")!));
    const zh = new Set(collectStringPaths(loadBundledWebUiMessagePackFromFs("zh-Hant")!));
    const common = all.filter((pathKey) => uk.has(pathKey) && ar.has(pathKey) && zh.has(pathKey));
    assert.equal(common.length, all.length);

    const unknown = listUnknownWebUiCoveragePaths(common);
    assert.deepEqual(unknown, []);

    const kinds = { privileged: 0, other_owner: 0, legacy: 0, ordinary: 0 };
    for (const pathKey of common) {
      const classification = classifyWebUiCoveragePath(pathKey);
      assert.equal(classification.unknown, false, pathKey);
      if (classification.kind === "privileged") {
        kinds.privileged += 1;
      } else if (classification.kind === "other_owner") {
        kinds.other_owner += 1;
      } else if (classification.kind === "legacy") {
        kinds.legacy += 1;
      } else {
        kinds.ordinary += 1;
      }
    }
    assert.ok(kinds.privileged > 0);
    assert.ok(kinds.other_owner >= 2); // seo.*
    assert.ok(kinds.ordinary > 0);

    // Synthetic unknown must be detectable
    assert.equal(classifyWebUiCoveragePath("totally.unknown.future.path").unknown, true);
    assert.deepEqual(listUnknownWebUiCoveragePaths(["totally.unknown.future.path"]), [
      "totally.unknown.future.path",
    ]);
  });

  it("18–20 hypothetical new language discovers complete Public + Participant corpus without locale config", () => {
    const prepared = selectEnglishWebUiMessages("public");
    const english = loadBundledEnglishWebUiMessagePack();
    const all = collectStringPaths(english);
    const publicRequired = all.filter((pathKey) => isPublicReaderWebUiRequiredPath(pathKey));
    const participantRequired = all.filter((pathKey) => isParticipantWebUiRequiredPath(pathKey));

    assert.equal(prepared.publicRequiredKeyCount, publicRequired.length);
    assert.equal(prepared.participantRequiredKeyCount, participantRequired.length);
    assert.equal(
      prepared.selectedPaths.length,
      new Set([...publicRequired, ...participantRequired]).size,
    );

    // Corpus must include the audited ordinary surfaces for any new Registry locale.
    const mustInclude = [
      "publicHome.",
      "participantPublic.",
      "workspace.home.",
      "notifications.",
      "initiativeExperience.manage.",
      "civicActivity.",
      "memberProfile.",
      "memberProfile.avatar.",
      "memberProfile.privacy.",
      "memberProfile.participationArea.",
      "preferences.",
      "auth.accountSecurity",
      "auth.newPassword",
      "authoringPage.",
      "workspace.publishingPage.",
      "workspace.publishingPage.myPublications.",
      "publicHome.interactiveMap.legend.",
    ];
    for (const needle of mustInclude) {
      assert.ok(
        prepared.selectedPaths.some((pathKey) =>
          needle.endsWith(".") ? pathKey.startsWith(needle) : pathKey === needle,
        ),
        needle,
      );
    }
    for (const excluded of [
      "workspace.editorialPage.",
      "workspace.editorPanel",
      "workspace.administration.",
      "workspace.adminPanel.",
    ]) {
      assert.ok(
        !prepared.selectedPaths.some((pathKey) =>
          excluded.endsWith(".")
            ? pathKey.startsWith(excluded)
            : pathKey === excluded || pathKey.startsWith(`${excluded}.`),
        ),
        excluded,
      );
    }

    // No locale-specific branches in classifiers / ownership.
    for (const rel of [
      "packages/types/src/domain/participant-web-ui-scope.ts",
      "packages/types/src/domain/public-reader-web-ui-scope.ts",
      "packages/types/src/domain/web-ui-coverage-ownership.ts",
    ]) {
      const src = readRepo(rel);
      assert.doesNotMatch(src, /\blanguage\s*===\s*["']ka["']|\blanguage\s*===\s*["']he["']|locale\s*===\s*["']ka["']|locale\s*===\s*["']he["']/);
    }
  });

  it("21–23 prior Georgian pack incomplete; reuse + atomic combined publish", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const all = collectStringPaths(english);
    const required = all.filter((pathKey) => isParticipantWebUiRequiredPath(pathKey));
    // Simulate rev3: old 481 participant paths only
    function isLegacy481(pathKey: string): boolean {
      const excluded = [
        "workspace.publishingPage.",
        "workspace.editorialPage.",
        "workspace.editorPanel",
        "workspace.administration",
        "workspace.adminPanel",
        "workspace.editorialReview",
      ];
      const matches = (prefix: string) =>
        prefix.endsWith(".")
          ? pathKey === prefix.slice(0, -1) || pathKey.startsWith(prefix)
          : pathKey === prefix || pathKey.startsWith(`${prefix}.`);
      if (pathKey === "workspace" || pathKey.startsWith("workspace.")) {
        return !excluded.some(matches);
      }
      return (
        pathKey.startsWith("notifications.") ||
        pathKey.startsWith("civicActivity.timeline.events.")
      );
    }
    const legacy481 = all.filter(isLegacy481);
    assert.equal(legacy481.length, 481);
    assert.ok(required.length > 481);

    await upsertWebUiMessagePack({
      locale: "newlang",
      status: "published",
      messages: projectPaths(english, legacy481, (value) => `[nl] ${value}`) as never,
      sourceNote: "simulated pre-expansion pack",
    });
    const incomplete = await assessWebUiCatalogReadinessForLocale({
      locale: "newlang",
      scope: "participant",
    });
    assert.equal(incomplete.dataReady, false);
    assert.equal(incomplete.missingKeyCount, required.length - legacy481.length);

    const corpus = loadPublicWebUiEnglishCorpus();
    const sourceHash = hashWebUiEnglishFlatMap(corpus.flat);
    const batches = planWebUiDraftBatches(corpus.flat);
    const checkpoint = {
      checkpointId: "webui-act-newlang-15d7",
      jobId: "lang-act-newlang-15d7",
      locale: "newlang",
      generation: 1,
      sourceHash: "stale-before-15d7",
      terminologyMode: "live" as const,
      phase: "ready" as const,
      leafCount: legacy481.length,
      batchCount: 50,
      completedBatchCount: 50,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "New Language",
      nativeName: "New Language",
      textDirection: "ltr" as const,
      detail: "pre-expansion ready",
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
    assert.ok(rebased.completedBatchCount > 0);
    assert.ok(rebased.completedBatchCount < batches.length);
    const seeded = await listWebUiActivationBatches(rebased.checkpointId, "primary");
    assert.ok(seeded.some((batch) => batch.reason === "reused from published pack"));

    const published = await upsertWebUiMessagePack({
      locale: "newlang",
      status: "published",
      messages: projectPaths(english, required, (value) => `[nl] ${value}`) as never,
      sourceNote: "atomic combined",
    });
    assert.equal(published.status, "published");
    const ready = await assessWebUiCatalogReadinessForLocale({
      locale: "newlang",
      scope: "participant",
    });
    assert.equal(ready.dataReady, true);
  });

  it("26–28 uk/ar/zh-Hant satisfy canonical Public + Participant corpus", async () => {
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const pack = loadBundledWebUiMessagePackFromFs(locale);
      assert.ok(pack, locale);
      const publicReady = await assessWebUiCatalogReadinessForLocale({ locale });
      assert.equal(publicReady.dataReady, true, `${locale} public`);
      assert.equal(publicReady.missingKeyCount, 0, `${locale} public`);
      const participantReady = await assessWebUiCatalogReadinessForLocale({
        locale,
        scope: "participant",
      });
      assert.equal(participantReady.dataReady, true, `${locale} participant`);
      assert.equal(participantReady.missingKeyCount, 0, `${locale} participant`);
      assert.equal(typeof readPath(pack as never, "memberProfile.avatar.replace"), "string");
    }
  });

  it("29–30 Search/SEO remain Registry-flag driven, not WEB_UI completeness", () => {
    const base = {
      pack: "closure07",
      locale: "he",
      languageId: "lang-he",
      registry: {
        enabled: true,
        contentTranslationEnabled: true,
        searchEnabled: false,
        seoIndexingEnabled: false,
        pwaPersistedReadingEnabled: false,
      },
    } as unknown as LanguageLocalizationReadinessReport;

    assert.equal(isLocalizationReadyForSearch(base), true);
    assert.equal(isLocalizationReadyForSeo(base), false);

    const seoOn = {
      ...base,
      registry: { ...base.registry, seoIndexingEnabled: true },
    } as LanguageLocalizationReadinessReport;
    assert.equal(isLocalizationReadyForSeo(seoOn), true);

    const searchSrc = readRepo(
      "packages/types/src/domain/language-localization-readiness.ts",
    );
    assert.match(searchSrc, /Does NOT require: full WEB_UI completion/);
    assert.match(searchSrc, /seoIndexingEnabled/);
  });

  it("31–32 Public News source-original; no provider-on-read in coverage modules", () => {
    const eligibility = readRepo(
      "apps/api/src/modules/language/content-translation-eligibility.ts",
    );
    assert.match(eligibility, /public_news:\s*\[\s*\]/);

    for (const rel of [
      "packages/types/src/domain/web-ui-coverage-ownership.ts",
      "packages/types/src/domain/participant-web-ui-scope.ts",
      "packages/types/src/domain/public-reader-web-ui-scope.ts",
      "apps/web/src/features/media-upload/components/AvatarImageUploadField.tsx",
    ]) {
      const src = readRepo(rel);
      assert.doesNotMatch(src, /GEMINI_API_KEY|generateContent|TranslationProvider|provider-on-read/i);
    }
  });

  it("hardcoded Authoring / MyPublications regression stays localized", () => {
    const authoring = readWeb("features/blog/components/AuthoringPageContent.tsx");
    assert.match(authoring, /useTranslations\("authoringPage"\)/);
    assert.doesNotMatch(authoring, /["']Become a Blog Author["']/);
    const table = readWeb("features/blog/components/MyPublicationsTable.tsx");
    assert.match(table, /useTranslations\("workspace\.publishingPage"\)/);
    assert.doesNotMatch(table, /["']My Publications["']/);
  });
});
