/**
 * TASK-081 — Authentication, account and member profile stabilization verification.
 * Run: npm run verify:auth-member-stabilization
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { runVerificationScript } from "./verification-script-lifecycle.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

dotenv.config({ path: path.join(REPO_ROOT, "apps/api/.env") });
dotenv.config({ path: path.join(REPO_ROOT, ".env") });

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

async function withTestServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const { default: app } = await import("../app.js");
  const server = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Unable to bind test server.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function verifyRefreshTokenParsing(): void {
  console.log("1. Refresh token parsing and API wiring");

  const authRoutes = readRepoFile("apps/api/src/modules/auth/auth.routes.ts");
  const appSource = readRepoFile("apps/api/src/app.ts");
  const apiClient = readRepoFile("apps/web/src/lib/api-client.ts");
  const tokenRefresh = readRepoFile("apps/web/src/features/auth/auth-token-refresh.ts");
  const authConfig = readRepoFile("apps/api/src/config/auth.config.ts");

  assert(
    authRoutes.includes('typeof req.body === "object"') &&
      authRoutes.includes("AUTH_REFRESH_TOKEN_REQUIRED"),
    "readRefreshToken must guard undefined body and return canonical 401",
  );
  assert(
    appSource.indexOf("express.json()") < appSource.indexOf('"/api/v1/auth"'),
    "JSON body parser must register before auth routes",
  );
  assert(
    tokenRefresh.includes("refreshInFlight"),
    "Client refresh must deduplicate concurrent attempts",
  );
  assert(apiClient.includes("refreshAuthSessionOnce"), "API client must retry once after refresh");
  assert(apiClient.includes("isRetry"), "API client must avoid infinite retry loops");
  assert(authConfig.includes("15m"), "Access token lifetime must remain 15 minutes");
}

function verifyPasswordVisibilityAndAccountUi(): void {
  console.log("2. Password visibility and account UX");

  const passwordInput = readRepoFile("apps/web/src/design-system/components/PasswordInput.tsx");
  const accountPanel = readRepoFile("apps/web/src/features/auth/components/AccountPanel.tsx");
  const accountCss = readRepoFile("apps/web/src/features/auth/components/account-panel.css");
  const loginForm = readRepoFile("apps/web/src/features/auth/components/LoginForm.tsx");
  const registerForm = readRepoFile("apps/web/src/features/auth/components/RegisterForm.tsx");
  const resetConfirm = readRepoFile(
    "apps/web/src/features/auth/components/PasswordResetConfirmForm.tsx",
  );

  assert(passwordInput.includes('type="button"'), "Password toggle must be a button");
  assert(passwordInput.includes("aria-label"), "Password toggle must expose aria-label");
  assert(loginForm.includes("PasswordInput"), "Login form must use PasswordInput");
  assert(registerForm.includes("PasswordInput"), "Registration form must use PasswordInput");
  assert(resetConfirm.includes("PasswordInput"), "Password reset confirm must use PasswordInput");
  assert(accountPanel.includes("PasswordInput"), "Account password forms must use PasswordInput");
  assert(
    accountPanel.includes('role="status"') &&
      accountPanel.includes("Password changed successfully."),
    "Password change must show accessible success message",
  );
  assert(accountCss.includes("#f5e4c4"), "Account buttons must use #F5E4C4 default background");
  assert(accountCss.includes("#df9815"), "Account buttons must use #DF9815 hover background");
  assert(accountCss.includes("margin-top: 5px"), "Account form controls must use 5px spacing");
}

function verifyMemberProfileAndLayout(): void {
  console.log("3. Member profile save and workspace layout");

  const validators = readRepoFile(
    "apps/api/src/modules/member-profile/member-profile.validators.ts",
  );
  const memberWorkspace = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfileWorkspace.tsx",
  );
  const profileCss = readRepoFile("apps/web/src/app/profile/profile-page.css");
  const preferencesCss = readRepoFile("apps/web/src/app/preferences/preferences-page.css");
  const layoutCss = readRepoFile("apps/web/src/design-system/layout.css");

  assert(
    validators.includes("isPlatformMediaUrl(value)"),
    "Avatar validation must accept platform media URLs before absolute URL parsing",
  );
  assert(
    memberWorkspace.includes("Profile saved successfully.") &&
      memberWorkspace.includes('role="status"'),
    "Member profile save must show success message",
  );
  assert(
    !memberWorkspace.includes("country: profile.country"),
    "Profile save payload must not send unsupported geography fields",
  );
  assert(
    !profileCss.includes("max-width: 960px"),
    "Profile page must not override workspace width",
  );
  assert(
    !preferencesCss.includes("max-width: 960px"),
    "Preferences page must not override workspace width",
  );
  assert(
    layoutCss.includes(".humanity-workspace-page"),
    "Shared workspace page container must remain defined",
  );
}

function verifyAuthDiscovery(): void {
  console.log("4. Auth discovery and bootstrap safety");

  const authStatus = readRepoFile("apps/web/src/features/auth/use-client-auth-status.ts");
  const bootstrapConfig = readRepoFile("apps/web/src/features/auth/bootstrap-ui.config.ts");

  assert(
    authStatus.includes("getStoredRefreshToken"),
    "Auth status must consider refresh token before calling /auth/me",
  );
  assert(
    !authStatus.includes("auth-bootstrap"),
    "Client auth status must not reference bootstrap identity",
  );
  assert(
    bootstrapConfig.includes("NEXT_PUBLIC_ALLOW_BOOTSTRAP_UI"),
    "Bootstrap UI must remain opt-in only",
  );
}

async function verifyRefreshRuntime(): Promise<void> {
  console.log("5. Refresh endpoint runtime behavior");

  await withTestServer(async (baseUrl) => {
    const missingTokenResponse = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    assert(missingTokenResponse.status === 401, "Missing refresh token must return 401");

    const missingTokenBody = (await missingTokenResponse.json()) as {
      meta?: { code?: string };
      error?: { code?: string };
    };

    assert(
      missingTokenBody.meta?.code === "AUTH_REFRESH_TOKEN_REQUIRED" ||
        missingTokenBody.error?.code === "AUTH_REFRESH_TOKEN_REQUIRED",
      "Missing refresh token must return AUTH_REFRESH_TOKEN_REQUIRED",
    );

    const undefinedBodyResponse = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
    });

    assert(
      undefinedBodyResponse.status === 401,
      "Refresh without JSON body must not crash and must return 401",
    );
  });
}

async function verifyAuthenticatedRefreshFlow(): Promise<void> {
  console.log("6. Authenticated refresh and profile mutation");

  const { isMongoConfigured } = await import("../infrastructure/mongodb/mongo-config.js");

  if (!isMongoConfigured()) {
    console.log("   Skipping Mongo-backed refresh/profile runtime checks (MONGODB_URI unset).");
    return;
  }

  const { bootstrapAuthPersistence } =
    await import("../infrastructure/mongodb/bootstrap-auth-persistence.js");
  const { registerAndConfirmAuthUser, refreshAuthSession } =
    await import("../modules/auth/auth.service.js");
  const { verifyAccessToken } = await import("../modules/auth/auth-tokens.js");
  const { validateMemberProfilePatch } =
    await import("../modules/member-profile/member-profile.validators.js");

  await bootstrapAuthPersistence();

  const email = `auth-member-stabilization-${Date.now()}@example.com`;
  const registered = await registerAndConfirmAuthUser({
    email,
    displayName: "Stabilization Verify",
    password: "verify-password-123",
  });

  const decoded = verifyAccessToken(registered.tokens.accessToken);
  assert(decoded.type === "access", "Registered user must receive access token");

  const refreshed = await refreshAuthSession(registered.tokens.refreshToken);
  verifyAccessToken(refreshed.tokens.accessToken);
  assert(
    refreshed.tokens.refreshToken !== registered.tokens.refreshToken,
    "Refresh must rotate refresh token",
  );

  const avatarPatch = validateMemberProfilePatch({
    displayName: "Updated Name",
    avatarUrl: "/api/v1/media/files/avatars/example.jpg",
  });

  assert(
    avatarPatch.avatarUrl === "/api/v1/media/files/avatars/example.jpg",
    "Relative platform avatar URLs must validate",
  );
}

async function main(): Promise<void> {
  verifyRefreshTokenParsing();
  verifyPasswordVisibilityAndAccountUi();
  verifyMemberProfileAndLayout();
  verifyAuthDiscovery();
  await verifyRefreshRuntime();
  await verifyAuthenticatedRefreshFlow();
  console.log("\nTASK-081 verify:auth-member-stabilization PASS");
}

void runVerificationScript(main);
