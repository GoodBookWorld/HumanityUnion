/**
 * Pack 02G Task 08E.8e — Implementation Commitment + Tracking structured advisories.
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
  resolveImplementationCommitmentSidebarFieldDisplayLabel,
  resolveImplementationTrackingSidebarFieldDisplayLabel,
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

const LEGACY_DERIVE_MODULES = [
  "features/initiative-official-response-lifecycle/derive-official-response-ai-assistant-insights.ts",
  "features/initiative-public-impact-lifecycle/derive-public-impact-ai-assistant-insights.ts",
  "features/initiative-civic-archive-lifecycle/derive-civic-archive-ai-assistant-insights.ts",
] as const;

describe("Pack 02G Task 08E.8e — Implementation Commitment + Tracking advisories", () => {
  it("catalog parity includes implementationCommitment and implementationTracking advisories", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(
        typeof ieKey(
          loaded.messages,
          "author.sidebar.advisories.implementationCommitment.sourcesEmpty",
        ),
        "string",
      );
      assert.equal(
        typeof ieKey(loaded.messages, "author.sidebar.advisories.implementationTracking.overdueCount"),
        "string",
      );
    }
  });

  it("English Commitment advisories resolve with ICU counts, role civic, and field labels", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "implementation_commitment.sources.empty" }, t).text,
      "No Implementation Commitment Sources available yet.",
    );
    const summary = resolveSidebarAdvisoryDisplay(
      {
        code: "implementation_commitment.sources.summary",
        params: { hasDecision: 1, activeAllyCount: 2 },
        civic: { title: "Decision Title" },
      },
      t,
    );
    assert.equal(summary.text, "Collective Decision “Decision Title” · 2 Active Allies");
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "implementation_commitment.unassigned.missing_participants",
          params: { count: 1 },
        },
        t,
      ).text,
      "1 Candidate has no proposed Participant yet.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "implementation_commitment.roles.overloaded",
          params: { count: 3 },
          civic: { role: "Civic Role Name" },
        },
        t,
      ).text,
      "Role “Civic Role Name” is suggested for 3 Candidates — consider spreading responsibility.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "implementation_commitment.clarity.title_empty",
          civic: { implementationCommitmentFieldIds: ["title"] },
        },
        t,
      ).text,
      "Title is empty — Implementation Commitments should be clearly labeled.",
    );
  });

  it("English Tracking advisories resolve with ICU counts and field labels", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    const summary = resolveSidebarAdvisoryDisplay(
      {
        code: "implementation_tracking.sources.summary",
        params: {
          hasPackage: 1,
          acceptedCommitmentCount: 1,
          decisionActionCount: 0,
          activeAllyCount: 1,
        },
        civic: { title: "Package Title" },
      },
      t,
    );
    assert.equal(
      summary.text,
      "Commitment Package “Package Title” · 1 Accepted Commitment · 0 Decision actions · 1 Active Ally",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        { code: "implementation_tracking.overdue.count", params: { count: 2 } },
        t,
      ).text,
      "2 milestones are past their target date — review dates.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        { code: "implementation_tracking.stalled.not_started", params: { count: 1 } },
        t,
      ).text,
      "1 milestone has not been started yet.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "implementation_tracking.clarity.summary_empty",
          civic: { implementationTrackingFieldIds: ["summary"] },
        },
        t,
      ).text,
      "Summary is empty — restate the implementation intent.",
    );
  });

  it("uk/zh-Hant/ar Commitment+Tracking sourcesEmpty are not English", async () => {
    const englishCommitment = "No Implementation Commitment Sources available yet.";
    const englishTrackingOverdue =
      "1 milestone is past its target date — review dates.";
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const t = translatorFor(loaded.messages);
      assert.notEqual(
        resolveSidebarAdvisoryDisplay({ code: "implementation_commitment.sources.empty" }, t).text,
        englishCommitment,
      );
      assert.notEqual(
        resolveSidebarAdvisoryDisplay(
          { code: "implementation_tracking.overdue.count", params: { count: 1 } },
          t,
        ).text,
        englishTrackingOverdue,
      );
    }
  });

  it("field ID maps to stage fields.*; unknown falls back to raw ID", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(resolveImplementationCommitmentSidebarFieldDisplayLabel("title", t), "Title");
    assert.equal(
      resolveImplementationCommitmentSidebarFieldDisplayLabel("not_a_field", t),
      "not_a_field",
    );
    assert.equal(resolveImplementationTrackingSidebarFieldDisplayLabel("summary", t), "Summary");
    assert.equal(resolveImplementationTrackingSidebarFieldDisplayLabel("weird", t), "weird");
  });

  it("Tracking architecture: resolver presents codes only — no overdue/stalled date math", () => {
    const resolver = readWeb(
      "features/initiative-lifecycle-stage-workspace/resolve-sidebar-advisory-display.ts",
    );
    const contract = readWeb(
      "features/initiative-lifecycle-stage-workspace/sidebar-advisory-contract.ts",
    );
    assert.doesNotMatch(resolver, /targetDate/);
    assert.doesNotMatch(resolver, /TODAY_ISO/);
    assert.doesNotMatch(resolver, /currentStatus/);
    assert.doesNotMatch(resolver, /progress\s*[<>=]/);
    assert.match(resolver, /isImplementationTrackingSidebarAdvisoryCode/);
    assert.match(resolver, /IMPLEMENTATION_TRACKING_ADVISORY_MESSAGE_KEY/);
    assert.match(resolver, /Overdue\/stalled\/date calculations remain derive-owned/);
    assert.match(contract, /"implementation_tracking\.overdue\.count"/);
    assert.match(contract, /"implementation_tracking\.stalled\.not_started"/);

    const derive = readWeb(
      "features/initiative-implementation-tracking-lifecycle/derive-implementation-tracking-ai-assistant-insights.ts",
    );
    assert.match(derive, /TODAY_ISO/);
    assert.match(derive, /targetDate < today/);
    assert.match(derive, /currentStatus === "Preparation"/);
    assert.match(derive, /progress >= 100/);
  });

  it("Analysis→Collective Decision resolver paths remain unchanged", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "analysis.sources.empty" }, t).text,
      "No sources collected yet.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "collective_decision.actions.need_one" }, t).text,
      "Add at least one Approved Action so the Collective Decision has a clear outcome.",
    );
  });

  it("unknown advisory fallback remains deterministic", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const t = translatorFor(uk.messages);
    const weird: InitiativeSidebarAdvisory = {
      code: "implementation_tracking.not_a_real_code",
    };
    const presented = resolveSidebarAdvisoryDisplay(weird, t);
    assert.match(presented.text, /implementation_tracking\.not_a_real_code/);
    assert.match(presented.text, /Нерозпізнана порада/);
  });

  it("Commitment/Tracking derive modules have no next-intl and no English advisory sentence contract", () => {
    for (const relative of [
      "features/initiative-implementation-commitment-lifecycle/derive-implementation-commitment-ai-assistant-insights.ts",
      "features/initiative-implementation-tracking-lifecycle/derive-implementation-tracking-ai-assistant-insights.ts",
    ]) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /next-intl/);
      assert.doesNotMatch(source, /useTranslations/);
      assert.doesNotMatch(source, /author\.sidebar\.advisories/);
      assert.doesNotMatch(source, /sourcesUsedSummary/);
      assert.doesNotMatch(source, /Active Ally\(ies\)/);
    }
    const tracking = readWeb(
      "features/initiative-implementation-tracking-lifecycle/derive-implementation-tracking-ai-assistant-insights.ts",
    );
    assert.match(tracking, /missingCommitmentPackageWarnings/);
    assert.match(tracking, /INTERNAL_UNUSED/);
    assert.match(tracking, /No Commitment Package yet/);
  });

  it("Working Sidebar migrates Commitment+Tracking; keeps package bank unmounted; API detail opaque", () => {
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    const commitmentStart = sidebar.indexOf("function CommitmentAiAssistantSlot");
    const trackingStart = sidebar.indexOf("function TrackingAiAssistantSlot");
    const officialStart = sidebar.indexOf("function OfficialResponseAiAssistantSlot");
    const commitment = sidebar.slice(commitmentStart, trackingStart);
    const tracking = sidebar.slice(trackingStart, officialStart);

    assert.match(commitment, /resolveSidebarAdvisoryDisplay\(insights\.sourcesSummary/);
    assert.match(commitment, /check\.detail/);
    assert.doesNotMatch(commitment, /t\([^)]*check\.detail/);
    assert.doesNotMatch(commitment, /sourcesUsedSummary/);

    assert.match(tracking, /resolveSidebarAdvisoryDisplay\(insights\.sourcesSummary/);
    assert.match(tracking, /check\.detail/);
    assert.doesNotMatch(tracking, /t\([^)]*check\.detail/);
    assert.doesNotMatch(tracking, /sourcesUsedSummary/);
    assert.doesNotMatch(tracking, /missingCommitmentPackageWarnings/);
  });

  it("Official Response → Archive remain legacy English banks", () => {
    for (const relative of LEGACY_DERIVE_MODULES) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /ImplementationCommitmentSidebarAdvisory/);
      assert.doesNotMatch(source, /ImplementationTrackingSidebarAdvisory/);
      assert.doesNotMatch(source, /author\.sidebar\.advisories/);
      assert.match(source, /sourcesUsedSummary/);
    }
  });

  it("missing advisories.implementationCommitment.sourcesEmpty fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        author?: {
          sidebar?: { advisories?: { implementationCommitment?: { sourcesEmpty?: string } } };
        };
      }
    ).author?.sidebar?.advisories?.implementationCommitment?.sourcesEmpty;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes(
          "initiativeExperience.author.sidebar.advisories.implementationCommitment.sourcesEmpty",
        ),
      ),
    );
  });
});
