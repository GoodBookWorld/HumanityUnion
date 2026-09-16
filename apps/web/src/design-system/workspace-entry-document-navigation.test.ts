/**
 * Workspace entry uses full document navigation (plain <a>), not Next.js Link
 * soft navigation — Chrome Translate + soft nav can white-screen on first click.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "..");

function readDesign(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

/** Slice HeaderWorkspaceLink so Notifications Link assertions stay separate. */
function headerWorkspaceLinkSource(tools: string): string {
  const start = tools.indexOf("export function HeaderWorkspaceLink");
  const end = tools.indexOf("export function HeaderNotificationsLink");
  assert.ok(start >= 0 && end > start, "HeaderWorkspaceLink block not found");
  return tools.slice(start, end);
}

/** Slice authenticated mobile Workspace anchor only. */
function mobileWorkspaceEntrySource(mobile: string): string {
  const authBlockStart = mobile.indexOf('authStatus === "unauthenticated"');
  assert.ok(authBlockStart >= 0);
  const workspaceHref = mobile.indexOf('href="/workspace"', authBlockStart);
  assert.ok(workspaceHref >= 0);
  const open = mobile.lastIndexOf("<a", workspaceHref);
  const close = mobile.indexOf("</a>", workspaceHref);
  assert.ok(open >= 0 && close > open);
  return mobile.slice(open, close + "</a>".length);
}

/** Slice PWA bottom-nav Workspace item only. */
function pwaWorkspaceEntrySource(nav: string): string {
  const workspaceHref = nav.indexOf('href="/workspace"');
  assert.ok(workspaceHref >= 0);
  const open = nav.lastIndexOf("<a", workspaceHref);
  const close = nav.indexOf("</a>", workspaceHref);
  assert.ok(open >= 0 && close > open);
  return nav.slice(open, close + "</a>".length);
}

describe("Workspace entry document navigation (Chrome Translate safe)", () => {
  it("desktop HeaderWorkspaceLink is a real document-navigation anchor", () => {
    const tools = readDesign("components/AuthenticatedHeaderTools.tsx");
    const workspace = headerWorkspaceLinkSource(tools);

    assert.match(workspace, /href="\/workspace"/);
    assert.match(workspace, /<a\b/);
    assert.doesNotMatch(workspace, /<Link\b/);
    assert.match(workspace, /humanity-header__icon-link/);
    assert.match(workspace, /humanity-header__icon-link--active/);
    assert.match(workspace, /aria-label=\{workspaceLabel\}/);
    assert.match(workspace, /title=\{workspaceLabel\}/);
    assert.match(workspace, /aria-current=\{isActive \? "page" : undefined\}/);
    assert.match(workspace, /translate="no"/);
    assert.match(workspace, /WORKSPACE_ICON|work\.svg/);
  });

  it("desktop Notifications remains Next.js Link soft navigation", () => {
    const tools = readDesign("components/AuthenticatedHeaderTools.tsx");
    const notifications = tools.slice(tools.indexOf("export function HeaderNotificationsLink"));
    assert.match(notifications, /<Link\b/);
    assert.match(notifications, /href="\/notifications"/);
    assert.doesNotMatch(notifications, /translate="no"/);
  });

  it("mobile Workspace entry uses the same document-navigation contract", () => {
    const mobile = readDesign("components/HumanityHeaderMobileMenu.tsx");
    const workspace = mobileWorkspaceEntrySource(mobile);

    assert.match(workspace, /href="\/workspace"/);
    assert.match(workspace, /<a\b/);
    assert.doesNotMatch(workspace, /<Link\b/);
    assert.match(workspace, /humanity-header__mobile-nav-link/);
    assert.match(workspace, /tNav\("workspace"\)/);
    assert.match(workspace, /translate="no"/);
    assert.doesNotMatch(workspace, /onClick=/);
  });

  it("mobile Notifications and Member retain Next.js Link behavior", () => {
    const mobile = readDesign("components/HumanityHeaderMobileMenu.tsx");
    assert.match(mobile, /<Link[\s\S]*href="\/notifications"/);
    assert.match(mobile, /<Link[\s\S]*href="\/member"/);
    assert.match(mobile, /onClick=\{handleLinkClick\}/);
  });

  it("PWA bottom-nav Workspace entry uses document navigation", () => {
    const nav = readWeb("features/pwa/components/PwaBottomNav.tsx");
    const workspace = pwaWorkspaceEntrySource(nav);

    assert.match(workspace, /href="\/workspace"/);
    assert.match(workspace, /<a\b/);
    assert.doesNotMatch(workspace, /<Link\b/);
    assert.match(workspace, /hu-pwa-bottom-nav__item/);
    assert.match(workspace, /aria-current=\{workspaceCurrent \? "page" : undefined\}/);
    assert.match(workspace, /tNav\("workspace"\)/);
    assert.match(workspace, /translate="no"/);
  });

  it("PWA bottom-nav non-Workspace items remain Next.js Links", () => {
    const nav = readWeb("features/pwa/components/PwaBottomNav.tsx");
    assert.match(nav, /<Link[\s\S]*href="\/initiatives"/);
    assert.match(nav, /<Link[\s\S]*href="\/notifications"/);
  });

  it("internal Workspace navigation remains Next.js Link", () => {
    const personal = readWeb(
      "features/workspace-home/components/WorkspacePersonalHeader.tsx",
    );
    assert.match(personal, /from "next\/link"/);
    assert.match(personal, /<Link[\s\S]*href="\/workspace"/);
  });
});
