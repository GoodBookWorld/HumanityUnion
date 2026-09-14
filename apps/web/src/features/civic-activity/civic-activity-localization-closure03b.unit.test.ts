/**
 * Closure 03B — Civic Activity + Workspace Chrome WEB_UI i18n.
 * Source + message coverage only; no CT / PLP / Gemini paths.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { normalizeWorkspaceNavSection } from "../../components/member/WorkspaceSectionNav.js";
import { buildCivicActivitySnapshot } from "./lib/aggregate-civic-activity.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const LOCALES = ["en", "uk", "zh-Hant", "ar"] as const;

const GROUP_IDS = [
  "initiatives",
  "analyses",
  "proposals",
  "decision-participation",
  "implementation-commitments",
  "implementation-tracking",
  "public-impact",
] as const;

const TIMELINE_EVENT_TYPES = [
  "initiative_created",
  "initiative_published",
  "analysis_published",
  "proposal_submitted",
  "proposal_accepted",
  "proposal_partially_accepted",
  "proposal_declined",
  "vote_cast",
  "vote_updated",
  "decision_session_published",
  "commitment_published",
  "implementation_tracking_activated",
  "implementation_update_added",
  "implementation_tracking_completed",
  "public_impact_published",
  "public_impact_verified",
] as const;

describe("Closure 03B — civic activity + workspace chrome i18n", () => {
  it("civic-activity page/section chrome resolve through WEB_UI messages", () => {
    const page = readWeb("app/civic-activity/page.tsx");
    const section = readWeb("features/civic-activity/components/MyCivicActivitySection.tsx");
    const workspace = readWeb(
      "features/civic-activity/components/MyCivicActivityWorkspace.tsx",
    );

    assert.match(page, /getTranslations\("civicActivity"\)/);
    assert.match(page, /getTranslations\("workspace"\)/);
    assert.match(page, /tWorkspace\("myCivicActivity"\)/);
    assert.match(page, /t\("pageSubtitle"\)/);
    assert.match(page, /t\("sections\.navLabel"\)/);
    assert.match(page, /id:\s*"section-my-civic-activity"/);
    assert.match(page, /id:\s*"section-activity-summary"/);
    assert.match(page, /id:\s*"section-activity-timeline"/);

    assert.match(section, /useTranslations\("civicActivity"\)/);
    assert.match(section, /id="section-my-civic-activity"/);
    assert.match(section, /id="section-activity-summary"/);
    assert.match(section, /id="section-activity-timeline"/);
    assert.match(section, /t\("loading"\)/);
    assert.match(section, /t\("unavailable"\)/);

    assert.match(workspace, /useTranslations\("civicActivity"\)/);
    assert.match(workspace, /t\("intro"/);
    assert.match(workspace, /t\("timeline\.viewRecord"\)/);
    assert.match(workspace, /t\("timeline\.empty"\)/);
    assert.doesNotMatch(workspace, /"My Initiatives"/);
    assert.doesNotMatch(workspace, /View record/);
  });

  it("aggregator stores stable group ids and noteKey — not English chrome titles", () => {
    const aggregator = readWeb("features/civic-activity/lib/aggregate-civic-activity.ts");
    assert.doesNotMatch(aggregator, /title:\s*"My Initiatives"/);
    assert.doesNotMatch(aggregator, /label:\s*"Initiative created"/);
    assert.match(aggregator, /id:\s*"initiatives"/);
    assert.match(aggregator, /noteKey:/);

    const snapshot = buildCivicActivitySnapshot({
      initiatives: [],
      analyses: [],
      proposals: [],
      decisionSessions: [],
      votes: [],
      commitments: [],
      trackings: [],
      trackingUpdates: [],
      impacts: [],
    });

    for (const group of snapshot.groups) {
      assert.ok(GROUP_IDS.includes(group.id as (typeof GROUP_IDS)[number]));
      assert.equal("title" in group, false);
      if (group.kind === "active") {
        assert.equal("note" in group, false);
      }
      if (group.kind === "deferred") {
        assert.equal("reason" in group, false);
      }
    }

    for (const entry of snapshot.timeline) {
      assert.equal("label" in entry, false);
      assert.ok(typeof entry.type === "string");
    }
  });

  it("group labels and timeline events are message-keyed by stable ids", async () => {
    for (const locale of LOCALES) {
      const { messages } = await loadUiMessagesForLocale(locale);
      const civic = messages.civicActivity as Record<string, unknown>;
      assert.ok(civic, `civicActivity missing for ${locale}`);

      const groups = civic.groups as Record<string, string>;
      for (const id of GROUP_IDS) {
        const label = groups[id] ?? "";
        assert.ok(label.length > 0, `${locale} groups.${id}`);
      }

      const events = (civic.timeline as { events: Record<string, string> }).events;
      for (const type of TIMELINE_EVENT_TYPES) {
        const label = events[type] ?? "";
        assert.ok(label.length > 0, `${locale} timeline.events.${type}`);
      }
    }

    const workspace = readWeb(
      "features/civic-activity/components/MyCivicActivityWorkspace.tsx",
    );
    assert.match(workspace, /GROUP_TITLE_KEYS/);
    assert.match(workspace, /TIMELINE_EVENT_KEYS/);
    assert.match(workspace, /resolveGroupTitle\(group\.id/);
    assert.match(workspace, /resolveTimelineLabel\(entry\.type/);
  });

  it("summary icons are keyed by stable group.id values", () => {
    const workspace = readWeb(
      "features/civic-activity/components/MyCivicActivityWorkspace.tsx",
    );
    assert.doesNotMatch(workspace, /ACTIVITY_SUMMARY_ICONS[\s\S]*"My Initiatives"/);
    assert.match(workspace, /initiatives:\s*"\/icons\/workspace\/initiatives\.svg"/);
    assert.match(workspace, /"decision-participation":\s*"\/icons\/workspace\/participation\.svg"/);
    assert.match(workspace, /ACTIVITY_SUMMARY_ICONS\[group\.id\]/);

    for (const id of GROUP_IDS) {
      const quoted = id.includes("-") ? `"${id}"` : id;
      assert.match(
        workspace,
        new RegExp(`${quoted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*"/`),
      );
    }
  });

  it("WorkspaceMemberIdentity prompt uses workspace WEB_UI keys", () => {
    const identity = readWeb(
      "features/member-profile/components/WorkspaceMemberIdentity.tsx",
    );
    assert.match(identity, /workspace-member-identity--prompt/);
    assert.match(identity, /useTranslations\("workspace"\)/);
    assert.match(identity, /tWorkspace\("signInRequired"\)/);
    assert.match(identity, /tWorkspace\.rich\("signInRequiredCopy"/);
    assert.match(identity, /href="\/login"/);
    assert.match(identity, /href="\/register"/);
    assert.doesNotMatch(identity, /Sign in required/);
    assert.doesNotMatch(identity, />Log in</);
  });

  it("WorkspaceSectionNav localizes labels while preserving stable ids/hashes", () => {
    const nav = readWeb("components/member/WorkspaceSectionNav.tsx");
    assert.match(nav, /normalizeWorkspaceNavSection/);
    assert.match(nav, /href=\{`#\$\{item\.id\}`\}/);
    assert.match(nav, /sectionsLabel/);
    assert.match(nav, /useMemo/);
    assert.match(nav, /sections\.map\(normalizeWorkspaceNavSection\)/);

    const ukSummary = "Підсумок активності";
    const enSummary = "Activity Summary";
    const ukNormalized = normalizeWorkspaceNavSection({
      id: "section-activity-summary",
      label: ukSummary,
    });
    const enNormalized = normalizeWorkspaceNavSection({
      id: "section-activity-summary",
      label: enSummary,
    });
    assert.equal(ukNormalized.id, "section-activity-summary");
    assert.equal(enNormalized.id, "section-activity-summary");
    assert.equal(ukNormalized.id, enNormalized.id);
    assert.notEqual(ukNormalized.label, enNormalized.label);

    const legacy = normalizeWorkspaceNavSection("Activity Summary");
    assert.equal(legacy.id, "section-activity-summary");
    assert.equal(legacy.label, "Activity Summary");

    const page = readWeb("app/civic-activity/page.tsx");
    assert.match(page, /id:\s*"section-activity-summary"/);
    assert.match(page, /label:\s*t\("sections\.summary"\)/);
    assert.match(page, /navAriaLabel=\{t\("sections\.workspaceNavAria"\)\}/);

    const memberWorkspace = readWeb("components/member/MemberWorkspace.tsx");
    assert.match(memberWorkspace, /navAriaLabel\s*=\s*"Workspace navigation"/);
    assert.match(memberWorkspace, /aria-label=\{navAriaLabel\}/);

    const tracker = readWeb(
      "features/workspace-civic-assistant/use-workspace-section-tracker.ts",
    );
    assert.match(tracker, /section\.id\)\.join/);
    assert.match(tracker, /\[sectionIdsKey\]/);
    assert.doesNotMatch(tracker, /section\.label/);
    assert.doesNotMatch(tracker, /}, \[sections\]\)/);
  });

  it("Closure 03B.1 — workspace nav aria + tracker ignore translated labels", async () => {
    for (const locale of LOCALES) {
      const { messages } = await loadUiMessagesForLocale(locale);
      const civic = messages.civicActivity as {
        sections: { workspaceNavAria?: string };
      };
      assert.equal(
        typeof civic.sections.workspaceNavAria,
        "string",
        `${locale} sections.workspaceNavAria`,
      );
      assert.ok((civic.sections.workspaceNavAria ?? "").length > 0);
    }

    const { messages: arMessages } = await loadUiMessagesForLocale("ar");
    const arCivic = arMessages.civicActivity as {
      sections: { workspaceNavAria: string };
    };
    assert.match(arCivic.sections.workspaceNavAria, /[\u0600-\u06FF]/);
  });

  it("Arabic/RTL message coverage includes civicActivity + workspace prompt keys", async () => {
    const { messages } = await loadUiMessagesForLocale("ar");
    const civic = messages.civicActivity as {
      sections: { navLabel: string; summary: string };
      groups: Record<string, string>;
      timeline: { viewRecord: string; events: Record<string, string> };
    };
    const workspace = messages.workspace as {
      myCivicActivity: string;
      signInRequired: string;
      signInRequiredCopy: string;
    };

    assert.match(civic.sections.navLabel, /[\u0600-\u06FF]/);
    assert.match(civic.groups.initiatives ?? "", /[\u0600-\u06FF]/);
    assert.match(civic.timeline.viewRecord, /[\u0600-\u06FF]/);
    assert.match(civic.timeline.events.initiative_created ?? "", /[\u0600-\u06FF]/);
    assert.match(workspace.signInRequired, /[\u0600-\u06FF]/);
    assert.match(workspace.signInRequiredCopy, /<login>/);
    assert.match(workspace.signInRequiredCopy, /<register>/);
    assert.match(workspace.myCivicActivity, /[\u0600-\u06FF]/);
  });

  it("introduces no CT / PLP / Gemini / provider dependency on civic-activity path", () => {
    const files = [
      "app/civic-activity/page.tsx",
      "features/civic-activity/components/MyCivicActivitySection.tsx",
      "features/civic-activity/components/MyCivicActivityWorkspace.tsx",
      "features/civic-activity/lib/aggregate-civic-activity.ts",
      "features/civic-activity/api.ts",
      "components/member/WorkspaceSectionNav.tsx",
      "features/member-profile/components/WorkspaceMemberIdentity.tsx",
    ];

    for (const relative of files) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /gemini|Gemini/i);
      assert.doesNotMatch(source, /content.?translation|ContentTranslation|PLP|plpEnqueue|warmCt/i);
      assert.doesNotMatch(source, /generateContentTranslation|provider\.generate/i);
    }
  });
});
