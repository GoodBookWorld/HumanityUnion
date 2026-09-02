/**
 * Pack 02G Task 08E.8b — Proposal structured advisory presentation + regression.
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
import {
  formatProposalSidebarFieldLabels,
  resolveProposalSidebarFieldDisplayLabel,
  resolveProposalTreatmentSuggestionDisplayLabel,
  resolveSidebarAdvisoryDisplay,
} from "../initiative-lifecycle-stage-workspace/resolve-sidebar-advisory-display.js";
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

const PROPOSAL_ADVISORY_KEYS = [
  "author.sidebar.advisories.proposal.sourcesEmpty",
  "author.sidebar.advisories.proposal.sourcesSummary",
  "author.sidebar.advisories.proposal.rationaleReviewIncomplete",
  "author.sidebar.advisories.proposal.rationaleAcceptClear",
  "author.sidebar.advisories.proposal.rationalePartiallyAcceptLimited",
  "author.sidebar.advisories.proposal.rationaleDeclineLimited",
  "author.sidebar.advisories.proposal.treatments.review",
] as const;

const LEGACY_DERIVE_MODULES = [
  "features/initiative-implementation-commitment-lifecycle/derive-implementation-commitment-ai-assistant-insights.ts",
  "features/initiative-implementation-tracking-lifecycle/derive-implementation-tracking-ai-assistant-insights.ts",
  "features/initiative-official-response-lifecycle/derive-official-response-ai-assistant-insights.ts",
  "features/initiative-public-impact-lifecycle/derive-public-impact-ai-assistant-insights.ts",
  "features/initiative-civic-archive-lifecycle/derive-civic-archive-ai-assistant-insights.ts",
] as const;

describe("Pack 02G Task 08E.8b — Proposal structured advisories", () => {
  it("catalog parity includes author.sidebar.advisories.proposal", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of PROPOSAL_ADVISORY_KEYS) {
        assert.equal(typeof ieKey(loaded.messages, key), "string");
      }
    }
  });

  it("English Proposal advisories resolve via presentation adapter", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);

    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "proposal.sources.empty" }, t).text,
      "No proposal-marked comments collected yet. You can still confirm the Initiative version with zero proposals.",
    );

    const summary = resolveSidebarAdvisoryDisplay(
      {
        code: "proposal.sources.summary",
        params: { candidateCount: 1, groupCount: 2, duplicateGroupCount: 1 },
      },
      t,
    );
    assert.match(summary.text, /1 proposal-marked comment/);
    assert.match(summary.text, /2 groups/);
    assert.match(summary.text, /1 likely duplicate/);

    const incomplete = resolveSidebarAdvisoryDisplay(
      {
        code: "proposal.treatment.rationale.review_incomplete",
        civic: { fieldIds: ["title", "reason"] },
      },
      t,
    );
    assert.equal(incomplete.text, "Complete missing fields before deciding: Title, Reason.");
    assert.deepEqual(incomplete.civic?.fieldIds, ["title", "reason"]);
  });

  it("uk / zh-Hant / ar resolve Proposal advisories without English sourcesEmpty copy", async () => {
    const english =
      "No proposal-marked comments collected yet. You can still confirm the Initiative version with zero proposals.";
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const t = translatorFor(loaded.messages);
      const text = resolveSidebarAdvisoryDisplay({ code: "proposal.sources.empty" }, t).text;
      assert.notEqual(text, english);
      assert.doesNotMatch(text, /No proposal-marked comments collected yet/);
    }
  });

  it("ICU plural syntax is present for Proposal sourcesSummary", async () => {
    for (const locale of ["en", "uk", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.match(
        ieKey(loaded.messages, "author.sidebar.advisories.proposal.sourcesSummary"),
        /\{candidateCount,\s*plural/,
      );
    }
  });

  it("canonical field ID maps to localized label; unknown falls back to raw ID", async () => {
    const en = await loadUiMessagesForLocale("en");
    const uk = await loadUiMessagesForLocale("uk");
    const tEn = translatorFor(en.messages);
    const tUk = translatorFor(uk.messages);

    assert.equal(resolveProposalSidebarFieldDisplayLabel("title", tEn), "Title");
    assert.equal(resolveProposalSidebarFieldDisplayLabel("expectedImprovement", tEn), "Expected Improvement");
    assert.equal(resolveProposalSidebarFieldDisplayLabel("not_a_field", tEn), "not_a_field");
    assert.notEqual(resolveProposalSidebarFieldDisplayLabel("title", tUk), "Title");
    assert.equal(
      formatProposalSidebarFieldLabels(["title", "summary"], tEn),
      "Title, Summary",
    );
  });

  it("treatment codes map to display labels; unknown returns raw code", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(resolveProposalTreatmentSuggestionDisplayLabel("accept", t), "Accept");
    assert.equal(
      resolveProposalTreatmentSuggestionDisplayLabel("partially_accept", t),
      "Partially accept",
    );
    assert.equal(resolveProposalTreatmentSuggestionDisplayLabel("decline", t), "Decline");
    assert.equal(resolveProposalTreatmentSuggestionDisplayLabel("review", t), "Review");
    assert.equal(
      resolveProposalTreatmentSuggestionDisplayLabel("weird_code", t),
      "weird_code",
    );
  });

  it("civic Proposal title is not a catalog key and remains unchanged when passed as data", async () => {
    const title = "Фільтри біля вокзалу / filters-XYZ";
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(resolveInitiativeExperienceMessage(loaded.messages, title), undefined);
    }
  });

  it("Analysis resolver path remains unchanged for analysis codes", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "analysis.sources.empty" }, t).text,
      "No sources collected yet.",
    );
  });

  it("unknown advisory code fallback remains deterministic", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const t = translatorFor(uk.messages);
    const weird: InitiativeSidebarAdvisory = { code: "proposal.not_a_real_code" };
    const presented = resolveSidebarAdvisoryDisplay(weird, t);
    assert.match(presented.text, /proposal\.not_a_real_code/);
    assert.match(presented.text, /Нерозпізнана порада/);
  });

  it("Proposal derive has no English advisory sentence contract and no next-intl", () => {
    const derive = readWeb(
      "features/initiative-improvement-proposals-stage/derive-proposal-ai-assistant-insights.ts",
    );
    assert.doesNotMatch(derive, /next-intl/);
    assert.doesNotMatch(derive, /useTranslations/);
    assert.doesNotMatch(derive, /No proposal-marked comments collected yet/);
    assert.doesNotMatch(derive, /Complete missing fields before deciding/);
    assert.doesNotMatch(derive, /Clear reason and expected improvement/);
    assert.doesNotMatch(derive, /"Title"/);
    assert.doesNotMatch(derive, /sourcesUsedSummary/);
    assert.match(derive, /proposal\.sources\.summary/);
    assert.match(derive, /proposal\.treatment\.rationale\.review_incomplete/);
    assert.match(derive, /ProposalSidebarAdvisory/);
    assert.match(derive, /PROPOSAL_SIDEBAR_FIELD_IDS/);
  });

  it("Proposal Working Sidebar resolves descriptors and does not underscore-replace suggestions", () => {
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    const start = sidebar.indexOf("function ProposalAiAssistantContent");
    const end = sidebar.indexOf("function RevisionAiAssistantSlot");
    assert.ok(start >= 0 && end > start);
    const proposalBlock = sidebar.slice(start, end);
    assert.match(proposalBlock, /resolveSidebarAdvisoryDisplay\(insights\.sourcesSummary/);
    assert.match(proposalBlock, /formatProposalSidebarFieldLabels\(missingFields/);
    assert.match(
      proposalBlock,
      /resolveProposalTreatmentSuggestionDisplayLabel\(entry\.suggestion/,
    );
    assert.match(proposalBlock, /resolveSidebarAdvisoryDisplay\(entry\.rationale/);
    assert.doesNotMatch(proposalBlock, /sourcesUsedSummary/);
    assert.doesNotMatch(proposalBlock, /suggestion\.replace\(\/_\/g/);
    assert.doesNotMatch(proposalBlock, /entry\.rationale\}/);
  });

  it("08E.7 insights chrome remains separate from advisories.proposal", async () => {
    const en = await loadUiMessagesForLocale("en");
    assert.equal(typeof ieKey(en.messages, "author.sidebar.insights.possibleDuplicates"), "string");
    assert.equal(
      typeof ieKey(en.messages, "author.sidebar.advisories.proposal.sourcesEmpty"),
      "string",
    );
    assert.notEqual(
      ieKey(en.messages, "author.sidebar.insights.possibleDuplicates"),
      ieKey(en.messages, "author.sidebar.advisories.proposal.sourcesEmpty"),
    );
  });

  it("Analysis remains descriptor-based; Commitment → Archive remain legacy English banks", () => {
    const analysis = readWeb(
      "features/initiative-collaborative-analysis/derive-ai-assistant-insights.ts",
    );
    assert.match(analysis, /AnalysisSidebarAdvisory/);
    assert.match(analysis, /analysis\.sources\.summary/);

    for (const relative of LEGACY_DERIVE_MODULES) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /ProposalSidebarAdvisory/);
      assert.doesNotMatch(source, /author\.sidebar\.advisories/);
      assert.doesNotMatch(source, /next-intl/);
      assert.match(source, /sourcesUsedSummary/);
    }
  });

  it("missing advisories.proposal.sourcesEmpty fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        author?: { sidebar?: { advisories?: { proposal?: { sourcesEmpty?: string } } } };
      }
    ).author?.sidebar?.advisories?.proposal?.sourcesEmpty;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes(
          "initiativeExperience.author.sidebar.advisories.proposal.sourcesEmpty",
        ),
      ),
    );
  });
});
