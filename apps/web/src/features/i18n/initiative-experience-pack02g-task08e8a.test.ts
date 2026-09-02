/**
 * Pack 02G Task 08E.8a — Analysis structured advisory foundation + presentation.
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
import { resolveSidebarAdvisoryDisplay } from "../initiative-lifecycle-stage-workspace/resolve-sidebar-advisory-display.js";
import type { InitiativeSidebarAdvisory } from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract.js";

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

/** Minimal ICU plural for tests: supports `{name, plural, one {...} other {...}}` and `{name}`. */
function formatMessage(
  template: string,
  values: Record<string, string | number | Date> = {},
): string {
  let text = template;
  const pluralRe = /\{(\w+),\s*plural,\s*((?:[a-z0-9=]+\s*\{[^{}]*\}\s*)+)\}/;
  while (pluralRe.test(text)) {
    text = text.replace(pluralRe, (_full, name: string, body: string) => {
      const count = Number(values[name] ?? 0);
      const branches = new Map<string, string>();
      for (const match of body.matchAll(/([a-z0-9=]+)\s*\{([^{}]*)\}/g)) {
        branches.set(match[1]!, match[2]!);
      }
      const picked =
        count === 1 && branches.has("one")
          ? branches.get("one")!
          : (branches.get("other") ?? "");
      return picked.replace(/#/g, String(count));
    });
  }
  for (const [name, value] of Object.entries(values)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

function translatorFor(messages: Record<string, unknown>) {
  return (key: string, values?: Record<string, string | number | Date>) =>
    formatMessage(ieKey(messages, key), values);
}

const ANALYSIS_ADVISORY_KEYS = [
  "author.sidebar.advisories.unknown",
  "author.sidebar.advisories.analysis.sourcesEmpty",
  "author.sidebar.advisories.analysis.sourcesSummary",
  "author.sidebar.advisories.analysis.missingHelpfulSources",
  "author.sidebar.advisories.analysis.missingNotHelpfulSources",
  "author.sidebar.advisories.analysis.missingProposalCandidates",
  "author.sidebar.advisories.analysis.missingOpenQuestions",
  "author.sidebar.advisories.analysis.textOverlapContradiction",
] as const;

describe("Pack 02G Task 08E.8a — Analysis structured advisories", () => {
  it("catalog parity includes author.sidebar.advisories.analysis", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of ANALYSIS_ADVISORY_KEYS) {
        assert.equal(typeof ieKey(loaded.messages, key), "string");
      }
    }
  });

  it("English Analysis advisories resolve via presentation adapter", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    const empty = resolveSidebarAdvisoryDisplay({ code: "analysis.sources.empty" }, t);
    assert.equal(empty.text, "No sources collected yet.");

    const missing = resolveSidebarAdvisoryDisplay(
      { code: "analysis.missing_helpful_sources" },
      t,
    );
    assert.match(missing.text, /Helpful-marked/);

    const summary = resolveSidebarAdvisoryDisplay(
      {
        code: "analysis.sources.summary",
        params: {
          commentCount: 1,
          proposalCount: 2,
          activeAlliesCount: 1,
          readyToCollaborateCount: 3,
        },
      },
      t,
    );
    assert.match(summary.text, /1 Discussion comment/);
    assert.match(summary.text, /2 proposal-marked/);
    assert.match(summary.text, /1 Active Ally/);
    assert.match(summary.text, /3 ready to collaborate/);
  });

  it("Ukrainian / zh-Hant / Arabic resolve without English chrome copy", async () => {
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const t = translatorFor(loaded.messages);
      const text = resolveSidebarAdvisoryDisplay({ code: "analysis.sources.empty" }, t).text;
      assert.notEqual(text, "No sources collected yet.");
      assert.doesNotMatch(text, /No sources collected yet/);
    }
    const uk = await loadUiMessagesForLocale("uk");
    const t = translatorFor(uk.messages);
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "analysis.sources.empty" }, t).text,
      "Джерел ще не зібрано.",
    );
  });

  it("ICU plural syntax is present for Analysis sourcesSummary", async () => {
    for (const locale of ["en", "uk", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.match(
        ieKey(loaded.messages, "author.sidebar.advisories.analysis.sourcesSummary"),
        /\{commentCount,\s*plural/,
      );
    }
  });

  it("civic topic is preserved unchanged inside localized contradiction text", async () => {
    const topic = "водна безпека / water-safety-XYZ";
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const t = translatorFor(loaded.messages);
      const presented = resolveSidebarAdvisoryDisplay(
        {
          code: "analysis.text_overlap_contradiction",
          civic: { subject: topic },
        },
        t,
      );
      assert.match(presented.text, new RegExp(topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.equal(presented.civic?.subject, topic);
    }
  });

  it("unknown-code defensive fallback localizes and includes raw code", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const t = translatorFor(uk.messages);
    const weird: InitiativeSidebarAdvisory = { code: "analysis.not_a_real_code" };
    const presented = resolveSidebarAdvisoryDisplay(weird, t);
    assert.match(presented.text, /analysis\.not_a_real_code/);
    assert.doesNotMatch(presented.text, /Unrecognized advisory/);
    assert.match(presented.text, /Нерозпізнана порада/);
  });

  it("Analysis derive has no English advisory sentence contract and no next-intl", () => {
    const derive = readWeb(
      "features/initiative-collaborative-analysis/derive-ai-assistant-insights.ts",
    );
    assert.doesNotMatch(derive, /next-intl/);
    assert.doesNotMatch(derive, /useTranslations/);
    assert.doesNotMatch(derive, /No Helpful-marked comments/);
    assert.doesNotMatch(derive, /No sources collected yet/);
    assert.doesNotMatch(derive, /ready to collaborate/);
    assert.match(derive, /analysis\.sources\.summary/);
    assert.match(derive, /analysis\.missing_helpful_sources/);
    assert.match(derive, /AnalysisSidebarAdvisory/);
  });

  it("Analysis Working Sidebar resolves descriptors at presentation boundary", () => {
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    const start = sidebar.indexOf("function AnalysisAiAssistantContent");
    const end = sidebar.indexOf("function ProposalAiAssistantSlot");
    assert.ok(start >= 0 && end > start);
    const analysisBlock = sidebar.slice(start, end);
    assert.match(analysisBlock, /resolveSidebarAdvisoryDisplay\(insights\.sourcesSummary/);
    assert.match(analysisBlock, /resolveSidebarAdvisoryDisplay\(item,\s*t\)/);
    assert.match(analysisBlock, /author\.sidebar\.insights\.missingEvidence/);
    assert.match(analysisBlock, /author\.sidebar\.insights\.proposalCoverageSummary/);
    assert.doesNotMatch(analysisBlock, /sourcesUsedSummary/);
    assert.doesNotMatch(analysisBlock, /item\.topic/);
    assert.doesNotMatch(analysisBlock, /contradictionNote/);
  });

  it("08E.7 insights chrome remains separate from advisories subtree", async () => {
    const en = await loadUiMessagesForLocale("en");
    assert.equal(typeof ieKey(en.messages, "author.sidebar.insights.missingEvidence"), "string");
    assert.equal(
      typeof ieKey(en.messages, "author.sidebar.advisories.analysis.missingHelpfulSources"),
      "string",
    );
    assert.notEqual(
      ieKey(en.messages, "author.sidebar.insights.missingEvidence"),
      ieKey(en.messages, "author.sidebar.advisories.analysis.missingHelpfulSources"),
    );
  });

  it("Proposal derive/render remains legacy English advisory encoding", () => {
    const proposal = readWeb(
      "features/initiative-improvement-proposals-stage/derive-proposal-ai-assistant-insights.ts",
    );
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    assert.match(proposal, /No proposal-marked comments collected yet/);
    assert.match(proposal, /Complete missing fields before deciding/);
    assert.match(sidebar, /deriveProposalAiAssistantInsights/);
    assert.match(sidebar, /insights\.sourcesUsedSummary/);
    assert.doesNotMatch(proposal, /AnalysisSidebarAdvisory/);
    assert.doesNotMatch(proposal, /author\.sidebar\.advisories/);
  });

  it("later-stage derive modules remain untouched English banks", () => {
    const files = [
      "features/initiative-version-revision/derive-revision-ai-assistant-insights.ts",
      "features/initiative-petition-lifecycle/derive-petition-ai-assistant-insights.ts",
      "features/initiative-decision-session-lifecycle/derive-decision-session-ai-assistant-insights.ts",
      "features/initiative-collective-decision-lifecycle/derive-collective-decision-ai-assistant-insights.ts",
      "features/initiative-implementation-commitment-lifecycle/derive-implementation-commitment-ai-assistant-insights.ts",
      "features/initiative-implementation-tracking-lifecycle/derive-implementation-tracking-ai-assistant-insights.ts",
      "features/initiative-official-response-lifecycle/derive-official-response-ai-assistant-insights.ts",
      "features/initiative-public-impact-lifecycle/derive-public-impact-ai-assistant-insights.ts",
      "features/initiative-civic-archive-lifecycle/derive-civic-archive-ai-assistant-insights.ts",
    ];
    for (const relative of files) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /AnalysisSidebarAdvisory/);
      assert.doesNotMatch(source, /author\.sidebar\.advisories/);
      assert.doesNotMatch(source, /next-intl/);
    }
  });

  it("missing advisories.analysis.sourcesEmpty fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        author?: { sidebar?: { advisories?: { analysis?: { sourcesEmpty?: string } } } };
      }
    ).author?.sidebar?.advisories?.analysis?.sourcesEmpty;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes(
          "initiativeExperience.author.sidebar.advisories.analysis.sourcesEmpty",
        ),
      ),
    );
  });
});
