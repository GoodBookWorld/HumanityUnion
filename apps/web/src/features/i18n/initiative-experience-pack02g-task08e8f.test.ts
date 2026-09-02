/**
 * Pack 02G Task 08E.8f — Official Response + Public Impact + Civic Archive structured advisories.
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
  resolveCivicArchiveSidebarFieldDisplayLabel,
  resolveOfficialResponseSidebarFieldDisplayLabel,
  resolvePublicImpactSidebarSectionDisplayLabel,
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

describe("Pack 02G Task 08E.8f — Official Response + Public Impact + Civic Archive advisories", () => {
  it("catalog parity includes OR/PI/Archive advisories", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(
        typeof ieKey(loaded.messages, "author.sidebar.advisories.officialResponse.sourcesEmpty"),
        "string",
      );
      assert.equal(
        typeof ieKey(loaded.messages, "author.sidebar.advisories.publicImpact.evidencePackageRequired"),
        "string",
      );
      assert.equal(
        typeof ieKey(loaded.messages, "author.sidebar.advisories.civicArchive.clarityAdvisoryOnly"),
        "string",
      );
    }
  });

  it("English OR/PI/Archive advisories resolve with civic + field labels", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "official_response.sources.empty" }, t).text,
      "No Official Response Sources available yet.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "official_response.institution.missing",
          civic: { subject: "Civic Subject" },
        },
        t,
      ).text,
      "“Civic Subject” has no institution or organization filled in yet.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "public_impact.note.advisory_only" }, t).text,
      "AI suggestions are advisory only — separate confirmed facts from assumptions. AI cannot invent results, publish, or advance Lifecycle.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "public_impact.evidence.section_empty",
          civic: { publicImpactSectionId: "evidence" },
        },
        t,
      ).text,
      "“Evidence” is empty — publish requires a non-empty body.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "civic_archive.fields.title_empty",
          civic: { civicArchiveFieldIds: ["finalArchiveTitle"] },
        },
        t,
      ).text,
      "Final Archive Title is empty — required before publish.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        {
          code: "civic_archive.outstanding.unresolved_tracking",
          params: { count: 2 },
        },
        t,
      ).text,
      "2 Tracking Records remain unresolved — record them honestly in Outstanding Work.",
    );
  });

  it("uk/zh-Hant/ar OR/PI/Archive sourcesEmpty are not English", async () => {
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const t = translatorFor(loaded.messages);
      assert.notEqual(
        resolveSidebarAdvisoryDisplay({ code: "official_response.sources.empty" }, t).text,
        "No Official Response Sources available yet.",
      );
      assert.notEqual(
        resolveSidebarAdvisoryDisplay({ code: "public_impact.sources.empty" }, t).text,
        "No Public Impact Sources available yet.",
      );
      assert.notEqual(
        resolveSidebarAdvisoryDisplay({ code: "civic_archive.sources.empty" }, t).text,
        "No Civic Archive Sources available yet.",
      );
    }
  });

  it("field/section ID maps reuse existing vocabularies; unknown → raw", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(resolveOfficialResponseSidebarFieldDisplayLabel("title", t), "Title");
    assert.equal(resolveOfficialResponseSidebarFieldDisplayLabel("weird", t), "weird");
    assert.equal(resolvePublicImpactSidebarSectionDisplayLabel("evidence", t), "Evidence");
    assert.equal(resolvePublicImpactSidebarSectionDisplayLabel("not_a_section", t), "not_a_section");
    assert.equal(
      resolveCivicArchiveSidebarFieldDisplayLabel("lessonsLearned", t),
      "Lessons Learned",
    );
  });

  it("resolver has no date/status/statistics business logic and no English sentence matching", () => {
    const resolver = readWeb(
      "features/initiative-lifecycle-stage-workspace/resolve-sidebar-advisory-display.ts",
    );
    assert.doesNotMatch(resolver, /TODAY_ISO/);
    assert.doesNotMatch(resolver, /receivedAt/);
    assert.doesNotMatch(resolver, /signatureCount/);
    assert.doesNotMatch(resolver, /judgmentWords/);
    assert.doesNotMatch(resolver, /Error\.message/);
    assert.match(resolver, /isOfficialResponseSidebarAdvisoryCode/);
    assert.match(resolver, /isPublicImpactSidebarAdvisoryCode/);
    assert.match(resolver, /isCivicArchiveSidebarAdvisoryCode/);
  });

  it("Analysis→Tracking resolver paths remain unchanged", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);
    assert.equal(
      resolveSidebarAdvisoryDisplay({ code: "analysis.sources.empty" }, t).text,
      "No sources collected yet.",
    );
    assert.equal(
      resolveSidebarAdvisoryDisplay(
        { code: "implementation_tracking.overdue.count", params: { count: 1 } },
        t,
      ).text,
      "1 milestone is past its target date — review dates.",
    );
  });

  it("unknown advisory fallback remains deterministic", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const t = translatorFor(uk.messages);
    const weird: InitiativeSidebarAdvisory = { code: "civic_archive.not_a_real_code" };
    const presented = resolveSidebarAdvisoryDisplay(weird, t);
    assert.match(presented.text, /civic_archive\.not_a_real_code/);
    assert.match(presented.text, /Нерозпізнана порада/);
  });

  it("all 11 derive modules have no next-intl; mounted Web advisories are descriptor-based", () => {
    for (const relative of DERIVE_MODULES) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /next-intl/);
      assert.doesNotMatch(source, /useTranslations/);
      assert.doesNotMatch(source, /author\.sidebar\.advisories/);
      assert.doesNotMatch(source, /sourcesUsedSummary/);
      assert.match(source, /SidebarAdvisory/);
    }
    const or = readWeb(
      "features/initiative-official-response-lifecycle/derive-official-response-ai-assistant-insights.ts",
    );
    assert.match(or, /missingTrackingPackageWarnings/);
    assert.match(or, /INTERNAL_UNUSED/);
    assert.match(or, /Publish an Implementation Tracking Package/);
  });

  it("Working Sidebar migrates OR/PI/Archive; unused banks stay unmounted; API detail opaque", () => {
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    const orStart = sidebar.indexOf("function OfficialResponseAiAssistantSlot");
    const piStart = sidebar.indexOf("function PublicImpactAiAssistantSlot");
    const archiveStart = sidebar.indexOf("function CivicArchiveAiAssistantSlot");
    const exportStart = sidebar.indexOf("export function InitiativeLifecycleWorkingSidebar");
    const or = sidebar.slice(orStart, piStart);
    const pi = sidebar.slice(piStart, archiveStart);
    const archive = sidebar.slice(archiveStart, exportStart);

    for (const block of [or, pi, archive]) {
      assert.match(block, /resolveSidebarAdvisoryDisplay\(insights\.sourcesSummary/);
      assert.match(block, /check\.detail/);
      assert.doesNotMatch(block, /t\([^)]*check\.detail/);
      assert.doesNotMatch(block, /sourcesUsedSummary/);
    }
    assert.doesNotMatch(or, /missingTrackingPackageWarnings/);
    assert.match(or, /advisoryNotes/);
    assert.match(pi, /advisoryNotes/);
  });

  it("missing advisories.officialResponse.sourcesEmpty fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        author?: { sidebar?: { advisories?: { officialResponse?: { sourcesEmpty?: string } } } };
      }
    ).author?.sidebar?.advisories?.officialResponse?.sourcesEmpty;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes(
          "initiativeExperience.author.sidebar.advisories.officialResponse.sourcesEmpty",
        ),
      ),
    );
  });

  it("11-module inventory: every derive is descriptor-based for mounted Web advisories", () => {
    assert.equal(DERIVE_MODULES.length, 11);
    for (const relative of DERIVE_MODULES) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /sourcesUsedSummary/, relative);
      assert.match(source, /SidebarAdvisory/, relative);
    }
  });
});
