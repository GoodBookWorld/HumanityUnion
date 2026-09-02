/**
 * Pack 02G Task 08E.7 — Working Sidebar AI/insight chrome localization.
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
import { resolveInitiativeExperienceMessage } from "../public-initiative-experience/initiative-experience-i18n.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function ieKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, key);
  assert.ok(value, `missing initiativeExperience.${key}`);
  return value;
}

const DERIVE_MODULES = [
  "features/initiative-collaborative-analysis/derive-ai-assistant-insights.ts",
  "features/initiative-improvement-proposals-stage/derive-proposal-ai-assistant-insights.ts",
  "features/initiative-version-revision/derive-revision-ai-assistant-insights.ts",
  "features/initiative-petition-lifecycle/derive-petition-ai-assistant-insights.ts",
  "features/initiative-decision-session-lifecycle/derive-decision-session-ai-assistant-insights.ts",
  "features/initiative-collective-decision-lifecycle/derive-collective-decision-ai-assistant-insights.ts",
  "features/initiative-implementation-commitment-lifecycle/derive-implementation-commitment-ai-assistant-insights.ts",
  "features/initiative-implementation-tracking-lifecycle/derive-implementation-tracking-ai-assistant-insights.ts",
  "features/initiative-official-response-lifecycle/derive-official-response-ai-assistant-insights.ts",
  "features/initiative-public-impact-lifecycle/derive-public-impact-ai-assistant-insights.ts",
  "features/initiative-civic-archive-lifecycle/derive-civic-archive-ai-assistant-insights.ts",
] as const;

const INSIGHT_CHROME_KEYS = [
  "author.sidebar.insights.missingEvidence",
  "author.sidebar.insights.emptyNoEvidenceGaps",
  "author.sidebar.insights.possibleDuplicates",
  "author.sidebar.insights.neverPublishesAutomatically",
  "author.sidebar.insights.proposalCoverageSummary",
  "author.sidebar.insights.emptyNoClarity",
  "author.sidebar.insights.advisoryCannotPublish",
] as const;

describe("Pack 02G Task 08E.7 — Working Sidebar AI insight chrome", () => {
  it("catalog parity includes author.sidebar.insights", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of INSIGHT_CHROME_KEYS) {
        assert.equal(typeof ieKey(loaded.messages, key), "string");
      }
      assert.match(ieKey(loaded.messages, "author.sidebar.insights.proposalCoverageSummary"), /\{proposalCount\}/);
      assert.match(ieKey(loaded.messages, "author.sidebar.insights.helpfulCount"), /\{count\}/);
    }
  });

  it("Ukrainian insight headings / empty / action chrome resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(ieKey(uk.messages, "author.sidebar.insights.missingEvidence"), "Бракує доказів");
    assert.equal(
      ieKey(uk.messages, "author.sidebar.insights.emptyNoEvidenceGaps"),
      "Прогалин у доказах не виявлено.",
    );
    assert.equal(ieKey(uk.messages, "author.sidebar.sourcesUsed"), "Використані джерела");
    assert.equal(ieKey(uk.messages, "author.sidebar.noneIdentified"), "Поки не виявлено.");
    assert.equal(ieKey(uk.messages, "author.sidebar.askAssistant"), "Запитати помічника");
    assert.equal(ieKey(uk.messages, "author.sidebar.loading"), "Завантаження…");
    assert.doesNotMatch(ieKey(uk.messages, "author.sidebar.insights.missingEvidence"), /Missing Evidence/);
    assert.doesNotMatch(ieKey(uk.messages, "author.sidebar.insights.emptyNoEvidenceGaps"), /No evidence/);
  });

  it("uk/zh-Hant/ar insight chrome is not accidental English UI", async () => {
    const englishMarkers = [
      "Missing Evidence",
      "No evidence gaps identified.",
      "Possible Duplicates to Merge",
      "Assistant never publishes automatically",
      "Working…",
    ];
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of [
        "author.sidebar.insights.missingEvidence",
        "author.sidebar.insights.emptyNoEvidenceGaps",
        "author.sidebar.insights.possibleDuplicates",
        "author.sidebar.insights.neverPublishesAutomatically",
      ] as const) {
        const value = ieKey(loaded.messages, key);
        for (const marker of englishMarkers) {
          assert.notEqual(value, marker, `${locale} ${key}`);
          assert.doesNotMatch(value, new RegExp(`^${marker}`));
        }
      }
    }
  });

  it("Working Sidebar wires insight chrome keys; derive content stays data-bound", () => {
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    assert.match(sidebar, /author\.sidebar\.insights\.missingEvidence/);
    assert.match(sidebar, /author\.sidebar\.insights\.emptyNoEvidenceGaps/);
    assert.match(sidebar, /author\.sidebar\.insights\.neverPublishesAutomatically/);
    assert.match(sidebar, /author\.sidebar\.sourcesUsed/);
    assert.match(sidebar, /author\.sidebar\.noneIdentified/);
    assert.doesNotMatch(sidebar, /<h4>Missing Evidence<\/h4>/);
    assert.doesNotMatch(sidebar, /<h4>Sources Used<\/h4>/);
    assert.doesNotMatch(sidebar, /No evidence gaps identified\./);

    assert.match(sidebar, /resolveSidebarAdvisoryDisplay/);
    assert.match(sidebar, /insights\.sourcesSummary/);
    assert.match(sidebar, /item\.excerpt/);
    assert.match(sidebar, /warning\.message/);
    assert.match(sidebar, /entry\.rationale/);
    assert.match(sidebar, /insights\.clarityWarnings\.map/);
    assert.doesNotMatch(sidebar, /t\(".*sourcesUsedSummary/);
    assert.doesNotMatch(sidebar, /t\(".*rationale/);
  });

  it("derive-* modules remain untouched by next-intl", () => {
    for (const relative of DERIVE_MODULES) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /next-intl/);
      assert.doesNotMatch(source, /useTranslations/);
      assert.doesNotMatch(source, /author\.sidebar\.insights/);
      assert.doesNotMatch(source, /author\.sidebar\.advisories/);
    }
  });

  it("Assistant integration reuses askAssistant and active OpenButton path", () => {
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    assert.match(sidebar, /HumanityUnionAssistantOpenButton/);
    assert.match(sidebar, /author\.sidebar\.askAssistant/);
    assert.doesNotMatch(sidebar, /LifecycleAiAssistantModal/);
    assert.doesNotMatch(sidebar, /assistant\.modal\.title/);
  });

  it("no stable-code English replaceAll / sentence-matching localization introduced", () => {
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    // Existing suggestion underscore display remains local to derived suggestion codes — not a new localization table.
    assert.match(sidebar, /entry\.suggestion\.replace\(\/_\/g,\s*" "\)/);
    assert.doesNotMatch(sidebar, /messageMap/);
    assert.doesNotMatch(sidebar, /if \(raw === "/);
    assert.doesNotMatch(sidebar, /Error\.message\.includes/);
  });

  it("layout resilience markers for insight chrome", () => {
    const ica = readWeb(
      "features/initiative-collaborative-analysis/components/initiative-collaborative-analysis-workspace.css",
    );
    const iip = readWeb(
      "features/initiative-improvement-proposals-stage/components/initiative-improvement-proposals-stage-workspace.css",
    );
    assert.match(ica, /\.ica-ai-assistant\s*\{[^}]*min-width:\s*0/s);
    assert.match(ica, /\.ica-ai-assistant__group h4\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(iip, /\.iip-ai-assistant\s*\{[^}]*min-width:\s*0/s);
    assert.match(iip, /\.iip-ai-assistant__group ul\s*\{[^}]*padding-inline-start:/s);
  });

  it("missing author.sidebar.insights.missingEvidence fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        author?: { sidebar?: { insights?: { missingEvidence?: string } } };
      }
    ).author?.sidebar?.insights?.missingEvidence;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.author.sidebar.insights.missingEvidence"),
      ),
    );
  });
});
