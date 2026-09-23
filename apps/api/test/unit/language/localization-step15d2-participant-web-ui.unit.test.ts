/**
 * Step 15D.2 — ordinary Participant WEB_UI readiness scope + consumers.
 * Deterministic. No Gemini. No staging writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
  PARTICIPANT_WORKSPACE_EXCLUDED_PREFIXES,
} from "@hu/types";

import { assessWebUiCatalogReadinessForLocale } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
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
const typesDomain = join(repoRoot, "packages/types/src/domain");
const assessModule = join(
  repoRoot,
  "apps/api/src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.ts",
);

function readRepo(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

function readWeb(rel: string): string {
  return readFileSync(join(webSrc, rel), "utf8");
}

describe("Step 15D.2 — Participant WEB_UI readiness", () => {
  beforeEach(() => {
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
  });

  afterEach(() => {
    resetWebUiMessagePackStoreForTests();
  });

  it("includes workspace.home.*, notifications.*, and civicActivity.timeline.events.*", () => {
    assert.equal(isParticipantWebUiRequiredPath("workspace.home.title"), true);
    assert.equal(isParticipantWebUiRequiredPath("workspace.authGate.checkingSession"), true);
    assert.equal(isParticipantWebUiRequiredPath("notifications.types.initiative_published.title"), true);
    assert.equal(
      isParticipantWebUiRequiredPath("civicActivity.timeline.events.initiative_published"),
      true,
    );

    const english = loadBundledEnglishWebUiMessagePack();
    const required = collectStringPaths(english).filter((pathKey) =>
      isParticipantWebUiRequiredPath(pathKey),
    );
    assert.ok(required.some((pathKey) => pathKey.startsWith("workspace.home.")));
    assert.ok(required.some((pathKey) => pathKey.startsWith("notifications.")));
    assert.ok(required.some((pathKey) => pathKey.startsWith("civicActivity.timeline.events.")));
  });

  it("excludes professional Workspace trees", () => {
    for (const prefix of PARTICIPANT_WORKSPACE_EXCLUDED_PREFIXES) {
      const sample = prefix.endsWith(".") ? `${prefix}title` : `${prefix}.title`;
      assert.equal(
        isParticipantWebUiRequiredPath(sample),
        false,
        sample,
      );
    }
    assert.equal(isParticipantWebUiRequiredPath("workspace.publishingPage.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorialPage.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorPanel.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.administration.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.adminPanel.title"), false);
    assert.equal(isParticipantWebUiRequiredPath("workspace.editorialReview.title"), false);
  });

  it("keeps isPublicReader and isParticipant distinct", () => {
    assert.equal(isParticipantWebUiRequiredPath("workspace.home.title"), true);
    assert.equal(isPublicReaderWebUiRequiredPath("workspace.home.title"), false);

    assert.equal(isPublicReaderWebUiRequiredPath("publicHome.hero.title"), true);
    assert.equal(isParticipantWebUiRequiredPath("publicHome.hero.title"), false);

    assert.equal(isPublicReaderWebUiRequiredPath("common.language"), true);
    assert.equal(isParticipantWebUiRequiredPath("common.language"), false);
  });

  it("selectEnglishWebUiMessages('public') is the unique ordinary union", () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const all = collectStringPaths(english);
    const publicPaths = all.filter((pathKey) => isPublicReaderWebUiRequiredPath(pathKey));
    const participantPaths = all.filter((pathKey) => isParticipantWebUiRequiredPath(pathKey));
    const uniqueOrdinary = new Set([...publicPaths, ...participantPaths]);

    const prepared = selectEnglishWebUiMessages("public");
    assert.equal(prepared.publicRequiredKeyCount, publicPaths.length);
    assert.equal(prepared.participantRequiredKeyCount, participantPaths.length);
    assert.equal(prepared.selectedPaths.length, uniqueOrdinary.size);
    assert.ok(prepared.selectedPaths.length > prepared.publicRequiredKeyCount);
    assert.ok(prepared.selectedPaths.length > prepared.participantRequiredKeyCount);
    assert.ok(
      prepared.selectedPaths.length <=
        prepared.publicRequiredKeyCount + prepared.participantRequiredKeyCount,
    );
    assert.ok(prepared.selectedPaths.some((pathKey) => pathKey.startsWith("workspace.home.")));
    assert.ok(prepared.selectedPaths.some((pathKey) => pathKey.startsWith("notifications.")));
    assert.ok(prepared.selectedPaths.some((pathKey) => pathKey.startsWith("publicHome.")));
    assert.ok(
      prepared.selectedPaths.every(
        (pathKey) =>
          isPublicReaderWebUiRequiredPath(pathKey) || isParticipantWebUiRequiredPath(pathKey),
      ),
    );
  });

  it("assessWebUiCatalogReadinessForLocale scope participant for ka", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const participantRequired = collectStringPaths(english).filter((pathKey) =>
      isParticipantWebUiRequiredPath(pathKey),
    );
    assert.ok(participantRequired.length > 0);

    const missing = await assessWebUiCatalogReadinessForLocale({
      locale: "ka",
      scope: "participant",
    });
    assert.equal(missing.dataReady, false);
    assert.equal(missing.requiredKeyCount, participantRequired.length);
    assert.equal(missing.missingKeyCount, participantRequired.length);

    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: english as never,
      sourceNote: "full english mirror for participant assess",
    });
    const ready = await assessWebUiCatalogReadinessForLocale({
      locale: "ka",
      scope: "participant",
    });
    assert.equal(ready.dataReady, true);
    assert.equal(ready.missingKeyCount, 0);
    assert.equal(ready.requiredKeyCount, participantRequired.length);
  });

  it("uk/ar/zh-Hant bundled packs satisfy participant readiness", async () => {
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const pack = loadBundledWebUiMessagePackFromFs(locale);
      assert.ok(pack, locale);
      const readiness = await assessWebUiCatalogReadinessForLocale({
        locale,
        scope: "participant",
      });
      assert.equal(readiness.dataReady, true, locale);
      assert.equal(readiness.missingKeyCount, 0, locale);
    }
  });

  it("15D.1 public assess still works for uk", async () => {
    const readiness = await assessWebUiCatalogReadinessForLocale({ locale: "uk" });
    assert.equal(readiness.dataReady, true);
    assert.equal(readiness.missingKeyCount, 0);
  });

  it("hardcoded chrome consumers use catalog keys, not English literals", () => {
    const authGate = readWeb("features/auth/components/WorkspaceAuthGate.tsx");
    assert.match(authGate, /useTranslations\("workspace\.authGate"\)/);
    assert.match(authGate, /t\("checkingSession"\)/);
    assert.match(authGate, /t\("redirectingToLogin"\)/);
    assert.doesNotMatch(authGate, /Checking your session/);
    assert.doesNotMatch(authGate, /Redirecting to Log in/);

    const memberWorkspace = readWeb("components/member/MemberWorkspace.tsx");
    assert.match(memberWorkspace, /useTranslations\("workspace"\)/);
    assert.match(memberWorkspace, /tWorkspace\("mainNavigation"\)/);
    assert.doesNotMatch(memberWorkspace, /Main workspace navigation/);

    const pwaFeed = readWeb("features/pwa/components/PwaStandaloneInitiativeFeed.tsx");
    assert.match(pwaFeed, /useTranslations\("pwa\.feed"\)/);
    assert.match(pwaFeed, /t\("sectionAria"\)/);
    assert.doesNotMatch(pwaFeed, /["']Initiative feed["']/);

    const proposalActions = readWeb(
      "features/notifications/components/ImplementationCommitmentProposalActions.tsx",
    );
    assert.match(proposalActions, /useTranslations\("notifications"\)/);
    assert.match(proposalActions, /t\("proposalActions\.accept"\)/);
    assert.match(proposalActions, /t\("proposalActions\.decline"\)/);
    assert.doesNotMatch(proposalActions, /["']Accept["']/);
    assert.doesNotMatch(proposalActions, /["']Decline["']/);
  });

  it("formatInitiativeDate / formatDirectConversationActivity accept locale", () => {
    const dates = readWeb("features/initiatives/initiative-lifecycle-labels.ts");
    assert.match(dates, /function formatInitiativeDate\(isoDate: string, locale\?: string\)/);
    assert.match(dates, /toLocaleDateString\(locale/);

    const dm = readWeb("features/direct-messaging/direct-messaging-format.ts");
    assert.match(
      dm,
      /function formatDirectConversationActivity\(isoDate: string, locale\?: string\)/,
    );
    assert.match(dm, /toLocaleTimeString\(locale/);
    assert.match(dm, /toLocaleDateString\(locale/);
  });

  it("resolveNotificationPresentation does not call a provider", () => {
    const src = readWeb("features/notifications/resolve-notification-presentation.ts");
    assert.match(src, /export function resolveNotificationPresentation/);
    assert.doesNotMatch(src, /TranslationProvider|GEMINI_API_KEY|generateContent|fetch\(/);
    assert.match(src, /types\.\$\{notification\.eventType\}\.title/);
  });

  it("pins-config is not referenced from WEB_UI predicates", () => {
    const participantScope = readFileSync(
      join(typesDomain, "participant-web-ui-scope.ts"),
      "utf8",
    );
    const publicScope = readFileSync(join(typesDomain, "public-reader-web-ui-scope.ts"), "utf8");
    const assess = readFileSync(assessModule, "utf8");
    for (const src of [participantScope, publicScope, assess]) {
      assert.doesNotMatch(src, /pins-config|pinsConfig|wdcr-js-map/);
    }
    assert.equal(readRepo("apps/web/public/wdcr-js-map/pins-config.js").length > 0, true);
  });
});
