import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_OVERVIEW_METRIC_ORDER,
  ADMIN_OVERVIEW_STATISTIC_CARDS,
} from "./admin-overview-statistics-config";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Admin Panel Pack 04 — Overview information design + Proposal aggregate", () => {
  it("Operational Overview has exactly 12 metrics in approved order", () => {
    assert.equal(ADMIN_OVERVIEW_STATISTIC_CARDS.length, 12);
    assert.deepEqual(
      ADMIN_OVERVIEW_METRIC_ORDER,
      [
        "countries",
        "regions",
        "users",
        "humanityUnionMembers",
        "authors",
        "publishedBlogPosts",
        "initiatives",
        "proposals",
        "collectiveDecisions",
        "civicActionPackages",
        "officialResponses",
        "civicArchive",
      ],
    );

    assert.deepEqual(
      ADMIN_OVERVIEW_STATISTIC_CARDS.map((card) => card.label),
      [
        "Countries",
        "Regions",
        "Participants",
        "Members",
        "Authors",
        "Published Blog posts",
        "Initiatives",
        "Proposals",
        "Collective Decisions",
        "Civic Action Packages",
        "Official Responses",
        "Civic Archive",
      ],
    );

    assert.equal(
      ADMIN_OVERVIEW_STATISTIC_CARDS.some((card) => /subscriber/i.test(card.label)),
      false,
    );
    assert.equal(
      ADMIN_OVERVIEW_STATISTIC_CARDS.some((card) => card.key === "activeMembers"),
      false,
    );
  });

  it("uses canonical icons for Authors, Blog, and Proposals", () => {
    const byKey = Object.fromEntries(
      ADMIN_OVERVIEW_STATISTIC_CARDS.map((card) => [card.key, card.iconSrc]),
    );

    assert.equal(byKey.authors, "/icons/workspace/author.svg");
    assert.equal(byKey.publishedBlogPosts, "/icons/workspace/blog.svg");
    assert.equal(byKey.proposals, "/icons/workspace/proposals.svg");

    for (const icon of ["author.svg", "blog.svg", "proposals.svg"]) {
      assert.equal(existsSync(path.resolve(webSrc, `../public/icons/workspace/${icon}`)), true);
    }
  });

  it("Overview uses 6+6 desktop grid contract and 4-column Administrator/Platform grids", () => {
    const overview = read("features/administration/components/AdminOverviewSection.tsx");
    const css = read("features/administration/components/admin-panel.css");

    assert.match(overview, /AdminMetricDetailsGrid/);
    assert.match(overview, /Technical details/);
    assert.match(overview, /userId/);
    assert.match(overview, /memberId/);
    assert.match(overview, /admin-panel__statistics--overview/);
    assert.match(overview, /Registration \/ invite gate/);
    assert.match(overview, /activity measurement window/);
    assert.doesNotMatch(overview, /listEditorialReviewQueue/);
    assert.doesNotMatch(overview, /ProfileField/);

    assert.match(css, /admin-panel__statistics--overview/);
    assert.match(css, /repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(css, /admin-metric-details-grid/);
    assert.match(css, /repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(css, /admin-metric-details-grid__cell--alt/);
  });

  it("Participant aggregates include Active Window and Application started", () => {
    const participants = read("features/administration/components/AdminParticipantsSection.tsx");

    assert.match(participants, /AdminMetricDetailsGrid/);
    assert.match(participants, /Total Participants/);
    assert.match(participants, /Recently Active/);
    assert.match(participants, /Active Window/);
    assert.match(participants, /Application started/);
    assert.match(participants, /activity measurement window/);
    assert.match(participants, /methodological:\s*true/);
    assert.match(participants, /listAdminParticipants/);
    assert.match(participants, /WorkspaceStatusBadge/);
    assert.match(participants, /AdminAccessGate|Deferred administrative commands/);
    assert.doesNotMatch(participants, /ProfileField/);
  });

  it("Views → Insights no longer duplicates Operational totals", () => {
    const insights = read("features/administration/components/AdminViewsInsightsSection.tsx");

    assert.doesNotMatch(insights, /Operational totals/);
    assert.doesNotMatch(insights, /ADMIN_OVERVIEW_STATISTIC_CARDS/);
    assert.doesNotMatch(insights, /PublicStatisticsGrid/);
    assert.match(insights, /fetchAdminTrafficInsights/);
    assert.match(insights, /\/admin/);
    assert.doesNotMatch(insights, /\?\? 0|fakeViews|sampleTraffic/i);
  });
});
