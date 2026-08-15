import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isAdminAccountRole } from "./is-admin-role";
import { buildWorkspaceNavGroups } from "../initiatives/components/build-workspace-nav-groups";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

const authoringRoute = { href: "/workspace/authoring", label: "Become an Author" };

describe("Admin Panel foundation", () => {
  it("isAdminAccountRole recognizes only the canonical admin role", () => {
    assert.equal(isAdminAccountRole("admin"), true);
    assert.equal(isAdminAccountRole("member"), false);
    assert.equal(isAdminAccountRole("moderator"), false);
    assert.equal(isAdminAccountRole(null), false);
    assert.equal(isAdminAccountRole(undefined), false);
  });

  it("admin sees Administration → Admin Panel in Workspace nav groups", () => {
    const groups = buildWorkspaceNavGroups(authoringRoute, null, { showAdminPanel: true });
    const administration = groups.find((group) => group.id === "administration");

    assert.ok(administration);
    assert.equal(administration.label, "Administration");
    assert.deepEqual(administration.routes, [{ href: "/admin", label: "Admin Panel" }]);
  });

  it("non-admin does not see the Administration group", () => {
    const groups = buildWorkspaceNavGroups(authoringRoute, null, { showAdminPanel: false });
    assert.equal(
      groups.some((group) => group.id === "administration"),
      false,
    );
    assert.equal(
      groups.some((group) => group.routes.some((route) => route.href === "/admin")),
      false,
    );
  });

  it("WorkspaceNavigation loads admin awareness from getMe role (no parallel auth state)", () => {
    const nav = read("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /getMe/);
    assert.match(nav, /isAdminAccountRole/);
    assert.match(nav, /showAdminPanel/);
    assert.match(nav, /buildWorkspaceNavGroups/);
    assert.doesNotMatch(nav, /AuthProvider|useCurrentUser|createContext/);
  });

  it("/admin page uses WorkspaceAuthGate and AdminPanelPageContent", () => {
    const page = read("app/admin/page.tsx");
    assert.match(page, /WorkspaceAuthGate/);
    assert.match(page, /AdminPanelPageContent/);
    assert.match(page, /Admin Panel/);
    assert.match(page, /MemberWorkspace/);
    assert.match(page, /WorkspaceNavigation/);
  });

  it("AdminPanelPageContent independently enforces admin authorization via getMe", () => {
    const content = read("features/administration/components/AdminPanelPageContent.tsx");
    assert.match(content, /getMe/);
    assert.match(content, /isAdminAccountRole/);
    assert.match(content, /Access restricted/);
    assert.match(content, /Administrators only/);
    assert.match(content, /StatusBanner/);
    // Must not treat nav visibility as sufficient authorization.
    assert.doesNotMatch(content, /showAdminPanel/);
  });

  it("unauthenticated users are gated to login via WorkspaceAuthGate returnTo", () => {
    const gate = read("features/auth/components/WorkspaceAuthGate.tsx");
    assert.match(gate, /useClientAuthStatus/);
    assert.match(gate, /\/login\?returnTo=/);
    assert.match(gate, /unauthenticated/);

    const page = read("app/admin/page.tsx");
    assert.match(page, /WorkspaceAuthGate/);
  });

  it("direct /admin URL cannot bypass authorization (role check on page content)", () => {
    const page = read("app/admin/page.tsx");
    const content = read("features/administration/components/AdminPanelPageContent.tsx");

    assert.match(page, /AdminPanelPageContent/);
    assert.match(content, /role/);
    assert.match(content, /isAdminAccountRole\(currentUser\.role\)/);
    assert.match(content, /setDenied\(true\)/);
  });

  it("foundation reuses Workspace visual language and defers unimplemented admin sections", () => {
    const content = read("features/administration/components/AdminPanelPageContent.tsx");
    assert.match(content, /ProfileSection/);
    assert.match(content, /ProfileField/);
    assert.match(content, /Platform \/ Administration status/);
    assert.match(content, /\/workspace\/editorial/);
    assert.match(content, /title="Participants" placeholder/);
    assert.match(content, /title="Beta Access" placeholder/);
    assert.match(content, /title="Platform Capabilities" placeholder/);
    assert.match(content, /title="Audit" placeholder/);
    assert.doesNotMatch(content, /\/api\/v1\/admin/);
  });
});
