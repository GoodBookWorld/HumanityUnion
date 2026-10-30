import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveSafeReturnTo } from "../auth/lib/resolve-safe-return-to.js";
import {
  BINDING_RECOVERY_PREVIEW_PURPOSE,
  canSendExistingAccountCode,
  canSubmitIntegrityMediaConfirmation,
  canVerifyExistingAccount,
  EXISTING_ACCOUNT_AUTHORIZATION,
  EXISTING_ACCOUNT_TERMINAL_CODES,
  EXISTING_ACCOUNT_TITLE,
  isBindingRecoveryPreview,
  ORDINARY_CONFIRMATION_TITLE,
  RECOVERY_ACKNOWLEDGEMENT,
  RECOVERY_CONFIRMATION_TITLE,
  RECOVERY_WARNING,
} from "./integrity-media-link-confirm-model.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("Integrity Media confirmation page", () => {
  it("sends unauthenticated visitors through Humanity Union login and never supplies a member id", () => {
    const page = readFileSync(path.join(here, "IntegrityMediaLinkConfirm.tsx"), "utf8");
    const confirmationPath = "/connect/integrity-media?state=opaque-attempt-state";

    assert.equal(ORDINARY_CONFIRMATION_TITLE, "Connect your Humanity Union account to Integrity Media?");
    assert.match(page, /recovery \? RECOVERY_CONFIRMATION_TITLE : ORDINARY_CONFIRMATION_TITLE/);
    assert.match(page, /\/login\?returnTo=/);
    assert.match(page, /\/connect\/integrity-media\?state=/);
    assert.match(page, /JSON\.stringify\(\{ state: attemptState \}\)/);
    assert.match(page, /This confirmation will not be kept/);
    assert.match(page, /through registration/);
    assert.match(page, /href="\/register"/);
    assert.match(page, />\s*Confirm\s*</);
    assert.match(page, />\s*Cancel\s*</);
    assert.match(page, /provision-consent\?state=/);
    assert.match(page, /provision-confirm/);
    assert.match(page, /Confirm & Create Account/);
    assert.match(
      page,
      /Confirmation creates an account on the Humanity Union social education and civic participation platform\./,
    );
    assert.match(
      page,
      /This Integrity Media account cannot be linked automatically\. No Humanity Union account was created\./,
    );
    assert.match(page, /isNotFoundError/);
    assert.equal(page.includes("memberId"), false);
    assert.equal(page.includes("returnUrl"), false);
    assert.equal(resolveSafeReturnTo(confirmationPath, "/workspace"), confirmationPath);
    assert.equal(
      resolveSafeReturnTo("https://integrity.example/return", "/workspace"),
      "/workspace",
    );
    assert.equal(resolveSafeReturnTo("//integrity.example", "/workspace"), "/workspace");
  });
});

describe("Integrity Media existing account connection", () => {
  const page = readFileSync(path.join(here, "IntegrityMediaLinkConfirm.tsx"), "utf8");

  it("replaces the email collision dead end with the existing account flow", () => {
    assert.equal(EXISTING_ACCOUNT_TITLE, "Connect your existing Humanity Union account");
    assert.match(page, /error\.meta\?\.code === "existing_email_collision"[\s\S]{0,200}setPhase\("existing-account"\)/);
    assert.match(page, /Email address/);
    assert.match(page, /Send Verification Code/);
    assert.match(page, /Verification Code/);
    assert.match(page, /Verify & Connect/);
    assert.match(page, /existing-account\/send-code/);
    assert.match(page, /existing-account\/verify/);
    assert.match(page, /JSON\.stringify\(\{ state: attemptState, email: existingEmail \}\)/);
    assert.match(page, /authorize: authorized/);
    assert.equal(page.includes("memberId"), false);
  });

  it("enables sending only for an email and verifying only with a code and authorization", () => {
    assert.equal(canSendExistingAccountCode({ phase: "existing-account", email: "" }), false);
    assert.equal(canSendExistingAccountCode({ phase: "existing-account", email: "not-an-email" }), false);
    assert.equal(canSendExistingAccountCode({ phase: "existing-account", email: " author@example.com " }), true);
    assert.equal(canSendExistingAccountCode({ phase: "existing-sending", email: "author@example.com" }), false);

    assert.equal(canVerifyExistingAccount({ phase: "existing-code", code: "123456", authorized: false }), false);
    assert.equal(canVerifyExistingAccount({ phase: "existing-code", code: "12345", authorized: true }), false);
    assert.equal(canVerifyExistingAccount({ phase: "existing-code", code: "123456", authorized: true }), true);
    assert.equal(canVerifyExistingAccount({ phase: "existing-verifying", code: "123456", authorized: true }), false);
    assert.match(EXISTING_ACCOUNT_AUTHORIZATION, /I authorize/);
    assert.match(page, /type="checkbox"[\s\S]{0,200}checked=\{authorized\}/);
    assert.match(page, /disabled=\{!canVerifyExistingAccount\(\{ phase, code: verificationCode, authorized \}\)\}/);
  });

  it("stops on outcomes that cannot connect an existing account", () => {
    for (const code of ["author_deletion_pending", "author_already_linked", "attempt_already_bound"]) {
      assert.equal(EXISTING_ACCOUNT_TERMINAL_CODES.has(code), true);
    }
    assert.equal(EXISTING_ACCOUNT_TERMINAL_CODES.has("invalid_code"), false);
    assert.equal(EXISTING_ACCOUNT_TERMINAL_CODES.has("code_expired"), false);
  });
});

