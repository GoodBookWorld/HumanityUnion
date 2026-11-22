import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { isAccountDeletionUiEnabled } from "./account-deletion-availability";

const ROOT = new URL("../../", import.meta.url);
const LOCALES = ["en", "uk", "zh-Hant", "ar", "de", "es", "fr", "he", "ka", "pt"];
const KEYS = [
  "deleteAccountTitle",
  "deleteAccountIntro",
  "deleteAccountConsequences",
  "deleteAccountButton",
  "deleteAccountSendCode",
  "deleteAccountCodeLabel",
  "deleteAccountConfirm",
  "deleteAccountCodeSent",
  "deleteAccountScheduled",
  "deleteAccountUnavailable",
  "recoveryTitle",
  "recoveryIntro",
  "recoveryEmail",
  "recoverySendCode",
  "recoveryPassword",
  "recoveryCode",
  "recoverySubmit",
  "recoverySent",
  "recoverySuccess",
  "recoverySignIn",
  "recoveryFailed",
  "deleteAccountPasswordIncorrect",
  "deleteAccountCodeInvalid",
  "deleteAccountMailFailed",
  "deleteAccountAdminBlocked",
  "deleteAccountSuspendedBlocked",
  "deleteAccountRrpBlocked",
  "deleteAccountEditorBlocked",
  "deleteAccountConflict",
  "deleteAccountGenericError",
];

function read(path: string): string {
  return readFileSync(new URL(path, ROOT), "utf8");
}

describe("account deletion web", () => {
  it("stays hidden unless the public release flag is exactly true", () => {
    assert.equal(isAccountDeletionUiEnabled({ NODE_ENV: "test" }), false);
    assert.equal(
      isAccountDeletionUiEnabled({
        NODE_ENV: "test",
        NEXT_PUBLIC_ACCOUNT_DELETION_ENABLED: "false",
      }),
      false,
    );
    assert.equal(
      isAccountDeletionUiEnabled({
        NODE_ENV: "test",
        NEXT_PUBLIC_ACCOUNT_DELETION_ENABLED: "true",
      }),
      true,
    );
  });

  it("adds the deletion section after sessions and keeps the existing account tiles", () => {
    const panel = read("features/auth/components/AccountPanel.tsx");
    const sessions = panel.indexOf('title={t("sessions")}');
    const deletion = panel.indexOf("<AccountDeletionSection />");
    const logout = panel.indexOf('{t("logOut")}');
    assert.ok(sessions >= 0 && deletion > sessions && logout > deletion);
    assert.match(panel, /changePassword/);
    assert.match(panel, /requestEmailChange/);
    const tiles = read("features/auth/account-tiles-pack01.test.ts");
    assert.match(tiles, /matchAll\(\/label:\/g\)\]\.length, 5/);
  });

  it("keeps recovery logged out and routes the email link to the same page", () => {
    const page = read("app/account/deletion/cancel/page.tsx");
    const form = read("features/account-deletion/AccountDeletionRecoveryForm.tsx");
    const messages = read("features/account-deletion/account-deletion-messages.ts");
    const section = read("features/account-deletion/AccountDeletionSection.tsx");
    assert.match(page, /enabled \? <AccountDeletionRecoveryForm \/> : null/);
    assert.match(page, /deleteAccountUnavailable/);
    assert.match(form, /href="\/login"/);
    assert.doesNotMatch(form, /\/api\/v1\/auth\/login/);
    assert.doesNotMatch(form, /credentials:\s*"include"/);
    assert.doesNotMatch(form, /error\.message/);
    assert.doesNotMatch(section, /error\.message/);
    assert.match(section, /accountDeletionErrorMessage/);
    assert.match(messages, /invalid_password/);
    assert.doesNotMatch(`${page}\n${form}`, /dir="/);
  });

  it("localizes every installed catalog and keeps Arabic and Hebrew in RTL scripts", () => {
    const layout = read("app/layout.tsx");
    assert.match(layout, /dir=\{documentLocale\.textDirection\}/);
    for (const locale of LOCALES) {
      const catalog = JSON.parse(read(`features/i18n/messages/${locale}.json`)) as {
        auth: Record<string, string>;
      };
      for (const key of KEYS) {
        const value = catalog.auth[key] ?? "";
        assert.equal(typeof catalog.auth[key], "string", `${locale}.${key}`);
        assert.ok(value.length > 0);
      }
      assert.match(catalog.auth.deleteAccountScheduled ?? "", /\{deadline\}/);
      assert.match(catalog.auth.deleteAccountIntro ?? "", /Humanity Union/);
    }
    const ar = JSON.parse(read("features/i18n/messages/ar.json")) as { auth: Record<string, string> };
    const he = JSON.parse(read("features/i18n/messages/he.json")) as { auth: Record<string, string> };
    assert.match(ar.auth.deleteAccountTitle ?? "", /[\u0600-\u06FF]/);
    assert.match(he.auth.deleteAccountTitle ?? "", /[\u0590-\u05FF]/);
  });
});
