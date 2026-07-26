/**
 * TASK-064 — Closed beta readiness verification.
 * Run: npm run verify:closed-beta
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

dotenv.config({ path: path.resolve(REPO_ROOT, "apps/api/.env") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const DOCS_PATH = "docs/CLOSED_BETA_READINESS.md";

const DOC_REQUIRED_SECTIONS = [
  "## Beta philosophy",
  "## Invite process",
  "## Deployment checklist",
  "## First user guide",
  "## Known limitations",
  "## Rollback",
  "## Support process",
  "## Future public launch",
  "## Seed data policy",
  "## Test user roles",
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyDocumentationAndStaticAssets(): void {
  console.log("1. Closed beta documentation and static assets");

  assert(fs.existsSync(path.join(REPO_ROOT, DOCS_PATH)), `Missing ${DOCS_PATH}`);

  const docs = readRepoFile(DOCS_PATH);

  for (const section of DOC_REQUIRED_SECTIONS) {
    assert(docs.includes(section), `Docs must include section: ${section}`);
  }

  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/app/support/page.tsx")),
    "Support page must exist",
  );
  assert(
    readRepoFile("apps/web/src/features/closed-beta/components/BetaBanner.tsx").includes(
      "Closed Beta",
    ),
    "Beta banner component must exist",
  );
  assert(
    readRepoFile("apps/web/src/features/public-experience/footer-links.ts").includes(
      'href: "/support"',
    ),
    "Footer must link Feedback to /support",
  );
  assert(
    !readRepoFile("apps/web/src/design-system/components/HumanityHeader.tsx").includes(
      'href="/support"',
    ),
    "Header must not include Feedback link",
  );
  assert(
    readRepoFile("apps/api/src/config/platform.config.ts").includes("PLATFORM_MODE"),
    "Platform config must define PLATFORM_MODE",
  );
  assert(
    readRepoFile("package.json").includes('"verify:closed-beta"'),
    "Root package.json must define verify:closed-beta",
  );
}

function verifyEnvironmentExamples(): void {
  console.log("2. Environment examples");

  const apiEnv = readRepoFile("apps/api/.env.example");
  const rootEnv = readRepoFile(".env.example");

  for (const key of ["PLATFORM_MODE", "ALLOW_PUBLIC_REGISTRATION", "BETA_INVITE_EXPIRES_DAYS"]) {
    assert(apiEnv.includes(key), `apps/api/.env.example must document ${key}`);
  }

  assert(rootEnv.includes("PLATFORM_MODE=beta"), "Root env example must document beta mode");
  assert(
    rootEnv.includes("AUTH_BOOTSTRAP_FALLBACK=false"),
    "Root env must keep bootstrap disabled",
  );
}

async function verifyPlatformModeSwitching(): Promise<void> {
  console.log("3. Platform mode switching");

  const {
    isBootstrapAllowed,
    isPlatformModeBeta,
    isPlatformModeDevelopment,
    isPlatformModeProduction,
    isRegistrationInviteRequired,
    resolvePlatformMode,
  } = await import("../config/platform.config.js");

  process.env.PLATFORM_MODE = "development";
  assert(resolvePlatformMode() === "development", "development mode must resolve");
  assert(isPlatformModeDevelopment(), "development helper must match");

  process.env.PLATFORM_MODE = "beta";
  assert(resolvePlatformMode() === "beta", "beta mode must resolve");
  assert(isPlatformModeBeta(), "beta helper must match");
  assert(!isBootstrapAllowed(), "bootstrap must be disabled in beta");
  assert(isRegistrationInviteRequired(), "beta must require invite");

  process.env.PLATFORM_MODE = "production";
  process.env.ALLOW_PUBLIC_REGISTRATION = "false";
  assert(isPlatformModeProduction(), "production helper must match");
  assert(!isBootstrapAllowed(), "bootstrap must be disabled in production");
  assert(
    isRegistrationInviteRequired(),
    "production without public registration must require invite",
  );

  process.env.ALLOW_PUBLIC_REGISTRATION = "true";
  assert(!isRegistrationInviteRequired(), "production may allow public registration");
}

async function verifyInviteAndRegistrationGate(): Promise<void> {
  console.log("4. Invite system and registration gate");

  const { isMongoConfigured } = await import("../infrastructure/mongodb/mongo-config.js");
  assert(isMongoConfigured(), "MongoDB must be configured for closed beta integration checks");

  process.env.PLATFORM_MODE = "beta";
  process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

  const { bootstrapAuthPersistence } =
    await import("../infrastructure/mongodb/bootstrap-auth-persistence.js");
  await bootstrapAuthPersistence();

  const { seedMember } = await import("../modules/member/member.store.js");
  const { insertAuthUser, deleteAuthUsersByEmailPrefix } =
    await import("../modules/auth/auth-user.repository.js");
  const { deleteBetaInvitesByEmailPrefix } =
    await import("../modules/beta-invite/beta-invite.repository.js");
  const { createBetaInviteForAdmin } =
    await import("../modules/beta-invite/beta-invite.service.js");
  const { registerAuthUser, registerAndConfirmAuthUser } =
    await import("../modules/auth/auth.service.js");
  const { RegistrationUnavailableError } = await import("../modules/auth/auth.errors.js");
  const { previewBetaInviteValidation } =
    await import("../modules/beta-invite/beta-invite.service.js");

  const prefix = `closed-beta-${Date.now()}`;
  const adminEmail = `${prefix}-admin@example.com`;
  const inviteEmail = `${prefix}-invite@example.com`;

  await deleteBetaInvitesByEmailPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);

  const adminMemberId = `${prefix}-admin-member`;
  const now = new Date().toISOString();

  seedMember({
    id: adminMemberId,
    profile: {
      displayName: "Beta Admin",
      uniqueName: `${prefix}-admin`,
      languages: ["en"],
    },
    status: "active",
    verificationLevel: "email",
    roles: ["admin"],
    fair: { personal: 0, community: 0, regional: 0, global: 0 },
    createdAt: now,
    updatedAt: now,
  });

  const adminUser = await insertAuthUser(
    {
      email: adminEmail,
      password: "BetaAdminPass123!",
      displayName: "Beta Admin",
      role: "admin",
    },
    adminMemberId,
  );

  let registrationBlocked = false;

  try {
    await registerAuthUser({
      email: inviteEmail,
      password: "BetaUserPass123!",
      displayName: "Beta User",
    });
  } catch (error) {
    registrationBlocked = error instanceof RegistrationUnavailableError;
  }

  assert(registrationBlocked, "Registration must be blocked without invite in beta mode");

  const issued = await createBetaInviteForAdmin({
    email: inviteEmail,
    createdBy: adminUser.userId,
  });

  assert(Boolean(issued.code), "Invite issuance must return a code");
  assert(issued.invite.status === "pending", "Invite must start pending");

  const validPreview = await previewBetaInviteValidation({
    email: inviteEmail,
    inviteCode: issued.code,
  });

  assert(validPreview, "Invite preview validation must succeed before use");

  const session = await registerAndConfirmAuthUser({
    email: inviteEmail,
    password: "BetaUserPass123!",
    displayName: "Beta User",
    inviteCode: issued.code,
  });

  assert(session.user.email === inviteEmail, "Invite registration must create the invited user");

  let reuseBlocked = false;

  try {
    await registerAuthUser({
      email: `${prefix}-second@example.com`,
      password: "BetaUserPass123!",
      displayName: "Second User",
      inviteCode: issued.code,
    });
  } catch (error) {
    reuseBlocked = error instanceof RegistrationUnavailableError;
  }

  assert(reuseBlocked, "Invite codes must be single-use");

  await deleteBetaInvitesByEmailPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);
}

async function verifyOnboardingAndWorkspaceReadiness(): Promise<void> {
  console.log("5. Onboarding and workspace readiness");

  process.env.PLATFORM_MODE = "beta";

  const { seedMember } = await import("../modules/member/member.store.js");
  const { insertAuthUser, deleteAuthUsersByEmailPrefix } =
    await import("../modules/auth/auth-user.repository.js");
  const { deleteBetaInvitesByEmailPrefix } =
    await import("../modules/beta-invite/beta-invite.repository.js");
  const { createBetaInviteForAdmin } =
    await import("../modules/beta-invite/beta-invite.service.js");
  const { registerAndConfirmAuthUser } = await import("../modules/auth/auth.service.js");
  const {
    formatWorkspaceReadinessSummary,
    resolveBetaOnboardingForUser,
    resolveWorkspaceReadinessForUser,
  } = await import("../modules/closed-beta/closed-beta.service.js");
  const { requestIdentityFromAuth } =
    await import("../modules/initiatives/identity/bootstrap-request-identity.js");

  const prefix = `closed-beta-readiness-${Date.now()}`;
  const adminEmail = `${prefix}-admin@example.com`;
  const userEmail = `${prefix}-user@example.com`;

  await deleteBetaInvitesByEmailPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);

  const adminMemberId = `${prefix}-admin-member`;
  const now = new Date().toISOString();

  seedMember({
    id: adminMemberId,
    profile: {
      displayName: "Beta Admin",
      uniqueName: `${prefix}-admin`,
      languages: ["en"],
    },
    status: "active",
    verificationLevel: "email",
    roles: ["admin"],
    fair: { personal: 0, community: 0, regional: 0, global: 0 },
    createdAt: now,
    updatedAt: now,
  });

  const adminUser = await insertAuthUser(
    {
      email: adminEmail,
      password: "BetaAdminPass123!",
      displayName: "Beta Admin",
      role: "admin",
    },
    adminMemberId,
  );

  const issued = await createBetaInviteForAdmin({
    email: userEmail,
    createdBy: adminUser.userId,
  });

  const session = await registerAndConfirmAuthUser({
    email: userEmail,
    password: "BetaUserPass123!",
    displayName: "Beta User",
    inviteCode: issued.code,
  });

  const identity = await requestIdentityFromAuth({
    id: session.user.userId,
    email: session.user.email,
    provider: "email",
    status: "active",
    roles: [session.user.role],
    memberId: session.user.memberId,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
  });

  const onboarding = await resolveBetaOnboardingForUser({
    userId: session.user.userId,
    identity,
    displayName: session.user.displayName,
  });

  assert(onboarding.length === 4, "Onboarding checklist must include four items");
  assert(
    onboarding.some((item) => item.label === "Complete Member Profile"),
    "Onboarding must include member profile",
  );
  assert(
    onboarding.some((item) => item.label === "Create first Initiative"),
    "Onboarding must include first initiative",
  );

  const readiness = await resolveWorkspaceReadinessForUser({
    userId: session.user.userId,
    identity,
    displayName: session.user.displayName,
  });

  assert(readiness.status === "missing", "New workspace must report missing readiness");
  assert(readiness.missing.length > 0, "Readiness must use checklist items");

  const summary = formatWorkspaceReadinessSummary(readiness);
  assert(summary.startsWith("Missing:"), "Readiness summary must use checklist wording");
  assert(!summary.includes("%"), "Readiness must not expose percentage");

  await deleteBetaInvitesByEmailPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);
}

async function verifyPlatformEndpointsAndChecklist(): Promise<void> {
  console.log("6. Platform config, readiness checklist, and deployment safety");

  const { buildPlatformReadinessChecklist, resolvePlatformConfigPublic } =
    await import("../modules/closed-beta/closed-beta.service.js");

  process.env.PLATFORM_MODE = "beta";

  const config = resolvePlatformConfigPublic();
  assert(config.platformMode === "beta", "Platform config must expose beta mode");
  assert(config.registrationRequiresInvite, "Platform config must require invite in beta");
  assert(config.showBetaBanner, "Platform config must enable beta banner");

  const checklist = await buildPlatformReadinessChecklist();
  const labels = checklist.map((item) => item.label);

  for (const label of [
    "Mongo connected",
    "Health checks pass",
    "JWT configured",
    "Email configured",
    "Notifications working",
    "Workspace working",
    "Search working",
    "Assistant working",
    "Deployment verified",
  ]) {
    assert(labels.includes(label), `Platform checklist must include ${label}`);
  }

  assert(
    readRepoFile("apps/api/src/routes/health.routes.ts").includes("platformMode"),
    "Health endpoint must expose platform mode",
  );
}

function verifyNoPublicWorkflowRegression(): void {
  console.log("7. No public workflow regression signal");

  const appSource = readRepoFile("apps/api/src/app.ts");
  assert(
    appSource.includes("capability02IntegrationRouter"),
    "Capability 02 integration routes must remain",
  );
  assert(appSource.includes("/api/v1/public"), "Public experience routes must remain registered");
}

async function main(): Promise<void> {
  verifyDocumentationAndStaticAssets();
  verifyEnvironmentExamples();
  await verifyPlatformModeSwitching();
  await verifyInviteAndRegistrationGate();
  await verifyOnboardingAndWorkspaceReadiness();
  await verifyPlatformEndpointsAndChecklist();
  verifyNoPublicWorkflowRegression();
  console.log("verify:closed-beta passed.");
}

const { runVerificationScript } = await import("./verification-script-lifecycle.js");

void runVerificationScript(main);
