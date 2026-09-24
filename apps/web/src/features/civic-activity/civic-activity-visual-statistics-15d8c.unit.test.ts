/**
 * Step 15D.8C — Civic Activity visual statistics.
 * Deterministic aggregation + UI contract tests. No chart libraries.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type {
  Initiative,
  InitiativeDecisionVote,
  InitiativeImplementationCommitment,
} from "@hu/types";
import { isParticipantWebUiRequiredPath } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  buildCivicActivitySnapshot,
  collectCivicTimelineEntries,
} from "./lib/aggregate-civic-activity.js";
import {
  buildCivicActivityOverTime,
  CIVIC_ACTIVITY_OVER_TIME_WINDOW_DAYS,
  dedupeCivicTimelineEntries,
  utcDayKey,
} from "./lib/civic-activity-over-time.js";
import type { CivicActivitySourceData, CivicTimelineEntry, MyDecisionVoteRecord } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const GROUP_IDS = [
  "initiatives",
  "analyses",
  "proposals",
  "decision-participation",
  "implementation-commitments",
  "implementation-tracking",
  "public-impact",
] as const;

const CHART_KEYS = [
  "civicActivity.groups.activity-over-time",
  "civicActivity.charts.showDetails",
  "civicActivity.charts.hideDetails",
  "civicActivity.charts.civicActions",
  "civicActivity.charts.activeCivicDays",
  "civicActivity.charts.lastNDays",
  "civicActivity.charts.windowLabel",
  "civicActivity.charts.proposedInvitations",
  "civicActivity.charts.statusBreakdownAria",
  "civicActivity.charts.overTimeAria",
  "civicActivity.charts.overTimeEmpty",
] as const;

function emptySource(patch: Partial<CivicActivitySourceData> = {}): CivicActivitySourceData {
  return {
    initiatives: [],
    analyses: [],
    proposals: [],
    decisionSessions: [],
    votes: [],
    commitments: [],
    trackings: [],
    trackingUpdates: [],
    impacts: [],
    ...patch,
  };
}

function initiative(partial: Partial<Initiative> & Pick<Initiative, "initiativeId" | "title">): Initiative {
  return {
    lifecyclePhase: "draft",
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    timeline: [],
    ...partial,
  } as Initiative;
}

describe("Step 15D.8C — civic activity visual statistics", () => {
  it("1. seven existing groups remain present", () => {
    const snapshot = buildCivicActivitySnapshot(emptySource());
    assert.equal(snapshot.groups.length, 7);
    assert.deepEqual(
      snapshot.groups.map((group) => group.id),
      [...GROUP_IDS],
    );
  });

  it("2. eighth activity-over-time series exists on the snapshot", () => {
    const snapshot = buildCivicActivitySnapshot(emptySource());
    assert.ok(snapshot.activityOverTime);
    assert.equal(snapshot.activityOverTime.windowDays, CIVIC_ACTIVITY_OVER_TIME_WINDOW_DAYS);
    assert.equal(snapshot.activityOverTime.days.length, CIVIC_ACTIVITY_OVER_TIME_WINDOW_DAYS);
    const workspace = readWeb("features/civic-activity/components/MyCivicActivityWorkspace.tsx");
    assert.match(workspace, /ActivityOverTimeCard/);
    assert.match(workspace, /groups\.activity-over-time/);
  });

  it("3. 30-day series uses full event source, not timeline slice(0,40)", () => {
    const now = new Date("2026-09-24T15:00:00.000Z");
    const initiatives: Initiative[] = [];
    for (let i = 0; i < 50; i += 1) {
      const day = String(1 + (i % 20)).padStart(2, "0");
      initiatives.push(
        initiative({
          initiativeId: `init-${i}`,
          title: `Initiative ${i}`,
          createdAt: `2026-09-${day}T10:00:00.000Z`,
          updatedAt: `2026-09-${day}T10:00:00.000Z`,
        }),
      );
    }
    const snapshot = buildCivicActivitySnapshot(emptySource({ initiatives }));
    assert.equal(snapshot.timeline.length, 40);
    const unique = collectCivicTimelineEntries(emptySource({ initiatives }));
    assert.ok(unique.length >= 50);
    const overTime = buildCivicActivityOverTime(unique, { now });
    assert.equal(overTime.actionsInPeriod, unique.filter((entry) => {
      const day = utcDayKey(entry.occurredAt);
      return day >= overTime.days[0]!.date && day <= overTime.days[overTime.days.length - 1]!.date;
    }).length);
    assert.ok(overTime.actionsInPeriod > 40 || unique.length <= 40);
    assert.notEqual(overTime.actionsInPeriod, snapshot.timeline.length);
  });

  it("4–7. daily bucketing, zero period, same-day multiples, boundary dates", () => {
    const now = new Date("2026-09-24T12:00:00.000Z");
    const empty = buildCivicActivityOverTime([], { now, windowDays: 30 });
    assert.equal(empty.actionsInPeriod, 0);
    assert.equal(empty.activeCivicDays, 0);
    assert.equal(empty.days.every((day) => day.actionCount === 0), true);
    assert.equal(empty.days[0]!.date, "2026-08-26");
    assert.equal(empty.days[29]!.date, "2026-09-24");

    const entries: CivicTimelineEntry[] = [
      {
        id: "a",
        type: "initiative_created",
        detail: "A",
        occurredAt: "2026-09-24T01:00:00.000Z",
      },
      {
        id: "b",
        type: "initiative_created",
        detail: "B",
        occurredAt: "2026-09-24T22:00:00.000Z",
      },
      {
        id: "c",
        type: "analysis_published",
        detail: "C",
        occurredAt: "2026-08-26T00:00:00.000Z",
      },
      {
        id: "outside",
        type: "vote_cast",
        detail: "Old",
        occurredAt: "2026-08-25T23:59:59.000Z",
      },
    ];
    const series = buildCivicActivityOverTime(entries, { now, windowDays: 30 });
    assert.equal(series.days[29]!.actionCount, 2);
    assert.equal(series.days[0]!.actionCount, 1);
    assert.equal(series.actionsInPeriod, 3);
    assert.equal(series.activeCivicDays, 2);
  });

  it("8. duplicate event ids are counted once", () => {
    const dupes: CivicTimelineEntry[] = [
      {
        id: "same",
        type: "initiative_created",
        detail: "One",
        occurredAt: "2026-09-20T10:00:00.000Z",
      },
      {
        id: "same",
        type: "initiative_created",
        detail: "Dup",
        occurredAt: "2026-09-20T11:00:00.000Z",
      },
    ];
    const unique = dedupeCivicTimelineEntries(dupes);
    assert.equal(unique.length, 1);
    const series = buildCivicActivityOverTime(unique, {
      now: new Date("2026-09-24T00:00:00.000Z"),
    });
    assert.equal(series.actionsInPeriod, 1);
  });

  it("9–11. status totals, vote semantics, proposed not stacked", () => {
    const initiatives = [
      initiative({
        initiativeId: "i1",
        title: "Draft",
        lifecyclePhase: "draft",
        updatedAt: "2026-09-10T00:00:00.000Z",
      }),
      initiative({
        initiativeId: "i2",
        title: "Pub",
        lifecyclePhase: "published",
        updatedAt: "2026-09-11T00:00:00.000Z",
      }),
      initiative({
        initiativeId: "i3",
        title: "Arch",
        lifecyclePhase: "archived",
        updatedAt: "2026-09-12T00:00:00.000Z",
      }),
    ];
    const vote: MyDecisionVoteRecord = {
      decisionQuestion: "Q?",
      initiativeId: "i2",
      vote: {
        voteId: "v1",
        decisionId: "d1",
        version: 1,
        choice: "support",
        updatedAt: "2026-09-13T00:00:00.000Z",
      } as InitiativeDecisionVote,
    };
    const commitments = [
      {
        commitmentId: "c1",
        participantId: "p1",
        proposalStatus: "accepted",
        acceptedAt: "2026-09-14T00:00:00.000Z",
        status: "published",
        commitmentTitle: "Accepted",
        updatedAt: "2026-09-14T00:00:00.000Z",
        publishedAt: "2026-09-14T00:00:00.000Z",
      } as InitiativeImplementationCommitment,
      {
        commitmentId: "c2",
        participantId: "p1",
        proposalStatus: "proposed",
        status: "draft",
        commitmentTitle: "Invite",
        updatedAt: "2026-09-15T00:00:00.000Z",
      } as InitiativeImplementationCommitment,
    ];
    const snapshot = buildCivicActivitySnapshot(
      emptySource({ initiatives, votes: [vote], commitments }),
    );
    const initiativesGroup = snapshot.groups.find((group) => group.id === "initiatives");
    assert.equal(initiativesGroup?.kind, "active");
    if (initiativesGroup?.kind === "active") {
      assert.equal(initiativesGroup.metrics.total, 3);
      assert.equal(initiativesGroup.metrics.draft, 1);
      assert.equal(initiativesGroup.metrics.published, 1);
      assert.equal(initiativesGroup.metrics.completed, 1);
    }
    const decisions = snapshot.groups.find((group) => group.id === "decision-participation");
    assert.equal(decisions?.kind, "active");
    if (decisions?.kind === "active") {
      assert.equal(decisions.metrics.votesCast, 1);
      assert.match(String(decisions.noteKey), /decisionVotesLinked/);
    }
    const commitmentsGroup = snapshot.groups.find(
      (group) => group.id === "implementation-commitments",
    );
    assert.equal(commitmentsGroup?.kind, "active");
    if (commitmentsGroup?.kind === "active") {
      assert.equal(commitmentsGroup.metrics.total, 1);
      assert.equal(commitmentsGroup.metrics.proposed, 1);
    }
    const workspace = readWeb("features/civic-activity/components/MyCivicActivityWorkspace.tsx");
    assert.match(workspace, /proposedInvitations/);
    assert.match(workspace, /DecisionGroupedBars/);
    assert.doesNotMatch(
      workspace,
      /proposed[\s\S]{0,80}segments\.push|segments\.push[\s\S]{0,80}proposed/,
    );
  });

  it("12. desktop grid supports 8 cards / two columns", () => {
    const css = readWeb("features/civic-activity/components/civic-activity-workspace.css");
    assert.match(
      css,
      /@media \(min-width:\s*768px\)\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
    assert.match(css, /\.civic-activity-workspace__cards[\s\S]*minmax\(0,\s*1fr\)/);
  });

  it("13–16. mobile disclosure, aria-expanded, keyboard-capable button", () => {
    const workspace = readWeb("features/civic-activity/components/MyCivicActivityWorkspace.tsx");
    const css = readWeb("features/civic-activity/components/civic-activity-workspace.css");
    assert.match(workspace, /aria-expanded=\{expanded\}/);
    assert.match(workspace, /aria-controls=\{controlsId\}/);
    assert.match(workspace, /type="button"/);
    assert.match(workspace, /charts\.showDetails/);
    assert.match(workspace, /charts\.hideDetails/);
    assert.match(css, /@media \(max-width:\s*767px\)/);
    assert.match(css, /data-expanded="true"/);
    assert.match(css, /\.civic-activity-card__disclosure/);
    assert.match(css, /:focus-visible/);
  });

  it("17. accessible chart representation uses role=img + aria-label", () => {
    const charts = readWeb("features/civic-activity/components/civic-activity-charts.tsx");
    assert.match(charts, /role="img"/);
    assert.match(charts, /aria-label=\{ariaLabel\}/);
    assert.match(charts, /aria-hidden="true"/);
  });

  it("18. RTL does not reverse chronological day order", () => {
    const overTime = readWeb("features/civic-activity/lib/civic-activity-over-time.ts");
    const charts = readWeb("features/civic-activity/components/civic-activity-charts.tsx");
    assert.match(overTime, /oldest → newest/);
    assert.doesNotMatch(overTime, /reverse\(|\.reverse\(/);
    assert.doesNotMatch(charts, /dir\s*===\s*["']rtl["'][\s\S]{0,80}reverse/);
    assert.doesNotMatch(charts, /\["']ar["']|\["']he["']/);
  });

  it("19. 320px responsive contract avoids fixed overflow widths", () => {
    const css = readWeb("features/civic-activity/components/civic-activity-workspace.css");
    assert.match(css, /max-width:\s*100%/);
    assert.match(css, /min-width:\s*0/);
    assert.match(css, /\.civic-activity-chart__svg[\s\S]*width:\s*100%/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
    assert.doesNotMatch(css, /\.civic-activity-chart[^{]*\{[^}]*width:\s*\d{3,}px/s);
  });

  it("20. no new chart dependency", () => {
    const rootPkg = readFileSync(path.resolve(webRoot, "../../package.json"), "utf8");
    const webPkg = readFileSync(path.join(webRoot, "package.json"), "utf8");
    for (const source of [rootPkg, webPkg]) {
      assert.doesNotMatch(source, /"recharts"|"chart\.js"|"d3"|"victory"|"@nivo"|"@visx"|"echarts"/);
    }
  });

  it("21–23. catalog keys in bundled packs; universal coverage; no locale branch", async () => {
    for (const locale of ["en", "uk", "ar", "zh-Hant"] as const) {
      const { messages } = await loadUiMessagesForLocale(locale);
      const civic = messages.civicActivity as Record<string, unknown>;
      const groups = civic.groups as Record<string, string>;
      const charts = civic.charts as Record<string, string>;
      assert.equal(typeof groups["activity-over-time"], "string");
      assert.equal(typeof charts.showDetails, "string");
      assert.equal(typeof charts.civicActions, "string");
      assert.equal(typeof charts.overTimeEmpty, "string");
    }
    for (const pathKey of CHART_KEYS) {
      assert.equal(isParticipantWebUiRequiredPath(pathKey), true);
    }
    const scope = readFileSync(
      path.resolve(webRoot, "../../packages/types/src/domain/participant-web-ui-scope.ts"),
      "utf8",
    );
    assert.match(scope, /"civicActivity\."/);
    assert.doesNotMatch(scope, /civicActivity[\s\S]{0,40}\["']ka["']|\["']he["']/);
    assert.doesNotMatch(scope, /locale\s*===\s*["']ka["']/);
  });

  it("24–25. no chart npm import and timeline display cap remains", () => {
    const aggregate = readWeb("features/civic-activity/lib/aggregate-civic-activity.ts");
    assert.match(aggregate, /\.slice\(0,\s*40\)/);
    assert.match(aggregate, /buildCivicActivityOverTime\(uniqueTimeline\)/);
    const charts = readWeb("features/civic-activity/components/civic-activity-charts.tsx");
    assert.doesNotMatch(charts, /from ["']recharts|from ["']chart\.js|from ["']d3/);
  });
});
