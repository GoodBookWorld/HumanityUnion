/**
 * Production Completion Pack 02E Task 04 — authentication UI chrome (`auth.*`).
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

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const AUTH_KEYS = [
  "logIn",
  "createAccount",
  "forgotPassword",
  "email",
  "password",
  "resetPassword",
  "verificationCode",
  "resendCode",
  "twoStepLoginByEmail",
  "incorrectCode",
] as const;

describe("Production Completion Pack 02E Task 04 — auth chrome extraction", () => {
  it("Login presentation resolves en/uk/zh-Hant/ar", async () => {
    const expected = {
      en: { logIn: "Log in", signingIn: "Signing in…", forgotPassword: "Forgot password?" },
      uk: { logIn: "Увійти", signingIn: "Вхід…", forgotPassword: "Забули пароль?" },
      "zh-Hant": { logIn: "登入", signingIn: "登入中…", forgotPassword: "忘記密碼？" },
      ar: {
        logIn: "تسجيل الدخول",
        signingIn: "جارٍ تسجيل الدخول…",
        forgotPassword: "نسيت كلمة المرور؟",
      },
    } as const;

    for (const locale of Object.keys(expected) as Array<keyof typeof expected>) {
      const pack = await loadUiMessagesForLocale(locale);
      const row = expected[locale];
      assert.equal(resolveMergedMessage(pack.messages, "auth", "logIn"), row.logIn);
      assert.equal(resolveMergedMessage(pack.messages, "auth", "signingIn"), row.signingIn);
      assert.equal(resolveMergedMessage(pack.messages, "auth", "forgotPassword"), row.forgotPassword);
    }

    const login = readWeb("features/auth/components/LoginForm.tsx");
    assert.match(login, /useTranslations\("auth"\)/);
    assert.match(login, /t\("logIn"\)/);
    assert.match(login, /t\("signingIn"\)/);
    assert.match(login, /href="\/register"/);
    assert.match(login, /href="\/password-reset"/);
    assert.match(login, /router\.push\("\/confirm-email"\)/);
    assert.match(login, /returnTo/);
    assert.doesNotMatch(login, /"Log in"|'Log in'/);
  });

  it("Registration presentation resolves verification locales", async () => {
    const expected = {
      en: "Create account",
      uk: "Створити обліковий запис",
      "zh-Hant": "建立帳戶",
      ar: "إنشاء حساب",
    } as const;

    for (const locale of Object.keys(expected) as Array<keyof typeof expected>) {
      const pack = await loadUiMessagesForLocale(locale);
      assert.equal(
        resolveMergedMessage(pack.messages, "auth", "createAccount"),
        expected[locale],
      );
      assert.ok(resolveMergedMessage(pack.messages, "auth", "registerSubtitle"));
      assert.ok(resolveMergedMessage(pack.messages, "auth", "displayName"));
    }

    const register = readWeb("features/auth/components/RegisterForm.tsx");
    assert.match(register, /useTranslations\("auth"\)/);
    assert.match(register, /t\("createAccount"\)/);
    assert.match(register, /registrationRequiresInvite/);
    assert.match(register, /inviteCode: requiresInvite \? inviteCode : undefined/);
    assert.doesNotMatch(register, /"Create account"|'Create account'/);

    const registerPage = readWeb("app/register/page.tsx");
    assert.match(registerPage, /getTranslations\("auth"\)/);
    assert.match(registerPage, /t\("registerTitle"\)/);
  });

  it("forgot/reset-password presentation resolves", async () => {
    const en = await loadUiMessagesForLocale("en");
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(resolveMergedMessage(en.messages, "auth", "sendResetLink"), "Send reset link");
    assert.equal(resolveMergedMessage(uk.messages, "auth", "sendResetLink"), "Надіслати посилання");
    assert.equal(resolveMergedMessage(en.messages, "auth", "resetPassword"), "Reset password");
    assert.equal(resolveMergedMessage(en.messages, "auth", "newPassword"), "New password");

    const request = readWeb("features/auth/components/PasswordResetRequestForm.tsx");
    assert.match(request, /useTranslations\("auth"\)/);
    assert.match(request, /t\("sendResetLink"\)/);
    assert.match(request, /href="\/login"/);

    const confirm = readWeb("features/auth/components/PasswordResetConfirmForm.tsx");
    assert.match(confirm, /useTranslations\("auth"\)/);
    assert.match(confirm, /t\("resetPassword"\)/);
    assert.match(confirm, /searchParams\.get\("token"\)/);
    assert.match(confirm, /href="\/password-reset"/);
  });

  it("email/code verification presentation resolves", async () => {
    const locales = ["en", "uk", "zh-Hant", "ar"] as const;
    for (const locale of locales) {
      const pack = await loadUiMessagesForLocale(locale);
      assert.ok(resolveMergedMessage(pack.messages, "auth", "confirmEmail"));
      assert.ok(resolveMergedMessage(pack.messages, "auth", "resendCode"));
      assert.ok(resolveMergedMessage(pack.messages, "auth", "verificationCode"));
    }

    const confirmEmail = readWeb("features/auth/components/ConfirmEmailForm.tsx");
    assert.match(confirmEmail, /useTranslations\("auth"\)/);
    assert.match(confirmEmail, /t\("confirmYourEmail"\)/);
    assert.match(confirmEmail, /router\.push\("\/register"\)/);
    assert.match(confirmEmail, /router\.push\("\/account\?confirmed=1"\)/);

    const fields = readWeb("features/auth/components/AuthCodeVerificationFields.tsx");
    assert.match(fields, /useTranslations\("auth"\)/);
    assert.match(fields, /id="auth-code-input"/);
    assert.match(fields, /maxLength=\{6\}/);
    assert.match(fields, /t\("resendCode"\)/);
    assert.match(fields, /AUTH_INCORRECT_CODE_MESSAGE/);
    assert.match(fields, /formatAuthFormError/);
  });

  it("2FA presentation resolves where scoped", async () => {
    const en = await loadUiMessagesForLocale("en");
    assert.equal(
      resolveMergedMessage(en.messages, "auth", "twoStepLoginByEmail"),
      "Two-Step Login by Email",
    );
    assert.equal(
      resolveMergedMessage(en.messages, "auth", "enableTwoStepLogin"),
      "Enable Two-Step Login",
    );

    const security = readWeb("features/auth/components/AccountSecuritySection.tsx");
    assert.match(security, /useTranslations\("auth"\)/);
    assert.match(security, /tCommon\("cancel"\)/);
    assert.match(security, /id="two-step-setting-code"/);
    assert.match(security, /id="two-step-current-password"/);
    assert.match(security, /t\("enableTwoStepLogin"\)/);
    assert.match(security, /maxLength=\{6\}/);

    const verify = readWeb("features/auth/components/LoginVerifyForm.tsx");
    assert.match(verify, /useTranslations\("auth"\)/);
    assert.match(verify, /t\("completeLogin"\)/);
    assert.match(verify, /returnTo/);
  });

  it("public header Log in resolves via auth.*", async () => {
    const en = await loadUiMessagesForLocale("en");
    const ar = await loadUiMessagesForLocale("ar");
    assert.equal(resolveMergedMessage(en.messages, "auth", "logIn"), "Log in");
    assert.equal(resolveMergedMessage(ar.messages, "auth", "logIn"), "تسجيل الدخول");

    const header = readWeb("design-system/components/HeaderAuthUtility.tsx");
    assert.match(header, /useTranslations\("auth"\)/);
    assert.match(header, /tAuth\("logIn"\)/);
    assert.match(header, /href="\/login"/);
    assert.doesNotMatch(header, />\s*Log in\s*</);

    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    assert.match(mobile, /tAuth\("logIn"\)/);
    assert.match(mobile, /tAuth\("createAccount"\)/);
    assert.match(mobile, /href="\/login"/);
    assert.match(mobile, /href="\/register"/);
  });

  it("PasswordInput continues using shared common.* translations", () => {
    const password = readWeb("design-system/components/PasswordInput.tsx");
    assert.match(password, /useTranslations\("common"\)/);
    assert.match(password, /tCommon\("showPassword"\)/);
    assert.match(password, /tCommon\("hidePassword"\)/);
    assert.doesNotMatch(password, /useTranslations\("auth"\)/);

    const login = readWeb("features/auth/components/LoginForm.tsx");
    assert.match(login, /PasswordInput/);
    assert.doesNotMatch(login, /showPassword|hidePassword/);
  });

  it("stable routes/field names/ids/payload identifiers remain unchanged", () => {
    const login = readWeb("features/auth/components/LoginForm.tsx");
    assert.match(login, /autoComplete="email"/);
    assert.match(login, /autoComplete="current-password"/);
    assert.match(login, /router\.push\(`\/login\/verify\?returnTo=/);

    const register = readWeb("features/auth/components/RegisterForm.tsx");
    assert.match(register, /autoComplete="email"/);
    assert.match(register, /autoComplete="name"/);
    assert.match(register, /autoComplete="new-password"/);
    assert.match(register, /minLength=\{8\}/);

    const fields = readWeb("features/auth/components/AuthCodeVerificationFields.tsx");
    assert.match(fields, /id="auth-code-input"/);
    assert.match(fields, /id="auth-code-error"/);
    assert.match(fields, /pattern="\\d\{6\}"/);
    assert.match(fields, /autoComplete="one-time-code"/);

    const security = readWeb("features/auth/components/AccountSecuritySection.tsx");
    assert.match(security, /emailVerificationStatus === "verified"/);
    assert.match(security, /loginEmailTwoStepEnabled/);
  });

  it("backend error identifiers are not replaced by translated strings", () => {
    const feedback = readWeb("features/auth/lib/auth-feedback-messages.ts");
    assert.match(feedback, /AUTH_INCORRECT_CODE_MESSAGE/);
    assert.match(
      feedback,
      /The code is incorrect\. Check the latest email and try again\./,
    );

    const login = readWeb("features/auth/components/LoginForm.tsx");
    assert.match(login, /formatAuthFormError\(submitError\)/);
    assert.match(login, /<p>\{error\}<\/p>/);

    const fields = readWeb("features/auth/components/AuthCodeVerificationFields.tsx");
    assert.match(fields, /formatAuthFormError\(submitError\)/);
    assert.match(fields, /displayFieldError\(fieldError\)/);
    assert.match(fields, /t\("incorrectCode"\)/);
  });

  it("bundled catalog parity remains green; fallback fixture remains valid", async () => {
    const parity = await verifyBundledVerificationCatalogParity();
    assert.equal(parity.ok, true, JSON.stringify(parity.reports, null, 2));

    const en = await loadUiMessagesForLocale("en");
    for (const key of AUTH_KEYS) {
      assert.ok(resolveMergedMessage(en.messages, "auth", key), key);
    }

    const missing = compareCatalogParityToEnglish(
      en.messages,
      {
        common: { cancel: "Скасувати" },
        auth: { logIn: "Увійти" },
      },
      "uk-auth-missing-fixture",
    );
    assert.equal(missing.ok, false);
    assert.ok(missing.issues.some((issue) => issue.path === "auth.createAccount"));
    assert.ok(missing.issues.some((issue) => issue.path === "auth.resendCode"));

    const partial: import("./remote-pack-seam.js").UiMessagePackSource = {
      async load(locale) {
        if (locale !== "uk") {
          return null;
        }
        return {
          locale: "uk",
          source: "bundled",
          messages: {
            common: { cancel: "Скасувати" },
            auth: { logIn: "Увійти" },
          },
        };
      },
    };
    const merged = await loadUiMessagesForLocale("uk", [partial]);
    assert.equal(resolveMergedMessage(merged.messages, "auth", "logIn"), "Увійти");
    assert.equal(
      resolveMergedMessage(merged.messages, "auth", "createAccount"),
      "Create account",
    );
  });

  it("does not pull workspace shell chrome into this slice", () => {
    const header = readWeb("design-system/components/HeaderAuthUtility.tsx");
    assert.doesNotMatch(header, /useTranslations\("workspace"\)/);

    const login = readWeb("features/auth/components/LoginForm.tsx");
    assert.doesNotMatch(login, /useTranslations\("workspace"\)/);
  });
});
