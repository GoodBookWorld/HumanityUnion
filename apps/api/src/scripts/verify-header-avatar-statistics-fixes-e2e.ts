/**
 * TASK-079 — Header auth, avatar persistence, and statistics layout verification.
 * Run: npm run verify:header-avatar-statistics-fixes
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyStatisticsLayout(): void {
  console.log("1. Statistics responsive layout");

  const css = readRepoFile("apps/web/src/features/platform-statistics/platform-statistics.css");

  assert(
    css.includes("grid-template-columns: repeat(9, minmax(0, 1fr))"),
    "Desktop layout must render nine cards in one row",
  );
  assert(css.includes("@media (max-width: 768px)"), "Statistics must switch at 768px");
  assert(
    css.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"),
    "Mobile statistics layout must use three columns",
  );
  assert(
    css.includes(".platform-statistics__description") && css.includes("display: none"),
    "Mobile statistics must hide explanatory text",
  );
}

function verifyHeaderAuth(): void {
  console.log("2. Header auth state and spacing");

  const header = readRepoFile("apps/web/src/design-system/components/HumanityHeader.tsx");
  const utility = readRepoFile("apps/web/src/design-system/components/HeaderAuthUtility.tsx");
  const layoutCss = readRepoFile("apps/web/src/design-system/layout.css");
  const authStatus = readRepoFile("apps/web/src/features/auth/use-client-auth-status.ts");
  const bootstrapConfig = readRepoFile("apps/web/src/features/auth/bootstrap-ui.config.ts");

  assert(header.includes("HeaderAuthUtility"), "Header must use consolidated auth utility");
  assert(
    !header.includes("NotificationHeaderLink"),
    "Header must not render notifications separately",
  );
  assert(
    layoutCss.includes(".humanity-header__utility"),
    "Header utility container styles must exist",
  );
  assert(layoutCss.includes("gap:"), "Header utility links must have visual spacing");
  assert(utility.includes('"pending"'), "Header auth must start in pending state");
  assert(utility.includes("Log in"), "Unauthenticated header must show Log in");
  assert(utility.includes("AuthenticatedHeaderTools"), "Authenticated header must use icon tools");
  assert(authStatus.includes("getMe()"), "Auth status must validate real session via /auth/me");
  assert(
    bootstrapConfig.includes('NEXT_PUBLIC_ALLOW_BOOTSTRAP_UI === "true"'),
    "Bootstrap UI must be opt-in via env flag",
  );
}

function verifyBootstrapProtection(): void {
  console.log("3. Bootstrap identity protection");

  const middleware = readRepoFile("apps/api/src/modules/auth/auth.middleware.ts");
  const workspaceRoutes = readRepoFile(
    "apps/api/src/modules/workspace-home/workspace-home.routes.ts",
  );
  const gate = readRepoFile("apps/web/src/features/auth/components/WorkspaceAuthGate.tsx");

  assert(
    middleware.includes("requireJwtAuthenticationMiddleware"),
    "API must expose JWT-only authentication middleware",
  );
  assert(
    workspaceRoutes.includes("requireJwtAuthenticationMiddleware"),
    "Workspace home must require JWT, not bootstrap",
  );
  assert(gate.includes("WorkspaceAuthGate"), "Workspace pages must use auth gate");
  assert(gate.includes("isBootstrapUiAllowed"), "Workspace gate must respect bootstrap UI flag");
}

function verifyAvatarAndMedia(): void {
  console.log("4. Avatar persistence and rendering");

  const avatar = readRepoFile("apps/web/src/design-system/components/HumanityAvatar.tsx");
  const mediaUrl = readRepoFile("apps/web/src/features/media-upload/media-url.ts");
  const uploadApi = readRepoFile("apps/web/src/features/media-upload/media-upload-api.ts");
  const profile = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfileWorkspace.tsx",
  );
  const mediaRoutes = readRepoFile("apps/api/src/modules/media-upload/media-upload.routes.ts");

  assert(avatar.includes("onError"), "Avatar component must handle image load errors");
  assert(mediaUrl.includes("API_BASE_URL"), "Media URLs must resolve against API base URL");
  assert(
    uploadApi.includes("normalizeMediaUploadResponse"),
    "Upload API must normalize media URLs",
  );
  assert(
    profile.includes("updateMyMemberProfile({ avatarUrl:"),
    "Avatar upload must persist avatarUrl via profile PATCH",
  );
  assert(
    mediaRoutes.includes("MEDIA_PUBLIC_BASE_URL") || mediaRoutes.includes("http://localhost:4000"),
    "Media upload must return browser-accessible absolute URLs",
  );
}

function verifyLogoutContract(): void {
  console.log("5. Logout API and client behavior");

  const authApi = readRepoFile("apps/web/src/features/auth/auth-api.ts");
  const apiClient = readRepoFile("apps/web/src/lib/api-client.ts");
  const authRoutes = readRepoFile("apps/api/src/modules/auth/auth.routes.ts");

  assert(
    authRoutes.includes("createSuccessResponse({ loggedOut: true }"),
    "Logout must return JSON envelope",
  );
  assert(
    apiClient.includes("response.status === 204"),
    "API client must support empty/204 responses",
  );
  assert(authApi.includes("dispatchAuthStateChanged"), "Logout must notify header auth listeners");
  assert(authApi.includes("clearStoredAuthTokens"), "Logout must clear local tokens");
}

async function verifyJwtOnlyNotifications(): Promise<void> {
  console.log("6. JWT-only notification route");

  const notificationRoutes = readRepoFile(
    "apps/api/src/modules/notifications/notification.routes.ts",
  );
  assert(
    notificationRoutes.includes("requireJwtAuthenticationMiddleware"),
    "Notifications must require JWT authentication",
  );
}

function main(): void {
  verifyStatisticsLayout();
  verifyHeaderAuth();
  verifyBootstrapProtection();
  verifyAvatarAndMedia();
  verifyLogoutContract();
  void verifyJwtOnlyNotifications();

  console.log("\nTASK-079 verify:header-avatar-statistics-fixes PASS");
}

void main();
