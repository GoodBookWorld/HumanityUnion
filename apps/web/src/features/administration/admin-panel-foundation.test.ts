import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isAdminAccountRole } from "./is-admin-role";
import {
  ADMIN_PANEL_SECTIONS,
  resolveAdminPanelSectionId,
} from "./admin-panel-sections";
import { ADMIN_OVERVIEW_STATISTIC_CARDS } from "./admin-overview-statistics-config";
import { buildWorkspaceNavGroups } from "../initiatives/components/build-workspace-nav-groups";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

const authoringRoute = { href: "/workspace/authoring", label: "Become an Author" };

describe("Admin Panel Pack 02 — navigation, overview & capability inventory", () => {
  it("Administration group order is Workspace → Administration → Civic Work", () => {
    const groups = buildWorkspaceNavGroups(authoringRoute, null, { showAdminPanel: true });
    const ids = groups.map((group) => group.id);

    assert.deepEqual(ids.slice(0, 3), ["workspace", "administration", "civic"]);
    assert.equal(ids.indexOf("administration") < ids.indexOf("settings"), true);
    assert.equal(ids.indexOf("administration") < ids.indexOf("public-profile"), true);
  });

  it("non-admin does not see Administration", () => {
    const groups = buildWorkspaceNavGroups(authoringRoute, null, { showAdminPanel: false });
    assert.equal(groups.some((group) => group.id === "administration"), false);
  });

  it("admin navigation renders canonical horizontal sections", () => {
    const labels = ADMIN_PANEL_SECTIONS.map((section) => section.label);
    assert.deepEqual(labels, [
      "Overview",
      "Views",
      "Participants",
      "Initiatives",
      "Publishing",
      "SEO",
      "Beta Access",
      "Platform",
      "Audit",
    ]);

    const nav = read("features/administration/components/AdminPanelNavigation.tsx");
    assert.match(nav, /ADMIN_PANEL_SECTIONS/);
    assert.match(nav, /overflow-x|admin-panel-navigation/);
    assert.match(read("features/administration/components/admin-panel-navigation.css"), /overflow-x:\s*auto/);
  });

  it("resolves active admin section from pathname", () => {
    assert.equal(resolveAdminPanelSectionId("/admin"), "overview");
    assert.equal(resolveAdminPanelSectionId("/admin/"), "overview");
    assert.equal(resolveAdminPanelSectionId("/admin/publishing"), "publishing");
    assert.equal(resolveAdminPanelSectionId("/admin/beta-access"), "beta-access");
  });

  it("isAdminAccountRole recognizes only the canonical admin role", () => {
    assert.equal(isAdminAccountRole("admin"), true);
    assert.equal(isAdminAccountRole("member"), false);
  });

  it("WorkspaceNavigation loads admin awareness from getMe (no parallel auth state)", () => {
    const nav = read("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /getMe/);
    assert.match(nav, /isAdminAccountRole/);
    assert.doesNotMatch(nav, /AuthProvider|useCurrentUser|createContext/);
  });

  it("/admin layout and pages independently enforce authorization", () => {
    const layout = read("app/admin/layout.tsx");
    assert.match(layout, /WorkspaceAuthGate/);
    assert.match(layout, /MemberWorkspace/);

    const overview = read("app/admin/page.tsx");
    assert.match(overview, /AdminAccessGate/);
    assert.match(overview, /AdminOverviewSection/);

    const gate = read("features/administration/components/AdminAccessGate.tsx");
    assert.match(gate, /getMe/);
    assert.match(gate, /isAdminAccountRole/);
    assert.match(gate, /Access restricted/);
    assert.doesNotMatch(gate, /showAdminPanel/);
  });

  it("direct URL authorization remains enforced on every admin section page", () => {
    for (const segment of [
      "views",
      "participants",
      "initiatives",
      "publishing",
      "seo",
      "beta-access",
      "platform",
      "audit",
    ]) {
      const page = read(`app/admin/${segment}/page.tsx`);
      assert.match(page, /AdminAccessGate/, `${segment} must use AdminAccessGate`);
    }
  });

  it("Overview never invents fallback statistics", () => {
    const overview = read("features/administration/components/AdminOverviewSection.tsx");
    assert.match(overview, /fetchPlatformStatistics/);
    assert.match(overview, /fetchMembershipStatistics/);
    assert.match(overview, /fetchPublicBlogPosts/);
    assert.match(overview, /PublicStatisticsGrid/);
    assert.match(overview, /Unavailable/);
    assert.doesNotMatch(overview, /\?\? 0/);
    assert.doesNotMatch(overview, /fallbackCount|fakeTotal|hardcodedStat/i);

    assert.equal(ADMIN_OVERVIEW_STATISTIC_CARDS.length, 12);
    for (const card of ADMIN_OVERVIEW_STATISTIC_CARDS) {
      assert.ok(card.key);
      assert.ok(card.label);
    }
  });

  it("Initiative and Publishing admin surfaces use canonical APIs", () => {
    const initiatives = read("features/administration/components/AdminInitiativesSection.tsx");
    assert.match(initiatives, /listAdminInitiatives/);
    assert.match(initiatives, /Deferred administrative commands/i);
    assert.doesNotMatch(initiatives, /saveInitiativeDraft|updatePublishedInitiative|createInitiativeDraft/);
    assert.doesNotMatch(initiatives, /listInitiatives\(\)/);

    const publishing = read("features/administration/components/AdminPublishingSection.tsx");
    assert.match(publishing, /listEditorialReviewQueue/);
    assert.match(publishing, /fetchPublicBlogPosts/);
    assert.match(publishing, /\/workspace\/editorial/);
  });

  it("Beta Access uses existing admin invite API; Audit/capabilities remain explicit gaps", () => {
    const beta = read("features/administration/components/AdminBetaAccessSection.tsx");
    assert.match(beta, /listBetaInvitesForAdmin|createBetaInviteForAdmin/);
    assert.match(read("features/administration/beta-invite-api.ts"), /\/api\/v1\/beta-invites/);

    const audit = read("features/administration/components/AdminAuditSection.tsx");
    assert.match(audit, /no Web-consumable HTTP route/i);

    const platform = read("features/administration/components/AdminPlatformSection.tsx");
    assert.match(platform, /getPlatformConfig/);
    assert.match(platform, /Capability grants \(gap\)/);
  });

  it("SEO section inventories existing indexing configuration without inventing a settings store", () => {
    const seo = read("features/administration/components/AdminSeoSection.tsx");
    assert.match(seo, /shouldDisallowSearchIndexing|resolvePlatformIndexingMode/);
    assert.match(seo, /robots\.txt/);
    assert.match(seo, /sitemap/);
    assert.doesNotMatch(seo, /localStorage|seoSettings|SEO_SETTINGS/);
  });
});
