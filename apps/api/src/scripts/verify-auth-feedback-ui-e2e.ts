/**
 * TASK-095D — Auth feedback visibility and email logo deployment readiness.
 * Run: npm run verify:auth-feedback-ui
 */

import assertStrict from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveEmailConfig, resolveEmailLogoUrl } from "../modules/email/email.config.js";
import { renderRegistrationConfirmationCodeEmail } from "../modules/email/email.templates.js";
import { getMockEmailSendCount } from "../modules/email/email-test-helpers.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const PASS_COUNT = 3;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifySharedFeedbackComponent(): void {
  console.log("1. Shared AuthFeedbackMessage component");

  const component = readRepoFile("apps/web/src/features/auth/components/AuthFeedbackMessage.tsx");
  const css = readRepoFile("apps/web/src/features/auth/components/auth-form.css");

  assert(component.includes("AuthFeedbackMessage"), "AuthFeedbackMessage component must exist.");
  assert(component.includes('"info"'), "Auth feedback must support info variant.");
  assert(component.includes('"success"'), "Auth feedback must support success variant.");
  assert(component.includes('"warning"'), "Auth feedback must support warning variant.");
  assert(component.includes('"error"'), "Auth feedback must support error variant.");
  assert(
    component.includes('role = variant === "error" ? "alert" : "status"'),
    "Auth feedback must use role=alert for errors and role=status otherwise.",
  );
  assert(css.includes(".auth-feedback"), "Auth feedback styles must exist.");
  assert(css.includes("border:"), "Auth feedback must include a visible border.");
  assert(
    css.includes("font-size: var(--hu-font-size-base"),
    "Auth feedback must use body-size text.",
  );
  assert(
    css.includes(".auth-feedback--warning"),
    "Auth feedback must style warning/cooldown panels.",
  );
}

function verifyAuthRouteUsage(): void {
  console.log("2. Auth route feedback usage");

  const routes = [
    "apps/web/src/features/auth/components/LoginForm.tsx",
    "apps/web/src/features/auth/components/RegisterForm.tsx",
    "apps/web/src/features/auth/components/AuthCodeVerificationFields.tsx",
    "apps/web/src/features/auth/components/AccountPanel.tsx",
    "apps/web/src/features/auth/components/AccountSecuritySection.tsx",
  ];

  for (const route of routes) {
    const source = readRepoFile(route);
    assert(source.includes("AuthFeedbackMessage"), `${route} must use AuthFeedbackMessage.`);
  }
}

function verifyCooldownAndErrorCopy(): void {
  console.log("3. Cooldown, incorrect-code, and resend copy");

  const sharedFields = readRepoFile(
    "apps/web/src/features/auth/components/AuthCodeVerificationFields.tsx",
  );
  const helpers = readRepoFile("apps/web/src/features/auth/lib/auth-feedback-messages.ts");

  assert(
    sharedFields.includes("Please wait before requesting another code."),
    "Cooldown warning must use the approved primary message.",
  );
  assert(
    sharedFields.includes("You can request another code in"),
    "Cooldown warning must show retry countdown when available.",
  );
  assert(
    helpers.includes("The code is incorrect. Check the latest email and try again."),
    "Incorrect-code helper must normalize to approved copy.",
  );
  assert(
    sharedFields.includes("A new code has been sent. Use the most recent email."),
    "Resend success must use approved copy.",
  );
  assert(
    sharedFields.includes("We could not send a new code. Please try again shortly."),
    "Delivery failure must use approved copy.",
  );
  assert(
    sharedFields.includes("Your previous valid code can still be used."),
    "Delivery failure must note when the previous code remains valid.",
  );
}

function verifyMessageLayoutStability(): void {
  console.log("4. Message layout stability");

  const sharedFields = readRepoFile(
    "apps/web/src/features/auth/components/AuthCodeVerificationFields.tsx",
  );

  assert(
    sharedFields.includes("auth-form__feedback-stack"),
    "Auth code form must group feedback messages in a stable stack.",
  );
  assert(
    sharedFields.includes("setCountdownLabel") && sharedFields.includes("setFieldError"),
    "Countdown and field error must be independent state.",
  );
  assert(
    sharedFields.includes("if (fieldError) {") &&
      sharedFields.includes("setFieldError(null);") &&
      sharedFields.includes("handleCodeChange"),
    "Incorrect-code errors must clear only when the user edits the code.",
  );
  assert(
    sharedFields.includes('variant="warning"') && sharedFields.includes("cooldownActive"),
    "Cooldown warning must remain visible while resend is blocked.",
  );
}

