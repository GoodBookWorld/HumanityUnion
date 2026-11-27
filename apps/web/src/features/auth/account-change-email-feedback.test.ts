/**
 * HU-UX-01D — Change Email feedback stays with the action that produced it.
 * Source contract plus viewport helper. No live email-change request.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isFeedbackFullyInViewport,
  revealContextualFeedback,
} from "./reveal-contextual-feedback";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing slice ${start} .. ${end}`);
  return source.slice(from, to);
}

describe("HU-UX-01D Change Email contextual feedback", () => {
  const panel = read("features/auth/components/AccountPanel.tsx");
  const css = read("features/auth/components/account-panel.css");
  const feedback = read("features/auth/components/AuthFeedbackMessage.tsx");
  const layout = read("app/layout.tsx");
  const emailHandler = sliceBetween(panel, "async function handleEmailChange", "async function handlePasswordChange");
  const accountSection = sliceBetween(panel, '<ProfileSection title={t("account")}>', "<AccountSecuritySection");
  const emailSection = sliceBetween(panel, '<ProfileSection title={t("changeEmail")}>', '<ProfileSection title={t("changePassword")}>');
  const passwordHandler = sliceBetween(panel, "async function handlePasswordChange", "async function handleRevokeOtherSessions");

  it("renders success and error feedback immediately after the Change Email submit control", () => {
    const buttonAt = emailSection.indexOf('{t("requestEmailChange")}');
    const feedbackAt = emailSection.indexOf("account-panel__action-feedback");
    assert.ok(buttonAt >= 0);
    assert.ok(feedbackAt > buttonAt);
    assert.match(emailSection, /disabled=\{submitting\}/);
    assert.match(emailSection, /type="submit"/);
    assert.match(emailSection, /required/);
    assert.match(emailHandler, /requestEmailChange\(newEmail\)/);
    assert.match(emailHandler, /variant: "success", text: t\("checkNewEmailInbox"\)/);
    assert.match(emailHandler, /variant: "error"/);
    assert.match(emailHandler, /t\("unableToRequestEmailChange"\)/);
    assert.match(emailSection, /AuthFeedbackMessage/);
    assert.match(emailSection, /emailFeedback\.variant === "success"/);
    assert.match(emailSection, /t\("accountUpdate"\)/);
    assert.match(emailSection, /t\("accountActionFailed"\)/);
  });

  it("does not duplicate Change Email feedback in the top account section", () => {
    assert.doesNotMatch(accountSection, /emailFeedback/);
    assert.doesNotMatch(accountSection, /checkNewEmailInbox/);
    assert.doesNotMatch(accountSection, /unableToRequestEmailChange/);
    assert.equal(panel.match(/checkNewEmailInbox/g)?.length, 1);
    assert.equal(panel.match(/unableToRequestEmailChange/g)?.length, 1);
  });

  it("keeps Change Email pending local and leaves other account feedback in place", () => {
    assert.match(emailHandler, /if \(submitting\) \{\s*return;\s*\}/);
    assert.match(emailHandler, /setEmailFeedback\(null\)/);
    assert.doesNotMatch(emailHandler, /setMessage\(/);
    assert.doesNotMatch(emailHandler, /setActionError\(/);
    assert.doesNotMatch(emailHandler, /setPasswordSuccess\(/);
    assert.match(passwordHandler, /setPasswordSuccess\(/);
    assert.match(panel, /onMessage=\{setMessage\}/);
    assert.match(panel, /onError=\{setActionError\}/);
    assert.match(panel, /setMessage\(t\("signedOutOtherSessions"/);
    assert.doesNotMatch(passwordHandler, /setEmailFeedback/);
  });

  it("preserves the existing verification instructions and field validation", () => {
    assert.match(accountSection, /pendingEmailChange/);
    assert.match(accountSection, /user\.pendingEmail/);
    assert.match(accountSection, /href="\/confirm-email"/);
    assert.match(accountSection, /tAuth\("confirmEmail"\)/);
    assert.match(emailSection, /type="email"/);
    assert.match(emailSection, /required/);
    assert.match(panel, /emailVerificationStatus === "verified"/);
  });

  it("announces success as status and errors as alerts through AuthFeedbackMessage", () => {
    assert.match(feedback, /role=\{role\}/);
    assert.match(feedback, /variant === "error" \? "alert" : "status"/);
    assert.match(feedback, /aria-live=\{variant === "error" \? "assertive" : "polite"\}/);
    assert.doesNotMatch(panel, /\.focus\(/);
  });

  it("stacks feedback under the button for desktop, mobile, LTR, and RTL", () => {
    assert.match(css, /\.account-panel__form \{\s*display: grid;/);
    assert.match(css, /\.account-panel__action-feedback \{[^}]*margin-block-start:/s);
    assert.match(css, /\.account-panel__action-feedback \{[^}]*max-width: 100%;/s);
    assert.doesNotMatch(css, /account-panel__action-feedback[\s\S]*margin-left/);
    assert.doesNotMatch(css, /account-panel__action-feedback[\s\S]*margin-right/);
    assert.doesNotMatch(css, /@media[^}]*account-panel__action-feedback/);
    assert.match(layout, /dir=\{documentLocale\.textDirection\}/);
    assert.doesNotMatch(emailSection, /dir="/);
  });

  it("scrolls the feedback node only when it is outside the viewport", () => {
    const effect = sliceBetween(panel, "useEffect(() => {\n    if (!emailFeedback)", "async function handleLogout");
    assert.match(effect, /revealContextualFeedback\(emailFeedbackRef\.current\)/);
    assert.match(effect, /\}, \[emailFeedback\]\)/);
    assert.equal(panel.match(/revealContextualFeedback\(/g)?.length, 1);

    assert.equal(
      isFeedbackFullyInViewport({ top: 10, left: 10, bottom: 80, right: 200 }, { width: 390, height: 700 }),
      true,
    );
    assert.equal(
      isFeedbackFullyInViewport({ top: 640, left: 16, bottom: 760, right: 360 }, { width: 390, height: 700 }),
      false,
    );
    assert.equal(
      isFeedbackFullyInViewport({ top: -20, left: 16, bottom: 40, right: 360 }, { width: 1280, height: 800 }),
      false,
    );

    const scrolled = installWindow({ width: 390, height: 700, reduce: false });
    const moved = revealContextualFeedback(
      fakeFeedback(scrolled, { top: 680, left: 12, bottom: 760, right: 370 }),
    );
    assert.equal(moved, true);
    assert.deepEqual(scrolled.calls[0], { block: "nearest", inline: "nearest", behavior: "smooth" });

    const reduced = installWindow({ width: 390, height: 700, reduce: true });
    revealContextualFeedback(fakeFeedback(reduced, { top: 680, left: 12, bottom: 760, right: 370 }));
    assert.equal(reduced.calls[0]?.behavior, "auto");

    const visible = installWindow({ width: 1280, height: 800, reduce: false });
    const stayed = revealContextualFeedback(
      fakeFeedback(visible, { top: 40, left: 24, bottom: 120, right: 480 }),
    );
    assert.equal(stayed, false);
    assert.equal(visible.calls.length, 0);
    assert.equal(revealContextualFeedback(null), false);
  });
});

function installWindow(options: { width: number; height: number; reduce: boolean }): {
  calls: ScrollIntoViewOptions[];
} {
  const calls: ScrollIntoViewOptions[] = [];
  const matchMedia = () => ({ matches: options.reduce });
  Object.assign(globalThis, {
    window: {
      innerWidth: options.width,
      innerHeight: options.height,
      matchMedia,
    },
    document: {
      documentElement: {
        clientWidth: options.width,
        clientHeight: options.height,
      },
    },
  });
  return { calls };
}

function fakeFeedback(
  installed: { calls: ScrollIntoViewOptions[] },
  rect: { top: number; right: number; bottom: number; left: number },
): HTMLElement {
  return {
    getBoundingClientRect: () => rect,
    scrollIntoView: (options?: ScrollIntoViewOptions) => {
      if (options) {
        installed.calls.push(options);
      }
    },
  } as unknown as HTMLElement;
}
