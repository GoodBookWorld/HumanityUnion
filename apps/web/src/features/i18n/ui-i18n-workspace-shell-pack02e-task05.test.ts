/**
 * Production Completion Pack 02E Task 05 — workspace / account shell chrome (`workspace.*`).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "./catalog-parity.js";
import {
  loadUiMessagesForLocale,
  resolveMergedMessage,
} from "./load-ui-messages.js";
import {
  resolveBlogNavLabelDisplay,
  resolveWorkspaceNavDisplayLabelFromMessages,
} from "../initiatives/components/workspace-nav-i18n.js";
import { buildWorkspaceNavGroups } from "../initiatives/components/build-workspace-nav-groups.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Production Completion Pack 02E Task 05 — workspace/account shell extraction", () => {
  it("Workspace navigation presentation resolves en/uk/zh-Hant/ar", async () => {
    const expected = {
      en: { profile: "Profile", messages: "Messages", notifications: "Notifications" },
      uk: { profile: "Профіль", messages: "Повідомлення", notifications: "Сповіщення" },
      "zh-Hant": { profile: "個人檔案", messages: "訊息", notifications: "通知" },
      ar: { profile: "الملف الشخصي", messages: "الرسائل", notifications: "الإشعارات" },
    } as const;

    for (const locale of Object.keys(expected) as Array<keyof typeof expected>) {
      const pack = await loadUiMessagesForLocale(locale);
      const row = expected[locale];
      assert.equal(
        resolveWorkspaceNavDisplayLabelFromMessages("Profile", pack.messages),
        row.profile,
      );
      assert.equal(
        resolveWorkspaceNavDisplayLabelFromMessages("Messages", pack.messages),
        row.messages,
      );
      assert.equal(
        resolveWorkspaceNavDisplayLabelFromMessages("Notifications", pack.messages),
        row.notifications,
      );
      assert.equal(
        resolveWorkspaceNavDisplayLabelFromMessages("Workspace", pack.messages),
        resolveMergedMessage(pack.messages, "navigation", "workspace"),
      );
      assert.equal(
        resolveWorkspaceNavDisplayLabelFromMessages("Account Security", pack.messages),
        resolveMergedMessage(pack.messages, "auth", "accountSecurity"),
      );
    }

    const nav = readWeb("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /resolveWorkspaceNavDisplayLabel/);
    assert.match(nav, /useTranslations\("workspace"\)/);
  });

  it("authenticated header shell labels resolve", async () => {
    const en = await loadUiMessagesForLocale("en");
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(resolveMergedMessage(en.messages, "workspace", "notifications"), "Notifications");
    assert.equal(resolveMergedMessage(uk.messages, "workspace", "notifications"), "Сповіщення");
    assert.equal(resolveMergedMessage(en.messages, "navigation", "workspace"), "Workspace");

    const header = readWeb("design-system/components/AuthenticatedHeaderTools.tsx");
    assert.match(header, /useTranslations\("navigation"\)/);
    assert.match(header, /useTranslations\("workspace"\)/);
    assert.match(header, /href="\/workspace"/);
    assert.match(header, /href="\/notifications"/);
    assert.doesNotMatch(header, /aria-label="Workspace"/);

    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    assert.match(mobile, /tNav\("workspace"\)/);
    assert.match(mobile, /tWorkspace\("notifications"\)/);
    assert.match(mobile, /tWorkspace\("profile"\)/);
  });

  it("Account shell labels resolve", async () => {
    const locales = ["en", "uk", "zh-Hant", "ar"] as const;
    for (const locale of locales) {
      const pack = await loadUiMessagesForLocale(locale);
      assert.ok(resolveMergedMessage(pack.messages, "workspace", "account"));
      assert.ok(resolveMergedMessage(pack.messages, "workspace", "displayName"));
      assert.ok(resolveMergedMessage(pack.messages, "workspace", "role"));
      assert.ok(resolveMergedMessage(pack.messages, "workspace", "status"));
    }

    const panel = readWeb("features/auth/components/AccountPanel.tsx");
    assert.match(panel, /useTranslations\("workspace"\)/);
    assert.match(panel, /t\("displayName"\)/);
    assert.match(panel, /value: user\.role/);
    assert.match(panel, /value: user\.status/);
    assert.match(panel, /emailVerificationStatus === "verified"/);

    const page = readWeb("app/account/page.tsx");
    assert.match(page, /getTranslations\("workspace"\)/);
    assert.match(page, /t\("account"\)/);
  });

  it("desktop/mobile/drawer variants share presentation contract", () => {
    const nav = readWeb("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /resolveWorkspaceNavDisplayLabel/);
    assert.match(nav, /onNavigate/);

    const drawer = readWeb("features/pwa/components/PwaWorkspaceDrawer.tsx");
    assert.match(drawer, /WorkspaceNavigation onNavigate=\{handleNavigate\}/);
    assert.match(drawer, /tWorkspace\("closeMenu"\)/);
    assert.match(drawer, /tNav\("workspace"\)/);

    const browser = readWeb("design-system/components/BrowserWorkspaceHeaderControls.tsx");
    assert.match(browser, /PwaWorkspaceDrawer/);
    assert.match(browser, /tWorkspace\("openMenu"\)/);
  });

  it("routes and permissions/filtering remain unchanged", () => {
    const groups = readWeb("features/initiatives/components/build-workspace-nav-groups.ts");
    assert.match(groups, /id: "workspace"/);
    assert.match(groups, /id: "civic"/);
    assert.match(groups, /id: "settings"/);
    assert.match(groups, /href: "\/workspace"/);
    assert.match(groups, /href: "\/member"/);
    assert.match(groups, /href: "\/workspace\/messages"/);
    assert.match(groups, /href: "\/notifications"/);
    assert.match(groups, /showAdminPanel/);
    assert.match(groups, /showEditorPanel/);

    const built = buildWorkspaceNavGroups(
      { href: "/workspace/authoring", label: "Become an Author" },
      { href: "/workspace/editorial", label: "Editorial Review" },
      { showAdminPanel: true, showEditorPanel: true },
    );
    assert.deepEqual(
      built.map((group) => group.id),
      ["workspace", "administration", "civic", "settings", "public-profile"],
    );
    assert.ok(built.some((group) => group.routes.some((route) => route.href === "/admin")));
    assert.ok(
      built.some((group) => group.routes.some((route) => route.href === "/workspace/editor")),
    );

    const nav = readWeb("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /isAdminAccountRole\(user\.role\)/);
    assert.match(nav, /isEligibleForEditorPanel\(user\)/);
    assert.match(nav, /key=\{group\.id\}/);
    assert.match(nav, /key=\{route\.href\}/);
  });

  it("stable internal nav identities remain English; Blog navLabel contract unchanged", () => {
    const groups = readWeb("features/initiatives/components/build-workspace-nav-groups.ts");
    assert.match(groups, /label: "Profile"/);
    assert.match(groups, /label: "Messages"/);
    assert.match(groups, /label: "Notifications"/);

    const nav = readWeb("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /label: "Become an Author"/);
    assert.match(nav, /label: state\.navLabel/);
    assert.match(nav, /publishingWorkspaceHref/);
    assert.match(nav, /label: "Editorial Review"/);

    assert.equal(resolveBlogNavLabelDisplay("Become an Author", (key) => key), "becomeAnAuthor");
    assert.equal(resolveBlogNavLabelDisplay("Publishing", (key) => key), "publishing");
    assert.equal(resolveBlogNavLabelDisplay("Other", (key) => key), "Other");
  });

  it("role/status/domain tokens are not replaced by translated strings", () => {
    const panel = readWeb("features/auth/components/AccountPanel.tsx");
    assert.match(panel, /value: user\.role/);
    assert.match(panel, /value: user\.status/);
    assert.match(panel, /emailVerificationStatus === "verified"/);
    assert.doesNotMatch(panel, /value: t\("role"\)/);
    assert.doesNotMatch(panel, /user\.role = /);
  });

  it("lifecycle identifiers remain unchanged", () => {
    const groups = readWeb("features/initiatives/components/build-workspace-nav-groups.ts");
    assert.doesNotMatch(groups, /INITIATIVE_LIFECYCLE|Revision|Collaborative Analysis/);
    const nav = readWeb("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.doesNotMatch(nav, /INITIATIVE_LIFECYCLE|stage\.label/);
  });

  it("bundled catalog parity remains green; fallback fixture remains valid", async () => {
    const parity = await verifyBundledVerificationCatalogParity();
    assert.equal(parity.ok, true, JSON.stringify(parity.reports, null, 2));

    const en = await loadUiMessagesForLocale("en");
    assert.equal(resolveMergedMessage(en.messages, "workspace", "profile"), "Profile");
    assert.equal(resolveMergedMessage(en.messages, "workspace", "messages"), "Messages");

    const missing = compareCatalogParityToEnglish(
      en.messages,
      {
        workspace: { profile: "Профіль" },
      },
      "uk-workspace-missing-fixture",
    );
    assert.equal(missing.ok, false);
    assert.ok(missing.issues.some((issue) => issue.path === "workspace.messages"));

    const partial = {
      async load(locale: string) {
        if (locale !== "uk") {
          return null;
        }
        return {
          locale: "uk",
          source: "bundled" as const,
          messages: {
            workspace: { profile: "Профіль" },
          },
        };
      },
    };
    const merged = await loadUiMessagesForLocale("uk", [partial]);
    assert.equal(resolveMergedMessage(merged.messages, "workspace", "profile"), "Профіль");
    assert.equal(resolveMergedMessage(merged.messages, "workspace", "messages"), "Messages");
  });
});
