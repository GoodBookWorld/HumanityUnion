import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_PANEL_SECTIONS,
  ADMIN_VIEWS_SECTIONS,
  resolveAdminPanelSectionId,
  resolveAdminViewsSectionId,
} from "./admin-panel-sections";
import { isAdminAccountRole } from "./is-admin-role";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Admin Panel Pack 03 — Views & Participant directory", () => {
  it("Views appears in canonical Admin navigation after Overview", () => {
    const labels = ADMIN_PANEL_SECTIONS.map((section) => section.label);
    assert.deepEqual(labels.slice(0, 3), ["Overview", "Views", "Participants"]);
    assert.equal(resolveAdminPanelSectionId("/admin/views"), "views");
    assert.equal(resolveAdminPanelSectionId("/admin/views/insights"), "views");
  });

  it("Views secondary navigation has Traffic, Insights, Subscribers", () => {
    assert.deepEqual(
      ADMIN_VIEWS_SECTIONS.map((section) => section.label),
      ["Traffic", "Insights", "Subscribers"],
    );
    assert.equal(resolveAdminViewsSectionId("/admin/views"), "traffic");
    assert.equal(resolveAdminViewsSectionId("/admin/views/insights"), "insights");
    assert.equal(resolveAdminViewsSectionId("/admin/views/subscribers"), "subscribers");

    const nav = read("features/administration/components/AdminViewsNavigation.tsx");
    assert.match(nav, /ADMIN_VIEWS_SECTIONS/);
    assert.match(
      read("features/administration/components/admin-views-navigation.css"),
      /overflow-x:\s*auto/,
    );
  });

  it("Views routes enforce AdminAccessGate", () => {
    for (const relative of [
      "app/admin/views/page.tsx",
      "app/admin/views/insights/page.tsx",
      "app/admin/views/subscribers/page.tsx",
    ]) {
      assert.match(read(relative), /AdminAccessGate/);
    }
  });

  it("unsupported analytics metrics never invent values", () => {
    const traffic = read("features/administration/components/AdminViewsTrafficSection.tsx");
    assert.match(traffic, /AdminCapabilityGap/);
    assert.doesNotMatch(traffic, /\?\? 0|fakeViews|sampleTraffic/i);

    const subscribers = read(
      "features/administration/components/AdminViewsSubscribersSection.tsx",
    );
    assert.match(subscribers, /AdminCapabilityGap/);
    assert.match(subscribers, /Subscriber is not Participant/i);
    assert.match(subscribers, /Subscriber is not Member/i);

    assert.match(
      read("features/administration/components/AdminCapabilityGap.tsx"),
      /Not collected yet/,
    );
  });

  it("Insights uses existing operational aggregates only", () => {
    const insights = read("features/administration/components/AdminViewsInsightsSection.tsx");
    assert.match(insights, /fetchPlatformStatistics/);
    assert.match(insights, /PublicStatisticsGrid/);
    assert.match(insights, /AdminCapabilityGap/);
    assert.doesNotMatch(insights, /wordpress|ga4|posthog/i);
    assert.match(
      read("features/administration/components/AdminCapabilityGap.tsx"),
      /Not collected yet/,
    );
  });

  it("Participant directory UI uses admin API with pagination and filters", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /listAdminParticipants/);
    assert.match(section, /admin-participants-table/);
    assert.match(section, /Previous/);
    assert.match(section, /Next/);
    assert.match(section, /membershipStatus/);
    assert.doesNotMatch(section, /passwordHash|refreshToken|accessToken/);

    const api = read("features/administration/admin-participant-directory-api.ts");
    assert.match(api, /\/api\/v1\/admin\/participants/);
  });

  it("isAdminAccountRole remains canonical for client gates", () => {
    assert.equal(isAdminAccountRole("admin"), true);
    assert.equal(isAdminAccountRole("member"), false);
  });
});
