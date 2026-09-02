/**
 * Pack 02G Task 08E.8c — Revision + Petition structured advisory presentation + regression.
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
  resolvePetitionSidebarFieldDisplayLabel,
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

const REVISION_KEYS = [
  "author.sidebar.advisories.revision.sourcesEmpty",
  "author.sidebar.advisories.revision.sourcesSummary",
  "author.sidebar.advisories.revision.alignmentWithAnalysis",
  "author.sidebar.advisories.revision.alignmentNoAnalysis",
] as const;

const PETITION_KEYS = [
  "author.sidebar.advisories.petition.sourcesEmpty",
  "author.sidebar.advisories.petition.sourcesSummary",
  "author.sidebar.advisories.petition.alignmentWithAnalysis",
  "author.sidebar.advisories.petition.alignmentNoAnalysis",
  "author.sidebar.advisories.petition.clarityTitleEmpty",
  "author.sidebar.advisories.petition.clarityRequestStatementShort",
  "author.sidebar.advisories.petition.clarityExpectedOutcomeEmpty",
  "author.sidebar.advisories.petition.contextSupportingContextEmpty",
  "author.sidebar.advisories.petition.contextKeyArgumentsEmpty",
] as const;

const LEGACY_DERIVE_MODULES = [] as const;

describe("Pack 02G Task 08E.8c — Revision + Petition structured advisories", () => {
  it("catalog parity includes revision and petition advisories", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of [...REVISION_KEYS, ...PETITION_KEYS]) {
        assert.equal(typeof ieKey(loaded.messages, key), "string");
      }
    }
  });

  it("English Revision advisories resolve; civic title preserved", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "revision.sources.empty" }, t).text,
      "No published Improvement Proposals collected yet.",
    );
    const summary = resolveSidebarAdvisoryDisplay(
      {
        code: "revision.sources.summary",
        params: { eligibleCount: 1, unresolvedCount: 2 },
      },
      t,
    );
    assert.match(summary.text, /1 published Improvement Proposal/);
    assert.match(summary.text, /2 unresolved/);

    const title = "водна безпека / water-safety-XYZ";
    const aligned = resolveSidebarAdvisoryDisplay(
      { code: "revision.alignment.with_analysis", civic: { title } },
      t,
    );
    assert.match(aligned.text, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(aligned.civic?.title, title);
  });

  it("uk/zh-Hant/ar Revision sourcesEmpty is not English", async () => {
    const english = "No published Improvement Proposals collected yet.";
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const t = translatorFor(loaded.messages);
      assert.notEqual(
        resolveSidebarAdvisoryDisplay({ code: "revision.sources.empty" }, t).text,
        english,
      );
    }
  });

  it("English Petition advisories resolve with field-label reuse", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "petition.sources.empty" }, t).text,
      "No published Revision collected yet.",
    );
    const summary = resolveSidebarAdvisoryDisplay(
      {
        code: "petition.sources.summary",
        params: { version: 2, proposalCount: 1 },
      },
      t,
    );
    assert.match(summary.text, /Version 2/);
    assert.match(summary.text, /1 accepted Proposal/);

    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "petition.clarity.title_empty",
          civic: { petitionFieldIds: ["title"] },
        },
        t,
      ).text,
      "Petition Title is empty.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "petition.clarity.request_statement_short",
          civic: { petitionFieldIds: ["requestStatement"] },
        },
        t,
      ).text,
      "Request Statement is very short — it may be too vague for visitors to understand what is being asked.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "petition.context.key_arguments_empty",
          civic: { petitionFieldIds: ["keyArguments"] },
        },
        t,
      ).text,
      "No Key Arguments provided yet.",
    );
  });

  it("uk/zh-Hant/ar Petition sourcesEmpty is not English", async () => {
    const english = "No published Revision collected yet.";
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const t = translatorFor(loaded.messages);
      assert.notEqual(
        resolveSidebarAdvisoryDisplay({ code: "petition.sources.empty" }, t).text,
        english,
      );
    }
  });

  it("ICU plural syntax present for Revision/Petition sourcesSummary", async () => {
    for (const locale of ["en", "uk", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.match(
        ieKey(loaded.messages, "author.sidebar.advisories.revision.sourcesSummary"),
        /\{eligibleCount,\s*plural/,
      );
      assert.match(
        ieKey(loaded.messages, "author.sidebar.advisories.petition.sourcesSummary"),
        /\{proposalCount,\s*plural/,
      );
    }
  });

  it("Petition field ID maps to author.petition.fields.*; unknown falls back to raw ID", async () => {
    const en = await loadUiMessagesForLocale("en");
    const uk = await loadUiMessagesForLocale("uk");
    const tEn = translatorFor(en.messages);
    const tUk = translatorFor(uk.messages);
    assert.equal(resolvePetitionSidebarFieldDisplayLabel("title", tEn), "Petition Title");
    assert.equal(
      resolvePetitionSidebarFieldDisplayLabel("requestStatement", tEn),
      "Request Statement",
    );
    assert.equal(resolvePetitionSidebarFieldDisplayLabel("not_a_field", tEn), "not_a_field");
    assert.notEqual(resolvePetitionSidebarFieldDisplayLabel("title", tUk), "Petition Title");
  });

  it("Analysis and Proposal resolver paths remain unchanged", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "analysis.sources.empty" }, t).text,
      "No sources collected yet.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "proposal.sources.empty" }, t).text,
      "No proposal-marked comments collected yet. You can still confirm the Initiative version with zero proposals.",
    );
  });

  it("unknown advisory code fallback remains deterministic", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const t = translatorFor(uk.messages);
    const weird: InitiativeSidebarAdvisory = { code: "revision.not_a_real_code" };
    const presented = resolveSidebarAdvisoryDisplay(weird, t);
    assert.match(presented.text, /revision\.not_a_real_code/);
    assert.match(presented.text, /Нерозпізнана порада/);
  });

  it("Revision/Petition derive have no next-intl and no English advisory sentence contract", () => {
    const revision = readWeb(
      "features/initiative-version-revision/derive-revision-ai-assistant-insights.ts",
    );
    const petition = readWeb(
      "features/initiative-petition-lifecycle/derive-petition-ai-assistant-insights.ts",
    );
    for (const source of [revision, petition]) {
      assert.doesNotMatch(source, /next-intl/);
      assert.doesNotMatch(source, /useTranslations/);
      assert.doesNotMatch(source, /author\.sidebar\.advisories/);
    }
    assert.doesNotMatch(revision, /No published Improvement Proposals collected yet/);
    assert.doesNotMatch(revision, /Improvement Proposal\(s\)/);
    assert.doesNotMatch(petition, /Petition Title is empty/);
    assert.doesNotMatch(petition, /accepted Proposal\(s\)/);
    assert.match(revision, /revision\.sources\.summary/);
    assert.match(petition, /petition\.clarity\.title_empty/);
  });

  it("Revision Working Sidebar keeps API conflict message opaque and resolves descriptors", () => {
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    const start = sidebar.indexOf("function RevisionAiAssistantContent");
    const end = sidebar.indexOf("function PetitionAiAssistantSlot");
    assert.ok(start >= 0 && end > start);
    const block = sidebar.slice(start, end);
    assert.match(block, /resolveSidebarAdvisoryDisplay\(insights\.sourcesSummary/);
    assert.match(block, /resolveSidebarAdvisoryDisplay\(insights\.analysisAlignment/);
    assert.match(block, /warning\.message/);
    assert.doesNotMatch(block, /t\([^)]*warning\.message/);
    assert.doesNotMatch(block, /warning\.message\.includes/);
    assert.doesNotMatch(block, /sourcesUsedSummary/);
    assert.doesNotMatch(block, /analysisAlignmentSummary/);
    assert.doesNotMatch(block, /consistencyWarnings/);
  });

  it("Petition Working Sidebar resolves descriptors and keeps API consistency detail opaque", () => {
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    const start = sidebar.indexOf("function PetitionAiAssistantContent");
    const end = sidebar.indexOf("function DecisionSessionAiAssistantSlot");
    assert.ok(start >= 0 && end > start);
    const block = sidebar.slice(start, end);
    assert.match(block, /resolveSidebarAdvisoryDisplay\(insights\.sourcesSummary/);
    assert.match(block, /resolveSidebarAdvisoryDisplay\(insights\.analysisAlignment/);
    assert.match(block, /resolveSidebarAdvisoryDisplay\(warning,\s*t\)/);
    assert.match(block, /check\.detail/);
    assert.doesNotMatch(block, /t\([^)]*check\.detail/);
    assert.doesNotMatch(block, /sourcesUsedSummary/);
  });

  it("unused Revision consistencyWarnings are not localized into advisories catalogs", async () => {
    const en = await loadUiMessagesForLocale("en");
    assert.equal(
      resolveInitiativeExperienceMessage(
        en.messages,
        "author.sidebar.advisories.revision.consistencyWarnings",
      ),
      undefined,
    );
    const revision = readWeb(
      "features/initiative-version-revision/derive-revision-ai-assistant-insights.ts",
    );
    assert.match(revision, /consistencyWarnings/);
    assert.match(revision, /INTERNAL_UNUSED/);
  });

  it("Official Response → Archive migration is owned by 08E.8f", () => {
    for (const relative of [
      "features/initiative-official-response-lifecycle/derive-official-response-ai-assistant-insights.ts",
      "features/initiative-public-impact-lifecycle/derive-public-impact-ai-assistant-insights.ts",
      "features/initiative-civic-archive-lifecycle/derive-civic-archive-ai-assistant-insights.ts",
    ]) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /RevisionSidebarAdvisory/);
      assert.doesNotMatch(source, /PetitionSidebarAdvisory/);
      assert.doesNotMatch(source, /author\.sidebar\.advisories/);
      assert.doesNotMatch(source, /next-intl/);
      assert.doesNotMatch(source, /sourcesUsedSummary/);
      assert.match(source, /SidebarAdvisory/);
    }
  });

  it("missing advisories.revision.sourcesEmpty fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        author?: { sidebar?: { advisories?: { revision?: { sourcesEmpty?: string } } } };
      }
    ).author?.sidebar?.advisories?.revision?.sourcesEmpty;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes(
          "initiativeExperience.author.sidebar.advisories.revision.sourcesEmpty",
        ),
      ),
    );
  });
});