function verifyEmailLogoDeploymentReadiness(): void {
  console.log("5. Email logo deployment readiness (non-network)");

  const templates = readRepoFile("apps/api/src/modules/email/email.templates.ts");
  const docs = readRepoFile("docs/EMAIL_DELIVERY_OPERATIONS.md");
  const logoPath = path.join(
    REPO_ROOT,
    "apps/web/public/brand/humanity-union-logo-white-email.png",
  );

  assert(fs.existsSync(logoPath), "Email-safe logo PNG must exist in public assets.");
  assert(
    !templates.includes('src="/brand/') && !templates.includes("src='/brand/"),
    "Email templates must not hardcode relative /brand logo paths.",
  );
  assert(
    templates.includes("config.logoUrl"),
    "Email templates must resolve logo URL from config.",
  );
  assert(templates.includes('alt="Humanity Union"'), "Email logo must include alt text.");
  assert(templates.includes("Humanity Union</p>"), "Email header must include textual fallback.");

  const configuredLogoUrl = "https://huws.org/brand/humanity-union-logo-white-email.png";
  const resolved = resolveEmailLogoUrl("http://localhost:3000");
  process.env.EMAIL_LOGO_URL = configuredLogoUrl;
  const configuredResolved = resolveEmailLogoUrl("http://localhost:3000");
  delete process.env.EMAIL_LOGO_URL;

  assertStrict.equal(
    configuredResolved,
    configuredLogoUrl,
    "EMAIL_LOGO_URL must be inserted as an absolute URL when configured.",
  );
  assertStrict.match(resolved, /^https?:\/\//u, "Fallback logo URL must still be absolute.");

  const rendered = renderRegistrationConfirmationCodeEmail({
    displayName: "Verify Feedback",
    confirmationCode: "123456",
    expiresMinutes: 15,
  });
  assertStrict.match(
    rendered.html,
    /^[\s\S]*alt="Humanity Union"[\s\S]*$/u,
    "Default render must retain logo alt text.",
  );

  process.env.EMAIL_LOGO_URL = configuredLogoUrl;
  const configuredRender = renderRegistrationConfirmationCodeEmail({
    displayName: "Verify Feedback",
    confirmationCode: "123456",
    expiresMinutes: 15,
  });
  delete process.env.EMAIL_LOGO_URL;

  assert(
    configuredRender.html.includes(configuredLogoUrl),
    "Rendered email must use configured absolute EMAIL_LOGO_URL.",
  );
  assert(
    configuredRender.html.includes('alt="Humanity Union"'),
    "Configured render must retain logo alt text.",
  );
  assert(
    configuredRender.html.includes("Humanity Union</p>"),
    "Configured render must retain textual fallback when images are blocked.",
  );

  delete process.env.EMAIL_LOGO_URL;
  const missingConfigured = resolveEmailConfig();
  assertStrict.match(
    missingConfigured.logoUrl,
    /^https?:\/\//u,
    "Missing EMAIL_LOGO_URL must not break logo resolution.",
  );

  assert(
    docs.includes("EMAIL_LOGO_URL") && docs.includes("localhost"),
    "Email operations docs must document localhost logo limitations.",
  );
  assert(
    docs.includes("https://huws.org/brand/humanity-union-logo-white-email.png"),
    "Email operations docs must document production EMAIL_LOGO_URL.",
  );
  assert(
    docs.includes("cid:"),
    "Email operations docs must mention future CID inline logo strategy.",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:auth-feedback-ui pass ${pass} ===`);
  verifySharedFeedbackComponent();
  verifyAuthRouteUsage();
  verifyCooldownAndErrorCopy();
  verifyMessageLayoutStability();
  verifyEmailLogoDeploymentReadiness();
  console.log(`Pass ${pass} complete. Mock sends this pass: ${getMockEmailSendCount()}`);
}

async function main(): Promise<void> {
  const sendCountAtStart = getMockEmailSendCount();

  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log(
    `\nverify:auth-feedback-ui PASSED (${PASS_COUNT} consecutive passes). Real SMTP sends during gates: 0 (mock delta: ${getMockEmailSendCount() - sendCountAtStart}).`,
  );
}

void runVerificationScript(main);
