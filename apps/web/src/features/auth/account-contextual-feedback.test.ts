/**
 * HU-UX-01E.1 — each account action keeps its own feedback.
 * Source contract and viewport helper. No live account mutation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  queueContextualFeedbackReveal,
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

describe("HU-UX-01E.1 account contextual feedback", () => {
  const panel = read("features/auth/components/AccountPanel.tsx");
  const security = read("features/auth/components/AccountSecuritySection.tsx");
  const deletion = read("features/account-deletion/AccountDeletionSection.tsx");
  const contextual = read("features/auth/components/ContextualActionFeedback.tsx");
  const feedback = read("features/auth/components/AuthFeedbackMessage.tsx");
  const css = read("features/auth/components/account-panel.css");
  const layout = read("app/layout.tsx");
  const login = read("features/auth/components/LoginForm.tsx");
  const register = read("features/auth/components/RegisterForm.tsx");
  const codeFields = read("features/auth/components/AuthCodeVerificationFields.tsx");
  const accountSection = sliceBetween(
    panel,
    '<ProfileSection title={t("account")}>',
    "<AccountSecuritySection",
  );
  const emailHandler = sliceBetween(
    panel,
    "async function handleEmailChange",
    "async function handlePasswordChange",
  );
  const emailSection = sliceBetween(
    panel,
    '<ProfileSection title={t("changeEmail")}>',
    '<ProfileSection title={t("changePassword")}>',
  );
  const passwordHandler = sliceBetween(
    panel,
    "async function handlePasswordChange",
    "async function handleRevokeOtherSessions",
  );
  const passwordSection = sliceBetween(
    panel,
    '<ProfileSection title={t("changePassword")}>',
    '<ProfileSection title={t("sessions")}>',
  );
  const sessionHandler = sliceBetween(panel, "async function handleRevokeOtherSessions", "if (loading)");
  const sessionSection = sliceBetween(panel, '<ProfileSection title={t("sessions")}>', "<AccountDeletionSection");
  const securityStart = sliceBetween(security, "async function handleStart", "async function handleConfirm");
  const securityConfirm = sliceBetween(security, "async function handleConfirm", "async function handleResend");
  const requestForm = sliceBetween(deletion, "void handleRequest(event)", "codeSent && !deadline");
  const confirmForm = sliceBetween(deletion, "{codeSent && !deadline ?", "{deadline ?");

  it("keeps Change Email feedback after its own submit button", () => {
    const buttonAt = emailSection.indexOf('{t("requestEmailChange")}');
    const feedbackAt = emailSection.indexOf("account-panel__action-feedback");
    assert.ok(feedbackAt > buttonAt);
    assert.match(emailHandler, /checkNewEmailInbox/);
    assert.match(emailHandler, /requestEmailChange\(newEmail\)/);
    assert.doesNotMatch(accountSection, /checkNewEmailInbox/);
    assert.doesNotMatch(emailHandler, /setPasswordFeedback\(/);
    assert.doesNotMatch(emailHandler, /setSessionFeedback\(/);
  });

  it("places password success and errors below the Update Password button", () => {
    const buttonAt = passwordSection.indexOf('{t("updatePassword")}');
    const feedbackAt = passwordSection.indexOf("ContextualActionFeedback");
    assert.ok(feedbackAt > buttonAt);
    assert.match(passwordHandler, /text: t\("passwordChangedSuccess"\)/);
    assert.match(passwordHandler, /text: t\("passwordMismatch"\)/);
    assert.match(passwordHandler, /t\("unableToChangePassword"\)/);
    assert.match(passwordSection, /t\("passwordUpdated"\)/);
    assert.match(passwordSection, /t\("accountActionFailed"\)/);
    assert.equal(passwordSection.match(/<ContextualActionFeedback/g)?.length, 1);
    assert.doesNotMatch(accountSection, /passwordMismatch|passwordChangedSuccess|unableToChangePassword/);
    assert.match(passwordSection, /minLength=\{8\}/);
    assert.match(passwordSection, /required/);
  });

  it("places session revoke success and failure inside the sessions section", () => {
    const buttonAt = sessionSection.indexOf('{t("logOutOtherSessions")}');
    const feedbackAt = sessionSection.indexOf("ContextualActionFeedback");
    assert.ok(feedbackAt > buttonAt);
    assert.match(sessionHandler, /signedOutOtherSessions/);
    assert.match(sessionHandler, /unableToRevokeSessions/);
    assert.doesNotMatch(accountSection, /signedOutOtherSessions|unableToRevokeSessions/);
  });

  it("places security results under the security controls and keeps them after the code form closes", () => {
    const codeButtons = security.indexOf('{t("confirmEnable")}');
    const codeNotice = security.indexOf('{actionNotice("code")}');
    const settingButton = security.indexOf('{t("enableTwoStepLogin")}');
    const settingNotice = security.indexOf('{actionNotice("setting")}');
    assert.ok(codeNotice > codeButtons);
    assert.ok(settingNotice > settingButton);
    assert.match(securityConfirm, /resetFlow\(\);\s*setLocalMessage\(message\)/);
    assert.match(security, /twoStepEnabledSuccess/);
    assert.match(security, /twoStepDisabledSuccess/);
    assert.match(security, /twoStepCodeSent/);
    assert.match(security, /securityActionFailed/);
    assert.match(security, /verificationCodeSent/);
    assert.doesNotMatch(security, /onMessage\(/);
    assert.doesNotMatch(security, /onError\(/);
    assert.doesNotMatch(accountSection, /twoStepEnabledSuccess|twoStepCodeSent|securityActionFailed/);
    assert.match(security, /id="two-step-setting-code"/);
    assert.match(security, /id="two-step-current-password"/);
    assert.match(security, /maxLength=\{6\}/);
    assert.match(security, /setLocalError\(null\)/);
  });

  it("places deletion results in the deletion section, including after the forms unmount", () => {
    const requestButton = requestForm.indexOf('{t("deleteAccountSendCode")}');
    const requestFeedback = requestForm.indexOf("ContextualActionFeedback");
    const confirmButton = confirmForm.indexOf('{t("deleteAccountConfirm")}');
    const confirmFeedback = confirmForm.indexOf("ContextualActionFeedback");
    assert.ok(requestFeedback > requestButton);
    assert.ok(confirmFeedback > confirmButton);
    const scheduled = deletion.slice(deletion.indexOf("{deadline ?"));
    assert.match(scheduled, /deleteAccountScheduled/);
    assert.match(scheduled, /href="\/account\/deletion\/cancel"/);
    assert.doesNotMatch(scheduled, /deleteAccountSendCode/);
    assert.match(deletion, /deleteAccountCodeSent/);
    assert.match(deletion, /accountDeletionErrorMessage/);
    assert.doesNotMatch(deletion, /error\.message/);
    assert.match(deletion, /required/);
    assert.doesNotMatch(accountSection, /deleteAccountScheduled|deleteAccountSendCode/);
  });

  it("does not let one action clear another action's feedback", () => {
    assert.doesNotMatch(emailHandler, /setPasswordFeedback\(/);
    assert.doesNotMatch(emailHandler, /setSessionFeedback\(/);
    assert.doesNotMatch(passwordHandler, /setEmailFeedback\(/);
    assert.doesNotMatch(passwordHandler, /setSessionFeedback\(/);
    assert.doesNotMatch(sessionHandler, /setEmailFeedback\(/);
    assert.doesNotMatch(sessionHandler, /setPasswordFeedback\(/);
    assert.doesNotMatch(security, /setEmailFeedback|setPasswordFeedback|setSessionFeedback/);
    assert.doesNotMatch(deletion, /setEmailFeedback|setPasswordFeedback|setSessionFeedback/);
  });

  it("blocks a repeated submit of the same action and keeps incompatible credential changes exclusive", () => {
    assert.match(emailHandler, /if \(submitting\) \{\s*return;\s*\}/);
    assert.match(emailHandler, /if \(passwordPending\) \{\s*return;\s*\}/);
    assert.match(passwordHandler, /if \(passwordPending \|\| submitting\) \{\s*return;\s*\}/);
    assert.match(sessionHandler, /if \(sessionsPending\) \{\s*return;\s*\}/);
    assert.match(securityStart, /if \(submitting\) \{\s*return;\s*\}/);
    assert.match(securityConfirm, /if \(submitting\) \{\s*return;\s*\}/);
    assert.match(deletion, /if \(submitting\) \{\s*return;\s*\}/);
    assert.match(emailSection, /disabled=\{submitting \|\| passwordPending\}/);
    assert.match(passwordSection, /disabled=\{passwordPending \|\| submitting\}/);
    assert.match(sessionSection, /disabled=\{sessionsPending\}/);
    assert.doesNotMatch(sessionSection, /disabled=\{sessionsPending \|\| submitting\}/);
    assert.doesNotMatch(security, /passwordPending|sessionsPending/);
    assert.doesNotMatch(deletion, /passwordPending|sessionsPending|emailPending/);
  });

  it("keeps persistent account state and the confirmed-email notice in the account section", () => {
    assert.match(accountSection, /pendingEmailChange/);
    assert.match(accountSection, /emailConfirmedTitle/);
    assert.match(accountSection, /AdminMetricDetailsGrid/);
    assert.match(accountSection, /href="\/confirm-email"/);
    assert.match(accountSection, /publicProfileNotePrefix/);
    assert.doesNotMatch(accountSection, /setActionError|setMessage\(/);
    assert.match(panel, /loadError/);
    assert.match(security, /emailConfirmed/);
    assert.match(security, /twoStepLoginByEmail/);
    assert.match(deletion, /deleteAccountIntro/);
    assert.match(deletion, /deleteAccountConsequences/);
  });

  it("announces through one AuthFeedbackMessage and does not move focus", () => {
    assert.match(feedback, /role=\{role\}/);
    assert.match(feedback, /variant === "error" \? "alert" : "status"/);
    assert.match(feedback, /aria-live=\{variant === "error" \? "assertive" : "polite"\}/);
    assert.match(contextual, /<AuthFeedbackMessage/);
    assert.equal(contextual.match(/role=/g)?.length ?? 0, 0);
    assert.equal(contextual.match(/aria-live/g)?.length ?? 0, 0);
    assert.doesNotMatch(panel, /\.focus\(/);
    assert.doesNotMatch(security, /\.focus\(/);
    assert.doesNotMatch(deletion, /\.focus\(/);
    assert.doesNotMatch(contextual, /\.focus\(/);
    assert.match(login, /AuthFeedbackMessage/);
    assert.match(register, /AuthFeedbackMessage/);
    assert.match(codeFields, /AuthFeedbackMessage/);
    assert.match(feedback, /variant: AuthFeedbackVariant/);
    assert.match(feedback, /title\?: string/);
    assert.match(feedback, /children: ReactNode/);
  });

  it("reveals only a new result, and only the latest result when several appear together", async () => {
    const emailEffect = sliceBetween(panel, "useEffect(() => {\n    if (!emailFeedback)", "async function handleLogout");
    assert.match(emailEffect, /revealContextualFeedback\(emailFeedbackRef\.current\)/);
    assert.match(emailEffect, /\}, \[emailFeedback\]\)/);
    assert.match(contextual, /queueContextualFeedbackReveal\(ref\.current\)/);
    assert.match(contextual, /\}, \[noticeKey\]\)/);
    assert.equal(panel.match(/revealContextualFeedback\(/g)?.length, 1);

    const first = installWindow();
    const second = installWindow();
    queueContextualFeedbackReveal(fakeFeedback(first, { top: 900, left: 0, bottom: 980, right: 200 }));
    queueContextualFeedbackReveal(fakeFeedback(second, { top: 900, left: 0, bottom: 980, right: 200 }));
    await Promise.resolve();
    assert.equal(first.calls.length, 0);
    assert.equal(second.calls.length, 1);
    assert.equal(second.calls[0]?.block, "nearest");

    const reduced = installWindow({ reduce: true });
    revealContextualFeedback(fakeFeedback(reduced, { top: 900, left: 0, bottom: 980, right: 200 }));
    assert.equal(reduced.calls[0]?.behavior, "auto");

    const visible = installWindow();
    assert.equal(
      revealContextualFeedback(fakeFeedback(visible, { top: 20, left: 20, bottom: 80, right: 200 })),
      false,
    );
    assert.equal(visible.calls.length, 0);
  });

  it("uses logical placement for LTR, RTL, desktop, and mobile", () => {
    assert.match(css, /\.account-panel__action-feedback \{[^}]*margin-block-start:/s);
    assert.match(css, /\.account-panel__form \{\s*display: grid;/);
    assert.doesNotMatch(css, /account-panel__action-feedback[\s\S]*margin-left/);
    assert.doesNotMatch(css, /account-panel__action-feedback[\s\S]*margin-right/);
    assert.match(layout, /dir=\{documentLocale\.textDirection\}/);
    assert.doesNotMatch(contextual, /dir="/);
    assert.doesNotMatch(passwordSection, /dir="/);
    assert.doesNotMatch(sessionSection, /dir="/);
  });
});

function installWindow(options: { reduce?: boolean } = {}): { calls: ScrollIntoViewOptions[] } {
  const calls: ScrollIntoViewOptions[] = [];
  Object.assign(globalThis, {
    window: {
      innerWidth: 1280,
      innerHeight: 800,
      matchMedia: () => ({ matches: options.reduce === true }),
    },
    document: {
      documentElement: { clientWidth: 1280, clientHeight: 800 },
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
