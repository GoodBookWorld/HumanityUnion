/**
 * Workspace Home + Single Initiative visible localization — focused contract tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isPartialTranslatedFieldBag } from "../language/resolve-localized-presentation.js";
import { resolveInitiativeDetailPresentation } from "../public-initiative-experience/resolve-initiative-detail-presentation.js";
import {
  resolveWorkspaceActivityEventLabel,
  resolveWorkspaceQuickActionLabel,
  resolveWorkspaceReadinessMissingLabel,
} from "./workspace-home-i18n.js";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "../..");
const apiSrc = join(webSrc, "../../api/src");

function read(rel: string): string {
  return readFileSync(join(webSrc, rel), "utf8");
}

function messages(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(webSrc, `features/i18n/messages/${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

function tFromCatalog(
  catalog: Record<string, unknown>,
  namespace: string,
): (key: string, values?: Record<string, string | number | Date>) => string {
  const ns = catalog[namespace] as Record<string, unknown>;
  return (key, values) => {
    const parts = key.split(".");
    let cur: unknown = ns;
    for (const part of parts) {
      if (!cur || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[part];
    }
    if (typeof cur !== "string") return key;
    if (!values) return cur;
    return cur.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
  };
}

describe("Workspace Home + Initiative visible localization", () => {
  it("1. Workspace Home stable API codes map to WEB_UI for a non-English fixture locale", () => {
    const uk = messages("uk");
    const tWorkspace = tFromCatalog(uk, "workspace");
    const tCivic = tFromCatalog(uk, "civicActivity");

    assert.equal(
      resolveWorkspaceQuickActionLabel(tWorkspace, "create-initiative"),
      tWorkspace("home.quickActions.create-initiative"),
    );
    assert.equal(
      resolveWorkspaceActivityEventLabel(tWorkspace, tCivic, "initiative_created"),
      tCivic("timeline.events.initiative_created"),
    );
    assert.equal(
      resolveWorkspaceReadinessMissingLabel(tWorkspace, "email_verification"),
      tWorkspace("home.readiness.email_verification"),
    );

    const timeline = readFileSync(
      join(apiSrc, "modules/workspace-home/workspace-home-timeline.ts"),
      "utf8",
    );
    assert.match(timeline, /label:\s*"initiative_created"/);
    assert.doesNotMatch(timeline, /label:\s*"Initiative created"/);
  });

  it("2. Workspace Home chrome uses next-intl keys (not hardcoded English section titles)", () => {
    const dashboard = read(
      "features/workspace-home/components/WorkspaceHomeDashboard.tsx",
    );
    assert.match(dashboard, /useTranslations\("workspace"\)/);
    assert.match(dashboard, /home\.quickActionsTitle/);
    assert.match(dashboard, /home\.recentActivityTitle/);
    assert.doesNotMatch(dashboard, /title="Quick Actions"/);
    assert.doesNotMatch(dashboard, /title="My Recent Activity"/);

    const welcome = read(
      "features/workspace-home/components/WorkspaceWelcomeBanner.tsx",
    );
    assert.match(welcome, /home\.welcomeTitle/);
    assert.doesNotMatch(welcome, /Welcome to Humanity Union/);

    const header = read(
      "features/workspace-home/components/WorkspacePersonalHeader.tsx",
    );
    assert.match(header, /home\.currentWorkspace/);
    assert.match(header, /home\.logout/);
  });

  it("3. Partial Initiative CT bag → complete canonical title + description", async () => {
    const result = await resolveInitiativeDetailPresentation(
      {
        initiativeId: "init-partial",
        canonical: {
          title: "Canonical Title",
          description: "Canonical Description",
        },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "prefer_translated",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "preferred_translation",
          content: { title: "Локалізована назва", description: "" },
          originalContent: {
            title: "Canonical Title",
            description: "Canonical Description",
          },
          translation: null,
          activeLanguage: "uk",
          originalLanguage: "en",
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: true,
        }),
        generateContentTranslation: async () => {
          throw new Error("provider must not run on read");
        },
      },
    );

    assert.equal(result.presentationMode, "original");
    assert.equal(result.title, "Canonical Title");
    assert.equal(result.description, "Canonical Description");
  });

  it("3b. Fully empty Initiative CT bag → complete canonical fallback (non-translated mode)", async () => {
    const result = await resolveInitiativeDetailPresentation(
      {
        initiativeId: "init-empty",
        canonical: {
          title: "Canonical Title",
          description: "Canonical Description",
        },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "prefer_translated",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "preferred_translation",
          content: { title: "", description: "   " },
          originalContent: {
            title: "Canonical Title",
            description: "Canonical Description",
          },
          translation: null,
          activeLanguage: "uk",
          originalLanguage: "en",
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: true,
        }),
        generateContentTranslation: async () => {
          throw new Error("provider must not run on read");
        },
      },
    );

    assert.equal(result.presentationMode, "original");
    assert.equal(result.title, "Canonical Title");
    assert.equal(result.description, "Canonical Description");
  });

  it("4. Complete Initiative CT bag → complete localized title + description", async () => {
    const result = await resolveInitiativeDetailPresentation(
      {
        initiativeId: "init-complete",
        canonical: {
          title: "Canonical Title",
          description: "Canonical Description",
        },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "prefer_translated",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "preferred_translation",
          content: {
            title: "Локалізована назва",
            description: "Локалізований опис",
          },
          originalContent: {
            title: "Canonical Title",
            description: "Canonical Description",
          },
          translation: null,
          activeLanguage: "uk",
          originalLanguage: "en",
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: true,
        }),
        generateContentTranslation: async () => {
          throw new Error("provider must not run on read");
        },
      },
    );

    assert.equal(result.presentationMode, "translated");
    assert.equal(result.title, "Локалізована назва");
    assert.equal(result.description, "Локалізований опис");
  });

  it("5. Share presentation uses resolved Initiative localized representation", () => {
    const center = read(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    const page = read(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(page, /presentationTitle=\{initiativePresentation\.title\}/);
    assert.match(
      page,
      /presentationDescription=\{initiativePresentation\.description\}/,
    );
    assert.match(center, /presentationTitle\?\.trim\(\)/);
    assert.match(center, /buildPublicInitiativeSharePayload/);
  });

  it("6. Initiative synthetic/transparency chrome resolves through WEB_UI", () => {
    const support = read(
      "features/public-initiative-experience/components/PublicInitiativeSupportStatistics.tsx",
    );
    assert.match(support, /t\("sidebar\.support\.transparencyNote"\)/);
    assert.doesNotMatch(
      support,
      /statistics\.transparencyNote\?\.trim\(\)\s*\|\|/,
    );

    const card = read(
      "features/public-initiative-experience/components/LifecycleTranslatedRecordCard.tsx",
    );
    assert.match(card, /lifecycleRecordSummaries\.published_proposals_count/);
    assert.match(card, /common\.versionN/);

    const en = messages("en");
    const ie = en.initiativeExperience as Record<string, unknown>;
    assert.ok(
      (ie.lifecycleRecordSummaries as Record<string, string>)
        .published_proposals_count,
    );
    assert.equal((ie.statuses as Record<string, string>).current, "Current");
    assert.ok(isPartialTranslatedFieldBag({
      canonicalFields: { title: "a", description: "b" },
      translatedFields: { title: "а", description: "" },
    }));
  });
});
