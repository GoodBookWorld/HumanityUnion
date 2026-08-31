import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { DESKTOP_CAPSULE_NAVIGATION } from "../features/public-experience/constants.js";
import { resolveCurrentDestination } from "./components/resolve-current-destination.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Launch Readiness Pack 05 — Accessibility & Interaction Quality", () => {
  it("1 — Skip link targets main content and accepts focus", () => {
    const layout = read("design-system/components/HumanityLayout.tsx");
    assert.match(layout, /href="#main-content"/);
    assert.match(layout, /Skip to main content/);
    assert.match(layout, /id="main-content"/);
    assert.match(layout, /tabIndex=\{-1\}/);

    const polish = read("design-system/workspace-polish.css");
    assert.match(polish, /\.hu-skip-link:focus-visible/);
  });

  it("2 — Public header active links use aria-current correctly", () => {
    assert.equal(resolveCurrentDestination("/"), "Home");
    assert.equal(resolveCurrentDestination("/blog"), null);
    assert.equal(resolveCurrentDestination("/initiatives/public/x"), "Initiatives");
    assert.equal(DESKTOP_CAPSULE_NAVIGATION.length, 5);

    const header = read("design-system/components/HumanityHeader.tsx");
    assert.match(header, /aria-current=\{isCurrent \? "page" : undefined\}/);
  });

  it("3 — Icon-only buttons have accessible names", () => {
    const authTools = read("design-system/components/AuthenticatedHeaderTools.tsx");
    assert.match(authTools, /aria-label="Workspace"/);
    assert.match(authTools, /aria-label=\{resolveNotificationsAriaLabel/);

    const fab = read(
      "features/humanity-union-assistant/components/HumanityUnionAssistantFloatingButton.tsx",
    );
    assert.match(fab, /aria-label="Open Humanity Union Assistant"/);
    assert.doesNotMatch(fab, /hu-assistant-fab__sr/);

    const menu = read("design-system/components/HumanityHeaderMobileMenu.tsx");
    assert.match(menu, /aria-label=\{isOpen \? "Close navigation menu" : "Open navigation menu"\}/);
  });

  it("4 — Assistant dialog labelled correctly", () => {
    const modal = read(
      "features/humanity-union-assistant/components/HumanityUnionAssistantModal.tsx",
    );
    assert.match(modal, /role="dialog"/);
    assert.match(modal, /aria-modal="true"/);
    assert.match(modal, /aria-labelledby=\{titleId\}/);
    assert.match(modal, /Humanity Union Assistant/);
  });

  it("5 — Assistant restores focus on close", () => {
    const context = read("features/humanity-union-assistant/assistant-context.tsx");
    assert.match(context, /returnFocusRef/);
    assert.match(context, /focusTarget\?\.focus/);
    assert.match(context, /queueMicrotask/);
  });

  it("6 — ConfirmDialog labelled with focus restore and trap", () => {
    const dialog = read("design-system/components/ConfirmDialog.tsx");
    assert.match(dialog, /role="alertdialog"/);
    assert.match(dialog, /aria-modal="true"/);
    assert.match(dialog, /aria-labelledby=\{titleId\}/);
    assert.match(dialog, /previouslyFocusedRef/);
    assert.match(dialog, /trapTabKey/);
    assert.match(dialog, /restore\.focus/);
  });

  it("7 — Login/Register fields labelled and required communicated", () => {
    const login = read("features/auth/components/LoginForm.tsx");
    assert.match(login, /<span>\s*Email/);
    assert.match(login, /hu-visually-hidden">\(required\)/);
    assert.match(login, /required/);
    assert.match(login, /aria-required="true"/);

    const register = read("features/auth/components/RegisterForm.tsx");
    assert.match(register, /Display name/);
    assert.match(register, /hu-visually-hidden">\(required\)/);
    assert.match(register, /Create account/);
  });

  it("8 — Preferences controls labelled", () => {
    const prefs = read("features/preferences/components/PreferencesWorkspace.tsx");
    assert.match(prefs, /preferences-workspace__field/);
    assert.match(prefs, /Who can see my public profile/);
    assert.match(prefs, /<label/);
  });

  it("9 — selected Blog reaction programmatically exposed", () => {
    const reactions = read("features/blog/components/BlogReactionControls.tsx");
    assert.match(reactions, /aria-pressed=\{current === "helpful"/);
    assert.match(reactions, /aria-pressed=\{current === "not_helpful"/);
  });

  it("10 — comment composer labelled with described help", () => {
    const comments = read("features/blog/components/BlogCommentsSection.tsx");
    assert.match(comments, /htmlFor=\{composerId\}/);
    assert.match(comments, /Add a comment/);
    assert.match(comments, /aria-describedby=\{composerHelpId\}/);
  });

  it("11 — Member badge has meaningful semantics", () => {
    const surface = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /MemberStatusIndicator/);
    const indicator = read("features/member-profile/components/MemberStatusIndicator.tsx");
    assert.match(indicator, /MEMBER_STATUS_INDICATOR_LABEL/);
    assert.match(indicator, /alt=""/);
    assert.match(indicator, />Member</);
  });

  it("12 — Lifecycle status not color-only", () => {
    const nav = read(
      "features/public-initiative-experience/components/PublicInitiativeLifecycleNav.tsx",
    );
    assert.match(nav, /stage\.stateLabel/);
    assert.match(nav, /pie-lifecycle__state/);
  });

  it("13 — asynchronous save status has appropriate announcement where applicable", () => {
    const button = read("design-system/components/Button.tsx");
    assert.match(button, /ariaLive/);
    assert.match(button, /aria-live=\{ariaLive\}/);

    const save = read("features/member-profile/use-save-button-phase.ts");
    assert.match(save, /Saving…/);
    assert.match(save, /Saved/);
  });

  it("14 — mobile menu exposes open/closed state and traps focus", () => {
    const menu = read("design-system/components/HumanityHeaderMobileMenu.tsx");
    assert.match(menu, /aria-expanded=\{isOpen\}/);
    assert.match(menu, /aria-controls=\{menuId\}/);
    assert.match(menu, /role="dialog"/);
    assert.match(menu, /aria-modal="true"/);

    const header = read("design-system/components/HumanityHeader.tsx");
    assert.match(header, /trapTabKey/);
    assert.match(header, /getFocusableElements/);
    assert.match(header, /Escape/);
  });

  it("15 — reduced-motion rules exist for Home animations", () => {
    const hero = read("features/public-home-v2/components/hero-unity-visual.css");
    assert.match(hero, /prefers-reduced-motion:\s*reduce/);
    assert.match(hero, /\.hero-unity-globe__spin/);
    assert.match(hero, /animation:\s*none/);
  });

  it("16 — no positive tabindex introduced in Pack 05 helpers", () => {
    const focusTrap = read("design-system/focus-trap.ts");
    assert.doesNotMatch(focusTrap, /tabIndex\s*=\s*[1-9]|tabindex=["'][1-9]/);

    const layout = read("design-system/components/HumanityLayout.tsx");
    assert.match(layout, /tabIndex=\{-1\}/);
    assert.doesNotMatch(layout, /tabIndex=\{[1-9]/);
  });

  it("17 — TipTap toolbar controls named with pressed state", () => {
    const editor = read("features/blog/components/BlogRichTextEditor.tsx");
    assert.match(editor, /role="toolbar"/);
    assert.match(editor, /aria-label="Article formatting"/);
    assert.match(editor, /aria-label=\{props\.label\}/);
    assert.match(editor, /aria-pressed=\{props\.active\}/);
  });

  it("18 — Notification unread state has non-color indication", () => {
    const card = read("features/notifications/components/CommunicationCard.tsx");
    assert.match(card, /unreadLabel/);
    assert.match(card, /communication-card__visually-hidden/);
    assert.match(card, /aria-hidden="true"/);
  });

  it("19 — Messages send/composer controls named", () => {
    const conversation = read("features/direct-messaging/components/DirectConversationView.tsx");
    assert.match(conversation, /htmlFor="direct-message-composer-input"/);
    assert.match(conversation, /Message \{detail\.otherParticipant\.displayName\}/);
    assert.match(conversation, /Sending…|Send/);
    assert.match(conversation, /aria-label="Message actions"/);
  });

  it("20 — no obvious duplicate active DOM controls at responsive breakpoints", () => {
    const header = read("design-system/components/HumanityHeader.tsx");
    assert.match(header, /humanity-header__nav--desktop/);
    assert.match(header, /HumanityHeaderMobileMenu/);

    const css = read("design-system/layout.css");
    assert.match(
      css,
      /\.humanity-header__nav--desktop,\s*\n\s*\.humanity-header__utility--desktop\s*\{[^}]*display:\s*none/s,
    );
  });

  it("canonical visually-hidden utility exists in Design System", () => {
    const css = read("design-system/components.css");
    assert.match(css, /\.hu-visually-hidden/);
    assert.match(css, /\.visually-hidden/);
  });

  it("Blog rich-text editor restores focus-visible affordance", () => {
    const css = read("features/blog/publishing.css");
    assert.match(css, /\.blog-rich-text:focus-within/);
    assert.match(css, /--hu-focus-ring/);
  });

  it("WorkspaceNavigation keeps aria-controls target mounted when collapsed", () => {
    const nav = read("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /hidden=\{collapsed\}/);
    assert.match(nav, /aria-controls=\{`workspace-nav-group-\$\{group\.id\}`\}/);
    assert.match(nav, /getCollapsedNavigationGroups\(\)/);
  });
});
