/**
 * Step 15D.5 — complete ordinary Participant localization coverage.
 * Deterministic. No Gemini. No staging writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isParticipantAuthAccountSecurityPath,
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
  PARTICIPANT_AUTH_ACCOUNT_SECURITY_PATHS,
  PARTICIPANT_WORKSPACE_EXCLUDED_PREFIXES,
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
  transform?: (value: string, pathKey: string) => string,
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
    cursor[segments[segments.length - 1]!] = transform ? transform(value, pathKey) : value;
  }
  return out;
}

/** Step 15D.2 Participant classifier (pre-15D.5) — for incomplete-pack proofs. */
function isLegacy481ParticipantPath(pathKey: string): boolean {
  const excluded = [
    "workspace.publishingPage.",
    "workspace.editorialPage.",
    "workspace.editorPanel",
    "workspace.administration",
    "workspace.adminPanel",
    "workspace.editorialReview",
  ] as const;
  function matchesPrefix(prefix: string): boolean {
    if (prefix.endsWith(".")) {
      return pathKey === prefix.slice(0, -1) || pathKey.startsWith(prefix);
    }
    return pathKey === prefix || pathKey.startsWith(`${prefix}.`);
  }
  if (pathKey === "workspace" || pathKey.startsWith("workspace.")) {
    return !excluded.some(matchesPrefix);
  }
  return (
    pathKey.startsWith("notifications.") ||
    pathKey.startsWith("civicActivity.timeline.events.")
  );
}