describe("Integrity Media Binding Recovery confirmation", () => {
  const page = readFileSync(path.join(here, "IntegrityMediaLinkConfirm.tsx"), "utf8");

  it("treats only the API-reported purpose as recovery", () => {
    assert.equal(BINDING_RECOVERY_PREVIEW_PURPOSE, "binding_recovery");
    assert.equal(
      isBindingRecoveryPreview({ displayName: "Ada", source: "integrity-media", purpose: "binding_recovery" }),
      true,
    );
    assert.equal(isBindingRecoveryPreview({ displayName: "Ada", source: "integrity-media" }), false);
    assert.equal(
      isBindingRecoveryPreview({ displayName: "Ada", source: "integrity-media", purpose: "BINDING_RECOVERY" }),
      false,
    );
    assert.doesNotMatch(page, /params\.get\("(purpose|recovery)"\)/);
  });

  it("requires an explicit acknowledgement before a recovery can be confirmed", () => {
    assert.equal(
      canSubmitIntegrityMediaConfirmation({ phase: "ready", recovery: true, acknowledged: false }),
      false,
    );
    assert.equal(
      canSubmitIntegrityMediaConfirmation({ phase: "ready", recovery: true, acknowledged: true }),
      true,
    );
    assert.equal(
      canSubmitIntegrityMediaConfirmation({ phase: "submitting", recovery: true, acknowledged: true }),
      false,
    );
    assert.equal(
      canSubmitIntegrityMediaConfirmation({ phase: "ready", recovery: false, acknowledged: false }),
      true,
    );
    assert.match(page, /type="checkbox"/);
    assert.match(page, /RECOVERY_ACKNOWLEDGEMENT/);
    assert.match(
      page,
      /disabled=\{!canSubmitIntegrityMediaConfirmation\(\{ phase, recovery, acknowledged \}\)\}/,
    );
    assert.match(page, /if \(!canSubmitIntegrityMediaConfirmation\(\{ phase, recovery, acknowledged \}\)\) \{/);
  });

  it("shows the recovery warning, the signed-in name and email, and a switch-account action", () => {
    assert.equal(RECOVERY_CONFIRMATION_TITLE, "Replace the Humanity Union account connected to Integrity Media?");
    assert.match(RECOVERY_WARNING, /will be replaced/);
    assert.match(RECOVERY_ACKNOWLEDGEMENT, /replaces the previous Humanity Union connection/);
    assert.match(page, /\{displayName\}/);
    assert.match(page, /\{sessionEmail\}/);
    assert.match(page, /Use a different account/);
    assert.match(page, /await logout\(\);\s*window\.location\.assign\(loginPath\(attemptState\)\)/);
  });

  it("does not disclose the previous member and keeps the ordinary wording", () => {
    for (const text of [RECOVERY_CONFIRMATION_TITLE, RECOVERY_WARNING, RECOVERY_ACKNOWLEDGEMENT]) {
      assert.doesNotMatch(text, /@|\{|member id/i);
    }
    assert.doesNotMatch(page, /previous(Member|Name|Email)|replacedMember|historical/i);
    assert.match(
      page,
      /Confirm only if this is the Humanity\s+Union account you want to connect\./,
    );
  });
});
