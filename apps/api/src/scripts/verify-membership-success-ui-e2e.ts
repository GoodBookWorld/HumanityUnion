/**
 * TASK-091B — Membership Success Experience & Public Badge Visibility verification.
 * Run: npm run verify:membership-success-ui
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const FEATURE_DIR = path.join(REPO_ROOT, "apps/web/src/features/membership");

const scriptDir = path.dirname(SCRIPT_PATH);
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const REQUIRED_FILES = [
  "components/MembershipSuccessPageContent.tsx",
  "components/MembershipSuccessHero.tsx",
  "components/MembershipSuccessConfirmationCard.tsx",
  "components/MembershipSuccessMeaningCard.tsx",
  "components/MembershipSuccessPermanentNote.tsx",
  "components/MembershipMemberBadgeOffer.tsx",
  "components/MemberBadgeIcon.tsx",
  "components/MembershipPublicVisibilityControl.tsx",
  "components/MembershipPublicDisplayPreview.tsx",
  "components/MembershipVotingExplanation.tsx",
  "components/membership-success-page.css",
  "components/member-badge-icon.css",
  "membership-success.config.ts",
  "membership-formatters.ts",
] as const;

const REQUIRED_COPY = [
  "Thank You!",
  "Your trust and support mean a lot.",
  "You are now a Member!",
  "1 CAD",
  "Membership is permanent.",
  "What Membership Means",
  "Wear Your Commitment",
  "20 CAD",
  "+ Shipping",
  "Request Member Badge",
  "Coming Soon",
  "Publicly display my Member status",
  "Membership status does not change vote weight",
] as const;

const FORBIDDEN_TERMS = ["stripe", "webhook", "createCheckoutSession"] as const;

function readSuccessUiComponentSources(): string {
  return fs
    .readdirSync(FEATURE_DIR, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && /\.(tsx|css)$/.test(entry))
    .map((entry) => fs.readFileSync(path.join(FEATURE_DIR, entry), "utf-8"))
    .join("\n");
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function readFeatureSources(): string {
  return fs
    .readdirSync(FEATURE_DIR, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && /\.(tsx|ts|css)$/.test(entry))
    .map((entry) => fs.readFileSync(path.join(FEATURE_DIR, entry), "utf-8"))
    .join("\n");
}

function verifyRoutesAndComponents(): void {
  console.log("1. Success route and components");

  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/app/membership/success/page.tsx")),
    "Success route must exist at /membership/success",
  );

  assert(
    fs.existsSync(
      path.join(REPO_ROOT, "apps/web/public/illustrations/membership/member-badge.webp"),
    ),
    "Member badge artwork must exist at /illustrations/membership/member-badge.webp",
  );

  for (const file of REQUIRED_FILES) {
    assert(fs.existsSync(path.join(FEATURE_DIR, file)), `Missing membership success file: ${file}`);
  }

  const badgeIcon = readRepoFile("apps/web/src/features/membership/components/MemberBadgeIcon.tsx");
  const constants = readRepoFile("apps/web/src/features/membership/membership.constants.ts");
  assert(
    badgeIcon.includes("MEMBER_BADGE_IMAGE_PATH"),
    "MemberBadgeIcon must use shared badge artwork constant",
  );
  assert(
    constants.includes("/illustrations/membership/member-badge.webp"),
    "Badge artwork constant must point to approved local asset",
  );
}

function verifyAccessGuardAndPreview(): void {
  console.log("2. Access guard and preview policy");

  const successPage = readRepoFile(
    "apps/web/src/features/membership/components/MembershipSuccessPageContent.tsx",
  );
  const previewConfig = readRepoFile(
    "apps/web/src/features/membership/membership-success.config.ts",
  );
  const envExample = readRepoFile("apps/web/.env.example");

  assert(
    successPage.includes("isActiveMembershipStatus"),
    "Success page must gate on active Member status",
  );
  assert(
    successPage.includes("isMembershipSuccessPreviewEnabled"),
    "Success page must support preview mode helper",
  );
  assert(previewConfig.includes('=== "true"'), "Preview mode must require explicit true flag");
  assert(
    envExample.includes("NEXT_PUBLIC_MEMBERSHIP_SUCCESS_PREVIEW=false"),
    "Web env example must document preview flag default false",
  );
  assert(
    !successPage.toLowerCase().includes("activatemembership"),
    "Success page must not activate Membership from frontend",
  );
}

function verifyVisibilityAndProjection(): void {
  console.log("3. Public visibility and projection");

  const types = readRepoFile("packages/types/src/domain/member-profile.ts");
  const projection = readRepoFile(
    "apps/api/src/modules/member-profile/member-profile.projection.ts",
  );
  const service = readRepoFile("apps/api/src/modules/member-profile/member-profile.service.ts");

  assert(
    types.includes("membershipPubliclyVisible"),
    "MemberProfile must include visibility field",
  );
  assert(
    projection.includes("resolvePublicMembershipFields"),
    "Projection must resolve public membership fields",
  );
  assert(
    projection.includes('membershipStatus: "member"'),
    "Public projection must expose member status when visible",
  );
  assert(
    projection.includes('membershipStatus: "participant"'),
    "Public projection must hide member status when not visible",
  );
  assert(
    service.includes("findMembershipByUserId"),
    "Public profile service must join membership domain",
  );
  assert(
    service.includes('membership.status !== "active_member"'),
    "Service must reject visibility for non-active Members",
  );
}

function verifyIntegrations(): void {
  console.log("4. Workspace and profile integration");

  const workspaceHeader = readRepoFile(
    "apps/web/src/features/workspace-home/components/WorkspacePersonalHeader.tsx",
  );
  const profileSection = readRepoFile(
    "apps/web/src/features/membership/components/MembershipProfileSection.tsx",
  );
  const memberWorkspace = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfileWorkspace.tsx",
  );

  assert(workspaceHeader.includes("MemberBadgeIcon"), "Workspace header must use MemberBadgeIcon");
  assert(
    workspaceHeader.includes("isActiveMembershipStatus"),
    "Workspace header must only show badge for active Members",
  );
  assert(
    profileSection.includes("MembershipPublicVisibilityControl"),
    "Profile section must include visibility control",
  );
  assert(
    memberWorkspace.includes("MembershipProfileSection"),
    "Member workspace must include Membership section",
  );
}

function verifyContentAndExclusions(): void {
  console.log("5. Content and exclusions");

  const sources = readFeatureSources();

  for (const text of REQUIRED_COPY) {
    const haystack = `${sources}\n${readRepoFile("apps/web/.env.example")}\n${readRepoFile("packages/types/src/domain/member-profile.ts")}\n${readRepoFile("packages/types/src/domain/membership-statistics.ts")}`;
    assert(haystack.includes(text), `Missing copy or config: ${text}`);
  }

  for (const term of FORBIDDEN_TERMS) {
    assert(
      !readSuccessUiComponentSources().toLowerCase().includes(term),
      `Membership success UI must not reference forbidden term: ${term}`,
    );
  }
}

function verifyDocumentation(): void {
  console.log("6. Documentation");

  const docPath = path.join(REPO_ROOT, "docs/MEMBERSHIP_SUCCESS_EXPERIENCE.md");
  assert(fs.existsSync(docPath), "docs/MEMBERSHIP_SUCCESS_EXPERIENCE.md must exist");

  const doc = fs.readFileSync(docPath, "utf-8");
  assert(
    doc.includes("success page structure"),
    "Documentation must describe success page structure",
  );
  assert(doc.includes("member-badge.webp"), "Documentation must reference badge asset path");
  assert(
    doc.includes("membershipPubliclyVisible"),
    "Documentation must describe visibility preference",
  );
  assert(
    doc.includes("STRIPE_MEMBERSHIP_CONTRIBUTION") || doc.includes("webhook"),
    "Documentation must note backend-only activation via webhook",
  );

  const uiFoundation = readRepoFile("docs/MEMBERSHIP_UI_FOUNDATION.md");
  assert(
    uiFoundation.includes("/membership/success"),
    "MEMBERSHIP_UI_FOUNDATION must document success redirect target",
  );
}

function verifyPackageScript(): void {
  console.log("7. Package script");

  const pkg = readRepoFile("package.json");
  assert(
    pkg.includes('"verify:membership-success-ui"'),
    "package.json must define verify:membership-success-ui",
  );
}

async function verifyActiveMemberAccessWithMongo(): Promise<void> {
  console.log("8. Active Member access (Mongo)");

  const { isMongoConfigured } = await import("../infrastructure/mongodb/mongo-config.js");
  if (!isMongoConfigured()) {
    console.log("   Skipped — MONGODB_URI not configured.");
    return;
  }

  const { bootstrapAuthPersistence } =
    await import("../infrastructure/mongodb/bootstrap-auth-persistence.js");
  const { registerAndConfirmAuthUser } = await import("../modules/auth/auth.service.js");
  const { deleteAuthUsersByEmailPrefix, findRawAuthUserByEmail } =
    await import("../modules/auth/auth-user.repository.js");
  const { deleteMembershipsByUserIdPrefix } =
    await import("../modules/membership/membership.repository.js");
  const { upsertMembershipApplication, activateMembershipMemberNumber } =
    await import("../modules/membership/index.js");
  const { updateMemberProfilePrivacyForUser } =
    await import("../modules/member-profile/member-profile.service.js");
  const { getPublicMemberProfileById } =
    await import("../modules/member-profile/member-profile.service.js");
  const { findMemberProfileByUserId } =
    await import("../modules/member-profile/member-profile.repository.js");
  const { toPublicMemberProfile } =
    await import("../modules/member-profile/member-profile.projection.js");
  const { findMembershipByUserId } = await import("../modules/membership/membership.repository.js");

  await bootstrapAuthPersistence();

  const prefix = `membership-success-ui-${Date.now()}`;
  const email = `${prefix}@example.com`;

  try {
    await registerAndConfirmAuthUser({
      email,
      displayName: "Success UI Verify",
      password: "verify-password-123",
    });

    const authUser = await findRawAuthUserByEmail(email);
    assert(authUser !== null, "Auth user must exist.");

    await upsertMembershipApplication({
      userId: authUser.userId,
      displayName: "Success UI Verify",
      application: {
        countryCode: "CA",
        displayNameConfirmed: "Success UI Verify",
        understandMembershipMeaning: true,
        understandNoVoteWeightChange: true,
        understandDataPolicy: true,
        submit: true,
      },
    });

    const memberNumber = await activateMembershipMemberNumber({ userId: authUser.userId });
    const activated = await findMembershipByUserId(authUser.userId);
    assert(activated !== null, "Membership record must exist after activation.");
    assert(activated.memberNumber !== null, "Active Member must have real member number.");
    assert(activated.memberGrantedAt !== null, "Active Member must have memberGrantedAt.");
    assert(
      memberNumber === activated.memberNumber,
      "Activation must return assigned member number.",
    );

    const profile = await findMemberProfileByUserId(authUser.userId);
    assert(profile !== null, "Profile must exist.");

    await updateMemberProfilePrivacyForUser(authUser.userId, {
      profileVisibility: "public",
    });

    const hiddenPublic = await getPublicMemberProfileById(profile.profileId, {
      viewerIsAuthenticated: false,
    });
    assert(
      hiddenPublic.membershipStatus === "participant",
      "Hidden membership must project participant publicly",
    );
    assert(hiddenPublic.memberBadgeVisible === false, "Badge must be hidden by default");
    assert(!("memberNumber" in hiddenPublic), "Member number must not leak when hidden");

    await updateMemberProfilePrivacyForUser(authUser.userId, {
      membershipPubliclyVisible: true,
    });

    const visiblePublic = await getPublicMemberProfileById(profile.profileId, {
      viewerIsAuthenticated: false,
    });
    assert(
      visiblePublic.membershipStatus === "member",
      "Visible membership must project member status",
    );
    assert(visiblePublic.memberBadgeVisible === true, "Badge visibility must be true");
    assert(
      visiblePublic.memberNumber === activated.memberNumber,
      "Public profile must expose membership domain member number",
    );

    await registerAndConfirmAuthUser({
      email: `${prefix}-participant@example.com`,
      displayName: "Participant Verify",
      password: "verify-password-123",
    });

    const participantAuth = await findRawAuthUserByEmail(`${prefix}-participant@example.com`);
    assert(participantAuth !== null, "Participant auth user must exist.");

    await assertRejects(
      () =>
        updateMemberProfilePrivacyForUser(participantAuth.userId, {
          membershipPubliclyVisible: true,
        }),
      /Only active Members/i,
    );

    const participantProfile = await findMemberProfileByUserId(participantAuth.userId);
    assert(participantProfile !== null, "Participant profile must exist.");

    await updateMemberProfilePrivacyForUser(participantAuth.userId, {
      profileVisibility: "public",
    });

    const participantMembership = await findMembershipByUserId(participantAuth.userId);
    const participantProfilePublic = await findMemberProfileByUserId(participantAuth.userId);
    const participantProjection = toPublicMemberProfile(participantProfilePublic!, {
      viewerIsAuthenticated: false,
      viewerIsOwner: false,
      membership: participantMembership,
    });
    assert(
      participantProjection?.membershipStatus === "participant",
      "Participant must not expose member status publicly",
    );
  } finally {
    await deleteMembershipsByUserIdPrefix(prefix);
    await deleteAuthUsersByEmailPrefix(prefix);
  }
}

async function assertRejects(fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected rejection matching ${pattern}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Expected rejection")) {
      throw error;
    }
    assert(pattern.test(message), `Expected ${pattern}, got "${message}"`);
  }
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:membership-success-ui pass ${pass} ===`);
  verifyRoutesAndComponents();
  verifyAccessGuardAndPreview();
  verifyVisibilityAndProjection();
  verifyIntegrations();
  verifyContentAndExclusions();
  verifyDocumentation();
  verifyPackageScript();
  await verifyActiveMemberAccessWithMongo();
}

for (let pass = 1; pass <= 3; pass += 1) {
  await runPass(pass);
}

console.log("\nverify:membership-success-ui PASSED (3 consecutive passes).");
