/**
 * Pack 02G Task 08C.1 — Initiative Experience public sidebar widget i18n.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  formatInitiativeExperienceDate,
  resolveInitiativeExperienceMessage,
  resolveLifecycleStageDisplayLabel,
} from "../public-initiative-experience/initiative-experience-i18n.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function sidebarKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, `sidebar.${key}`);
  assert.ok(value, `missing sidebar.${key}`);
  return value;
}

describe("Pack 02G Task 08C.1 — Initiative Experience sidebar i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes initiativeExperience.sidebar", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.ok(loaded.messages.initiativeExperience);
      assert.equal(typeof sidebarKey(loaded.messages, "support.title"), "string");
      assert.equal(typeof sidebarKey(loaded.messages, "participation.title"), "string");
      assert.equal(typeof sidebarKey(loaded.messages, "revisions.title"), "string");
      assert.equal(typeof sidebarKey(loaded.messages, "allies.count"), "string");
    }
  });

  it("Ukrainian sidebar headings/actions/states resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(sidebarKey(uk.messages, "support.title"), "Підтримка ініціативи");
    assert.equal(sidebarKey(uk.messages, "support.support"), "Підтримати");
    assert.equal(sidebarKey(uk.messages, "support.doNotSupport"), "Не підтримувати");
    assert.equal(sidebarKey(uk.messages, "participation.title"), "Ваша участь");
    assert.equal(sidebarKey(uk.messages, "revisions.title"), "Історія редакцій");
    assert.equal(sidebarKey(uk.messages, "revisions.viewAll"), "Переглянути всі редакції");
    assert.equal(sidebarKey(uk.messages, "allies.title"), "Активні союзники");
    assert.equal(sidebarKey(uk.messages, "related.title"), "Пов’язані ініціативи");
    assert.equal(sidebarKey(uk.messages, "latest.title"), "Останні ініціативи");
    assert.equal(sidebarKey(uk.messages, "election.viewElection"), "Переглянути вибори");
  });

  it("count/plural catalog entries use ICU plural, not English concatenation in widgets", () => {
    const allies = readWeb(
      "features/initiative-active-allies/components/InitiativeActiveAlliesWidget.tsx",
    );
    const related = readWeb(
      "features/community-intelligence/components/RelatedInitiativesWidget.tsx",
    );
    assert.match(allies, /sidebar\.allies\.count/);
    assert.doesNotMatch(allies, /active \$\{|Ally" : "Allies/);
    assert.doesNotMatch(allies, /activeAlliesCount === 1/);
    assert.match(related, /sidebar\.related\.overlappingThemes/);
  });

  it("Ukrainian plural message shapes are ICU (not English-only branches)", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const alliesCount = sidebarKey(uk.messages, "allies.count");
    const themes = sidebarKey(uk.messages, "related.overlappingThemes");
    assert.match(alliesCount, /\{count,\s*plural/);
    assert.match(themes, /\{count,\s*plural/);
    assert.doesNotMatch(alliesCount, /active Ally/);
  });

  it("revision/version presentation reuses common.versionN and locale-aware dates", () => {
    const revisions = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeRevisionHistory.tsx",
    );
    assert.match(revisions, /common\.versionN/);
    assert.match(revisions, /common\.currentSuffix/);
    assert.match(revisions, /sidebar\.revisions\.originalSuffix/);
    assert.match(revisions, /formatInitiativeExperienceDate/);
    assert.doesNotMatch(revisions, /Version \$\{/);
    assert.doesNotMatch(revisions, /toLocaleDateString\(undefined/);

    const en = formatInitiativeExperienceDate("en", "2024-06-15T12:00:00.000Z", {
      month: "short",
    });
    const uk = formatInitiativeExperienceDate("uk", "2024-06-15T12:00:00.000Z", {
      month: "short",
    });
    assert.match(en, /2024/);
    assert.match(uk, /2024/);
    assert.notEqual(en, uk);
  });

  it("canonical participant/revision/domain values stay unbound from catalogs", () => {
    const participation = readWeb(
      "features/public-initiative-experience/components/YourParticipationPanel.tsx",
    );
    const revisions = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeRevisionHistory.tsx",
    );
    const allies = readWeb(
      "features/initiative-active-allies/components/InitiativeActiveAlliesWidget.tsx",
    );
    const support = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeSupportStatistics.tsx",
    );

    assert.match(participation, /action\.statusLabel/);
    assert.match(participation, /journey\.nextAction\.label/);
    assert.match(participation, /resolveLifecycleStageDisplayLabel/);
    assert.match(revisions, /revision\.revisionSummary/);
    assert.match(revisions, /revision\.revisionId/);
    assert.match(allies, /entry\.displayName/);
    assert.match(support, /breakdown\.total/);
    assert.match(support, /statistics\.bookmarks\.total/);
    assert.doesNotMatch(participation, /value=\{t\(/);
  });

  it("accessible names use sidebar catalog keys", () => {
    const support = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeSupportStatistics.tsx",
    );
    const allies = readWeb(
      "features/initiative-active-allies/components/InitiativeActiveAlliesWidget.tsx",
    );
    const election = readWeb(
      "features/public-initiative-experience/components/PublicChoiceElectionSidebarWidget.tsx",
    );
    assert.match(support, /sidebar\.support\.supportAria/);
    assert.match(support, /sidebar\.support\.doNotSupportAria/);
    assert.doesNotMatch(support, /aria-label="Support this initiative"/);
    assert.match(allies, /sidebar\.allies\.messageAria/);
    assert.match(allies, /sidebar\.allies\.listAria/);
    assert.doesNotMatch(allies, /aria-label=\{`Message /);
    assert.match(election, /sidebar\.election\.resultsAria/);
  });

  it("layout-sensitive sidebar chrome allows wrapping", () => {
    const pieCss = readWeb(
      "features/public-initiative-experience/public-initiative-experience.css",
    );
    const alliesCss = readWeb(
      "features/initiative-active-allies/components/initiative-active-allies-widget.css",
    );
    assert.match(pieCss, /\.pie-revisions__header[\s\S]*flex-wrap:\s*wrap/);
    assert.match(pieCss, /\.pie-support__signal[\s\S]*white-space:\s*normal/);
    assert.match(alliesCss, /\.iaa-widget__count[\s\S]*white-space:\s*normal/);
  });

  it("no runtime Gemini/UI translation in sidebar widgets", () => {
    const files = [
      "features/public-initiative-experience/components/PublicInitiativeSupportStatistics.tsx",
      "features/public-initiative-experience/components/YourParticipationPanel.tsx",
      "features/public-initiative-experience/components/PublicInitiativeRevisionHistory.tsx",
      "features/initiative-active-allies/components/InitiativeActiveAlliesWidget.tsx",
      "features/community-intelligence/components/RelatedInitiativesWidget.tsx",
      "features/public-initiative-experience/components/PublicInitiativeLatestInitiatives.tsx",
      "features/public-initiative-experience/components/PublicChoiceElectionSidebarWidget.tsx",
    ];
    for (const file of files) {
      const source = readWeb(file);
      assert.doesNotMatch(source, /gemini/i);
      assert.doesNotMatch(source, /translateUi/i);
      assert.match(source, /useTranslations\("initiativeExperience"\)/);
    }
  });

  it("missing sidebar key fails raw catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (uk.initiativeExperience as { sidebar?: { support?: { title?: string } } }).sidebar
      ?.support?.title;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.sidebar.support.title"),
      ),
    );
  });

  it("stage display localization remains available for participation meta", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(resolveLifecycleStageDisplayLabel("petition", uk.messages), "Петиція");
  });
});