describe("Step 15D.5 — complete ordinary Participant localization coverage", () => {
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

  it("1–8 expands Participant-required families and keeps unrelated auth out", () => {
    assert.equal(isParticipantWebUiRequiredPath("initiativeExperience.manage.fields.title"), true);
    assert.equal(isParticipantWebUiRequiredPath("memberProfile.fields.displayName"), true);
    assert.equal(isParticipantWebUiRequiredPath("preferences.sections.language"), true);
    assert.equal(isParticipantWebUiRequiredPath("civicActivity.intro"), true);
    assert.equal(isParticipantWebUiRequiredPath("civicActivity.sections.summary"), true);
    assert.equal(isParticipantWebUiRequiredPath("civicActivity.timeline.events.initiative_published"), true);
    assert.equal(isParticipantWebUiRequiredPath("workspace.publishingPage.title"), true);
    assert.equal(isParticipantWebUiRequiredPath("authoringPage.application.title"), true);

    for (const pathKey of PARTICIPANT_AUTH_ACCOUNT_SECURITY_PATHS) {
      assert.equal(isParticipantAuthAccountSecurityPath(pathKey), true, pathKey);
      assert.equal(isParticipantWebUiRequiredPath(pathKey), true, pathKey);
    }
    assert.equal(isParticipantWebUiRequiredPath("auth.loginTitle"), false);
    assert.equal(isParticipantWebUiRequiredPath("auth.registerTitle"), false);
    assert.equal(isParticipantWebUiRequiredPath("auth.password"), false);
    // Own-account password/email chrome (15D.7)
    assert.equal(isParticipantWebUiRequiredPath("auth.newPassword"), true);
    assert.equal(isParticipantWebUiRequiredPath("auth.forgotPassword"), true);
    assert.equal(isParticipantWebUiRequiredPath("auth.email"), true);
    assert.equal(isParticipantWebUiRequiredPath("auth.logIn"), true);
    assert.equal(isParticipantWebUiRequiredPath("auth.confirmEmail"), true);
  });

  it("9–10 participantPublic is Public-reader; bio/skills remain PLP-owned", () => {
    assert.equal(isPublicReaderWebUiRequiredPath("participantPublic.sections.biography"), true);
    assert.equal(isPublicReaderWebUiRequiredPath("participantPublic.messaging.message"), true);
    // Chrome labels are WEB_UI; persisted bio/skills body stays PLP.
    const plpOperator = readRepo(
      "apps/api/src/modules/language/published-localized-presentation/universal/participant-public-plp-operator.ts",
    );
    assert.match(plpOperator, /PARTICIPANT_PUBLIC_PLP/);
    assert.match(plpOperator, /biography|skills/i);
    const publicScope = readRepo("packages/types/src/domain/public-reader-web-ui-scope.ts");
    assert.match(publicScope, /participantPublic\./);
    assert.match(publicScope, /participant_public/);
  });

  it("11–14 keeps editorial / editor / admin privileged exclusions", () => {
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorialPage.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorialReview"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorialReview.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorPanel"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorPanel.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.administration.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.adminPanel.title"), false);
    for (const prefix of PARTICIPANT_WORKSPACE_EXCLUDED_PREFIXES) {
      assert.ok(!prefix.includes("publishingPage"), prefix);
    }
  });

  it("15–16 AuthoringPageContent + ProfileSection Coming soon are localized", () => {
    const authoring = readWeb("features/blog/components/AuthoringPageContent.tsx");
    assert.match(authoring, /useTranslations\("authoringPage"\)/);
    assert.match(authoring, /t\("becomeAuthor\.title"\)/);
    assert.match(authoring, /t\("application\.submit"\)/);
    assert.doesNotMatch(authoring, /["']Become a Blog Author["']/);
    assert.doesNotMatch(authoring, /["']Submit application["']/);
    assert.doesNotMatch(authoring, /["']Loading Authoring…["']/);
    // Privileged editor/admin StatusBanner copy may remain English.
    assert.match(authoring, /Editorial access/);

    const profileSection = readWeb("components/member/ProfileSection.tsx");
    assert.match(profileSection, /useTranslations\("common"\)/);
    assert.match(profileSection, /t\("comingSoon"\)/);
    assert.doesNotMatch(profileSection, /["']Coming soon["']/);
  });

  it("17 Civic Activity dates receive active locale", () => {
    const src = readWeb("features/civic-activity/components/MyCivicActivityWorkspace.tsx");
    assert.match(src, /useLocale\(\)/);
    assert.match(src, /formatInitiativeDate\(metrics\.latestActivityDate, locale\)/);
    assert.match(src, /formatInitiativeDate\(entry\.occurredAt, locale\)/);
    assert.match(src, /formatInitiativeDate\(loadedAt, locale\)/);
    assert.doesNotMatch(src, /formatInitiativeDate\([^,)]+\)/);
  });

  it("18 arbitrary Civic Activity API prose is not provider-translated on read", () => {
    const src = readWeb("features/civic-activity/components/MyCivicActivityWorkspace.tsx");
    assert.match(src, /entry\.detail/);
    assert.doesNotMatch(src, /TranslationProvider|GEMINI_API_KEY|generateContent|translateOnRead/);
    const closure = readWeb(
      "features/civic-activity/civic-activity-localization-closure03b.unit.test.ts",
    );
    assert.match(closure, /introduces no CT \/ PLP \/ Gemini \/ provider dependency/);
  });

  it("19 corrected Participant denominator is derived consistently API/Web", () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const required = collectStringPaths(english).filter((pathKey) =>
      isParticipantWebUiRequiredPath(pathKey),
    );
    const prepared = selectEnglishWebUiMessages("public");
    assert.equal(prepared.participantRequiredKeyCount, required.length);
    assert.ok(required.length > 481);
    // Denominator is classifier-derived — never a hardcoded constant in consumers.
    const progress = readWeb(
      "features/administration/admin-languages-localization-progress.ts",
    );
    assert.doesNotMatch(progress, /\b481\b/);
    assert.doesNotMatch(progress, /\b1170\b/);
    assert.match(progress, /participantWebUi\.requiredKeyCount/);
  });

  it("20–23 prior 481-complete remote pack is Participant-incomplete; reuse + atomic publish", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const all = collectStringPaths(english);
    const legacy481 = all.filter(isLegacy481ParticipantPath);
    assert.equal(legacy481.length, 481);

    const required = all.filter((pathKey) => isParticipantWebUiRequiredPath(pathKey));
    assert.ok(required.length > 481);

    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: projectPaths(english, legacy481, (value) => `[ka] ${value}`) as never,
      sourceNote: "legacy 481-complete participant pack",
    });

    const incomplete = await assessWebUiCatalogReadinessForLocale({
      locale: "ka",
      scope: "participant",
    });
    assert.equal(incomplete.dataReady, false);
    assert.equal(incomplete.requiredKeyCount, required.length);
    assert.equal(incomplete.missingKeyCount, required.length - legacy481.length);
    assert.ok(
      incomplete.sampleMissingPaths.some(
        (path) =>
          path.startsWith("initiativeExperience.manage.") ||
          path.startsWith("memberProfile.") ||
          path.startsWith("preferences.") ||
          path.startsWith("workspace.publishingPage.") ||
          path.startsWith("authoringPage.") ||
          path.startsWith("civicActivity.") ||
          path.startsWith("auth."),
      ),
    );

    // Existing valid remote strings are reusable via catalog-expansion rebase.
    const corpus = loadPublicWebUiEnglishCorpus();
    const sourceHash = hashWebUiEnglishFlatMap(corpus.flat);
    const batches = planWebUiDraftBatches(corpus.flat);
    const checkpoint = {
      checkpointId: "webui-act-ka-15d5-test",
      jobId: "lang-act-ka-15d5-test",
      locale: "ka",
      generation: 1,
      sourceHash: "stale-before-15d5",
      terminologyMode: "live" as const,
      phase: "ready" as const,
      leafCount: legacy481.length,
      batchCount: 100,
      completedBatchCount: 100,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Georgian",
      nativeName: "ქართული",
      textDirection: "ltr" as const,
      detail: "Participant interface ready (pre-15D.5)",
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
    assert.equal(rebased.phase, "primary");
    assert.ok(rebased.completedBatchCount > 0);
    assert.ok(rebased.completedBatchCount < batches.length);

    const seededBatches = await listWebUiActivationBatches(rebased.checkpointId, "primary");
    const okSeeded = seededBatches.filter((batch) => batch.status === "ok");
    assert.equal(okSeeded.length, rebased.completedBatchCount);
    assert.ok(okSeeded.every((batch) => batch.reason === "reused from published pack"));

    // Combined pack publication remains a single atomic upsert.
    const combinedPaths = [...new Set([...legacy481, ...required])];
    const published = await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: projectPaths(english, combinedPaths, (value) => `[ka] ${value}`) as never,
      sourceNote: "atomic combined participant pack",
    });
    assert.equal(published.status, "published");
    const ready = await assessWebUiCatalogReadinessForLocale({
      locale: "ka",
      scope: "participant",
    });
    assert.equal(ready.dataReady, true);
    assert.equal(ready.missingKeyCount, 0);
  });

  it("24–26 uk/ar/zh-Hant satisfy corrected Public + Participant readiness", async () => {
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
      const authoringTitle = readPath(pack as never, "authoringPage.becomeAuthor.title");
      assert.equal(typeof authoringTitle, "string", locale);
      assert.notEqual(authoringTitle, "Become a Blog Author", locale);
    }
  });

  it("32 Admin cannot show Localization 100% while Participant interface is incomplete", () => {
    const progress = readWeb(
      "features/administration/admin-languages-localization-progress.ts",
    );
    assert.match(
      progress,
      /readiness\.webUi\.dataReady && readiness\.participantWebUi\.dataReady/,
    );
    assert.match(
      progress,
      /report\.webUi\.dataReady && report\.participantWebUi\.dataReady/,
    );
    const section = readWeb("features/administration/components/AdminLanguagesSection.tsx");
    assert.match(section, /participantWebUi/);
    assert.match(section, /Public interface|Participant interface|participant/i);
  });
});
