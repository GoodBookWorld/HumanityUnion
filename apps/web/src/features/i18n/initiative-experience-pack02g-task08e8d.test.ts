/**
 * Pack 02G Task 08E.8d — Decision Session + Collective Decision structured advisories.
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
  resolveCollectiveDecisionSidebarFieldDisplayLabel,
  resolveDecisionSessionSidebarFieldDisplayLabel,
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

const LEGACY_DERIVE_MODULES = [] as const;

describe("Pack 02G Task 08E.8d — Decision Session + Collective Decision advisories", () => {
  it("catalog parity includes decisionSession and collectiveDecision advisories", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(
        typeof ieKey(loaded.messages, "author.sidebar.advisories.decisionSession.sourcesEmpty"),
        "string",
      );
      assert.equal(
        typeof ieKey(loaded.messages, "author.sidebar.advisories.collectiveDecision.actionsNeedOne"),
        "string",
      );
    }
  });

  it("English Decision Session advisories resolve with field-label reuse", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "decision_session.sources.empty" }, t).text,
      "No Decision Sources available yet.",
    );
    const summary = resolveSidebarAdvisoryDisplay(
      {
        code: "decision_session.sources.summary",
        params: {
          hasPetition: 1,
          hasRevision: 1,
          revisionVersion: 2,
          hasAnalysis: 0,
          proposalCount: 1,
          allyRecommendationCount: 0,
        },
      },
      t,
    );
    assert.equal(summary.text, "Published Petition · Revision v2 · 1 Proposal");
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "decision_session.feasibility.timeline_empty",
          civic: { decisionSessionFieldIds: ["timeline"] },
        },
        t,
      ).text,
      "Suggested Timeline is empty — Collective Decision timing will be unclear.",
    );
  });

  it("English Collective Decision advisories resolve with field-label reuse", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "collective_decision.actions.need_one" }, t).text,
      "Add at least one Approved Action so the Collective Decision has a clear outcome.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "collective_decision.rationale.empty",
          civic: { collectiveDecisionFieldIds: ["rationale"] },
        },
        t,
      ).text,
      "Decision Rationale is empty — explain why this Collective Decision outcome follows from upstream sources.",
    );
  });

  it("uk/zh-Hant/ar sourcesEmpty are not English", async () => {
    const english = "No Decision Sources available yet.";
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const t = translatorFor(loaded.messages);
      assert.notEqual(
        resolveSidebarAdvisoryDisplay({ code: "decision_session.sources.empty" }, t).text,
        english,
      );
      assert.notEqual(
        resolveSidebarAdvisoryDisplay({ code: "collective_decision.sources.empty" }, t).text,
        english,
      );
    }
  });

  it("field ID maps to stage fields.*; unknown falls back to raw ID", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(resolveDecisionSessionSidebarFieldDisplayLabel("timeline", t), "Suggested Timeline");
    assert.equal(resolveDecisionSessionSidebarFieldDisplayLabel("not_a_field", t), "not_a_field");
    assert.equal(
      resolveCollectiveDecisionSidebarFieldDisplayLabel("approvedActions", t),
      "Approved Actions (one per line)",
    );
    assert.equal(
      resolveCollectiveDecisionSidebarFieldDisplayLabel("weird", t),
      "weird",
    );
  });

  it("Analysis→Petition resolver paths remain unchanged", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "analysis.sources.empty" }, t).text,
      "No sources collected yet.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "revision.sources.empty" }, t).text,
      "No published Improvement Proposals collected yet.",
    );
  });

  it("unknown advisory fallback remains deterministic", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const t = translatorFor(uk.messages);
    const weird: InitiativeSidebarAdvisory = { code: "decision_session.not_a_real_code" };
    const presented = resolveSidebarAdvisoryDisplay(weird, t);
    assert.match(presented.text, /decision_session\.not_a_real_code/);
    assert.match(presented.text, /Нерозпізнана порада/);
  });

  it("DS/CD derive modules have no next-intl and no English advisory sentence contract", () => {
    for (const relative of [
      "features/initiative-decision-session-lifecycle/derive-decision-session-ai-assistant-insights.ts",
      "features/initiative-collective-decision-lifecycle/derive-collective-decision-ai-assistant-insights.ts",
    ]) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /next-intl/);
      assert.doesNotMatch(source, /useTranslations/);
      assert.doesNotMatch(source, /author\.sidebar\.advisories/);
      assert.doesNotMatch(source, /Proposal\(s\)/);
      assert.doesNotMatch(source, /No Decision Sources available yet/);
    }
  });

  it("Working Sidebar keeps API consistency detail opaque for DS and CD", () => {
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    const dsStart = sidebar.indexOf("function DecisionSessionAiAssistantSlot");
    const dsEnd = sidebar.indexOf("function CollectiveDecisionAiAssistantSlot");
    const cdStart = dsEnd;
    const cdEnd = sidebar.indexOf("function CommitmentAiAssistantSlot");
    const ds = sidebar.slice(dsStart, dsEnd);
    const cd = sidebar.slice(cdStart, cdEnd);
    assert.match(ds, /resolveSidebarAdvisoryDisplay\(insights\.sourcesSummary/);
    assert.match(ds, /check\.detail/);
    assert.doesNotMatch(ds, /t\([^)]*check\.detail/);
    assert.doesNotMatch(ds, /sourcesUsedSummary/);
    assert.match(cd, /resolveSidebarAdvisoryDisplay\(insights\.sourcesSummary/);
    assert.match(cd, /check\.detail/);
    assert.doesNotMatch(cd, /t\([^)]*check\.detail/);
  });

  it("Official Response → Archive migration is owned by 08E.8f", () => {
    for (const relative of [
      "features/initiative-official-response-lifecycle/derive-official-response-ai-assistant-insights.ts",
      "features/initiative-public-impact-lifecycle/derive-public-impact-ai-assistant-insights.ts",
      "features/initiative-civic-archive-lifecycle/derive-civic-archive-ai-assistant-insights.ts",
    ]) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /DecisionSessionSidebarAdvisory/);
      assert.doesNotMatch(source, /CollectiveDecisionSidebarAdvisory/);
      assert.doesNotMatch(source, /author\.sidebar\.advisories/);
      assert.doesNotMatch(source, /sourcesUsedSummary/);
      assert.match(source, /SidebarAdvisory/);
    }
  });

  it("missing advisories.decisionSession.sourcesEmpty fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        author?: { sidebar?: { advisories?: { decisionSession?: { sourcesEmpty?: string } } } };
      }
    ).author?.sidebar?.advisories?.decisionSession?.sourcesEmpty;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes(
          "initiativeExperience.author.sidebar.advisories.decisionSession.sourcesEmpty",
        ),
      ),
    );
  });
});
