/**
 * TASK-055 — Workspace Personalization verification.
 * Run: npm run verify:workspace-personalization
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import { disconnectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";
import { bootstrapAuthPersistence } from "../infrastructure/mongodb/bootstrap-auth-persistence.js";
import { loginAuthUser, registerAndConfirmAuthUser } from "../modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findRawAuthUserByEmail,
} from "../modules/auth/auth-user.repository.js";
import { deleteAuthSessionsByUserIds } from "../modules/auth/auth-session.repository.js";
import { deleteMemberProfileByUserId } from "../modules/member-profile/member-profile.repository.js";
import { getWorkspaceHomeForParticipant } from "../modules/workspace-home/workspace-home.service.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(scriptDir, "../../../..");

dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const TEST_EMAIL_PREFIX = `workspace-personalization-${Date.now()}`;

const FORBIDDEN_TERMS = [
  "reputation",
  "popularity",
  "follower",
  "gamification",
  "leaderboard",
  "score",
  "ranking",
] as const;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

async function cleanup(prefix: string): Promise<void> {
  const authUser = await findRawAuthUserByEmail(`${prefix}@example.com`);

  if (authUser) {
    await deleteAuthSessionsByUserIds([authUser.userId]);
    await deleteMemberProfileByUserId(authUser.userId);
    await deleteAuthUsersByEmailPrefix(prefix);
    return;
  }

  await deleteAuthUsersByEmailPrefix(prefix);
}

function verifyWorkspaceRouteAndSections(): void {
  console.log("1. Workspace home route and sections");

  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/app/workspace/page.tsx")),
    "/workspace page must exist",
  );
  assert(
    readRepoFile(
      "apps/web/src/features/workspace-home/components/WorkspaceHomeDashboard.tsx",
    ).includes("Personal Welcome"),
    "Dashboard must include Personal Welcome",
  );
  assert(
    readRepoFile(
      "apps/web/src/features/workspace-home/components/WorkspaceHomeDashboard.tsx",
    ).includes("Quick Actions"),
    "Dashboard must include Quick Actions",
  );
  assert(
    readRepoFile(
      "apps/web/src/features/workspace-home/components/WorkspaceHomeDashboard.tsx",
    ).includes("My Active Civic Work"),
    "Dashboard must include active work",
  );
  assert(
    readRepoFile(
      "apps/web/src/features/workspace-home/components/WorkspaceHomeDashboard.tsx",
    ).includes("My Recent Activity"),
    "Dashboard must include recent activity",
  );
  assert(
    readRepoFile(
      "apps/web/src/features/workspace-home/components/WorkspaceHomeDashboard.tsx",
    ).includes("My Responsibilities"),
    "Dashboard must include responsibilities",
  );
  assert(
    readRepoFile(
      "apps/web/src/features/workspace-home/components/WorkspaceHomeDashboard.tsx",
    ).includes("Participation Summary"),
    "Dashboard must include participation summary",
  );
  assert(
    readRepoFile(
      "apps/web/src/features/workspace-home/components/WorkspaceHomeDashboard.tsx",
    ).includes("Open Notification Center"),
    "Dashboard must include notification center card",
  );
}

function verifyApiAndAggregation(): void {
  console.log("2. Workspace home API aggregation");

  const routes = readRepoFile("apps/api/src/modules/workspace-home/workspace-home.routes.ts");
  const app = readRepoFile("apps/api/src/app.ts");

  assert(routes.includes('"/home"'), "Workspace home route must expose /home");
  assert(
    routes.includes("authenticationMiddleware") ||
      routes.includes("requireJwtAuthenticationMiddleware"),
    "Workspace home must require authentication",
  );
  assert(app.includes("/api/v1/workspace"), "App must mount workspace router");
  assert(
    readRepoFile("apps/web/src/features/workspace-home/workspace-home-api.ts").includes(
      "/api/v1/workspace/home",
    ),
    "Web client must call workspace home API",
  );
}

function verifyAssistantContextAndLayout(): void {
  console.log("3. Assistant context and sticky layout");

  const assistant = readRepoFile(
    "apps/web/src/features/workspace-home/components/WorkspaceHomeAssistant.tsx",
  );
  const header = readRepoFile(
    "apps/web/src/features/workspace-home/components/WorkspacePersonalHeader.tsx",
  );
  const nav = readRepoFile("apps/web/src/features/initiatives/components/WorkspaceNavigation.tsx");
  const prefs = readRepoFile("apps/web/src/features/workspace-home/workspace-preferences-store.ts");

  assert(
    assistant.includes("useWorkspaceIntelligence"),
    "Assistant must load workspace intelligence",
  );
  assert(
    assistant.includes("WorkspaceIntelligencePanel"),
    "Assistant must render intelligence panel",
  );
  assert(header.includes("Logout"), "Workspace header must include logout");
  assert(nav.includes("getCollapsedNavigationGroups"), "Navigation must persist collapsed groups");
  assert(prefs.includes("localStorage"), "Workspace preferences must use localStorage");
  assert(
    readRepoFile("apps/web/src/design-system/workspace-polish.css").includes("position: sticky"),
    "Sticky layout tokens must remain in workspace polish CSS",
  );
}

function verifyNoSocialGamification(): void {
  console.log("4. No reputation, popularity, or gamification");

  const dashboard = readRepoFile(
    "apps/web/src/features/workspace-home/components/WorkspaceHomeDashboard.tsx",
  ).toLowerCase();

  for (const term of FORBIDDEN_TERMS) {
    assert(!dashboard.includes(term), `Workspace dashboard must not include ${term}`);
  }
}

function verifyPublicExperienceIsolation(): void {
  console.log("5. No public leakage / Public Experience unchanged");

  const publicDir = path.join(REPO_ROOT, "apps/web/src/features/public-experience");
  const files = fs.readdirSync(publicDir, { recursive: true }) as string[];

  for (const file of files) {
    if (typeof file !== "string" || !file.endsWith(".tsx")) {
      continue;
    }

    const source = fs.readFileSync(path.join(publicDir, file), "utf-8");
    assert(!source.includes("workspace-home"), `${file} must not import workspace home`);
  }
}

async function verifyAuthenticatedWorkspaceHome(prefix: string): Promise<void> {
  console.log("6. Authenticated workspace home loads");

  const email = `${prefix}@example.com`;
  await registerAndConfirmAuthUser({
    email,
    password: "verify-password-123",
    displayName: "Workspace Personalization User",
  });

  const authUser = await findRawAuthUserByEmail(email);
  assert(authUser !== null, "Auth user must exist");

  await loginAuthUser({ email, password: "verify-password-123" });

  const home = await getWorkspaceHomeForParticipant({
    identity: {
      participantId: authUser!.memberId,
      role: "member",
    },
    userId: authUser!.userId,
    displayName: "Workspace Personalization User",
  });

  assert(home.welcome.displayName.length > 0, "Welcome must resolve member profile display name");
  assert(Array.isArray(home.quickActions), "Quick actions must be returned");
  // UX Evolution Pack 01 — Quick Actions Finalization: "Notification Center"
  // was removed from Workspace Quick Actions (it duplicated the notification
  // bell and Settings -> Notifications sidebar link). The exactly-9 list is
  // asserted here; /notifications itself is untouched and its own
  // route/page/API are covered separately by verify-notifications-e2e.ts.
  assert(
    home.quickActions.length === 9,
    "Workspace quick actions must contain exactly 9 entries",
  );
  assert(
    !home.quickActions.some((action) => action.id === "notification-center"),
    "Notification center quick action must no longer appear in Workspace Quick Actions",
  );
  assert(Array.isArray(home.recentActivity), "Recent activity must be returned");
  assert(home.recentActivity.length <= 20, "Recent activity must cap at 20 entries");
  assert(
    home.assistantContext.participantName.length > 0,
    "Assistant context must include participant name",
  );
  assert(
    home.notifications.registryEventCount > 0,
    "Notifications summary must reference registry readiness",
  );
  assert(
    !("passwordHash" in (home as unknown as Record<string, unknown>)),
    "Workspace home must stay private",
  );
}

async function runVerificationPass(pass: number): Promise<void> {
  console.log(`\n=== verify:workspace-personalization pass ${pass} ===`);

  verifyWorkspaceRouteAndSections();
  verifyApiAndAggregation();
  verifyAssistantContextAndLayout();
  verifyNoSocialGamification();
  verifyPublicExperienceIsolation();

  if (isMongoConfigured()) {
    await bootstrapAuthPersistence();
    const prefix = `${TEST_EMAIL_PREFIX}-p${pass}`;
    await cleanup(prefix);
    await verifyAuthenticatedWorkspaceHome(prefix);
    await cleanup(prefix);
  } else {
    console.log("Skipping authenticated runtime checks (MONGODB_URI not configured).");
  }

  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= 3; pass += 1) {
    await runVerificationPass(pass);
  }

  console.log("\nRunning Capability 02 regression verify:collective-decision (once)...");
  const regression = spawnSync("npm", ["run", "verify:collective-decision"], {
    stdio: "inherit",
    env: process.env,
  });
  assert(regression.status === 0, "verify:collective-decision regression failed.");

  console.log("\nverify:workspace-personalization PASSED (3 consecutive passes).");
}

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (isMongoConfigured()) {
      await disconnectMongoClient().catch(() => undefined);
    }
  });
