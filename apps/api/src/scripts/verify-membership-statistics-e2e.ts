/**
 * TASK-093 — Membership statistics verification.
 * Run: npm run verify:membership-statistics
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const REPO_ROOT = path.resolve(scriptDir, "../../../..");

import { runVerificationScript } from "./verification-script-lifecycle.js";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyModuleStructure(): void {
  console.log("1. Module structure");

  const requiredFiles = [
    "apps/api/src/modules/membership-statistics/membership-statistics.service.ts",
    "apps/api/src/modules/membership-statistics/membership-statistics.routes.ts",
    "apps/api/src/modules/membership-statistics/membership-statistics.cache.ts",
    "packages/types/src/domain/membership-statistics.ts",
    "apps/web/src/features/membership/components/MembershipParticipationStatisticsPanel.tsx",
    "apps/web/src/features/membership/components/MembershipPlatformStatisticsSection.tsx",
    "apps/web/src/features/membership-statistics/membership-statistics-api.ts",
    "docs/MEMBERSHIP_STATISTICS.md",
  ];

  for (const file of requiredFiles) {
    assert(fs.existsSync(path.join(REPO_ROOT, file)), `Missing file: ${file}`);
  }

  const app = readRepoFile("apps/api/src/app.ts");
  assert(app.includes("/api/v1/statistics"), "app.ts must mount statistics router");
}

function verifySharedTransparencyNote(): void {
  console.log("2. Shared transparency note");

  const types = readRepoFile("packages/types/src/domain/membership-statistics.ts");
  const panel = readRepoFile(
    "apps/web/src/features/membership/components/MembershipParticipationStatisticsPanel.tsx",
  );
  const constants = readRepoFile("apps/web/src/features/membership/membership.constants.ts");

  assert(
    types.includes("MEMBERSHIP_VOTE_WEIGHT_TRANSPARENCY_NOTE"),
    "Shared note must be defined once in types",
  );
  assert(
    constants.includes("MEMBERSHIP_VOTE_WEIGHT_TRANSPARENCY_NOTE"),
    "Web constants must import shared note",
  );
  assert(
    panel.includes("MembershipVotingExplanation"),
    "Panel must reuse voting explanation component",
  );
}

function verifyUiIntegrations(): void {
  console.log("3. UI integrations");

  const home = readRepoFile(
    "apps/web/src/features/platform-statistics/components/HumanityUnionInNumbers.tsx",
  );
  const workspace = readRepoFile(
    "apps/web/src/features/workspace-home/components/WorkspaceHomeDashboard.tsx",
  );
  const collective = readRepoFile(
    "apps/web/src/features/collective-decision/components/CollectiveDecisionWorkspace.tsx",
  );
  const nomination = readRepoFile(
    "apps/web/src/features/civic-nomination/components/NominationResultWidgetPlaceholder.tsx",
  );
  const membershipPage = readRepoFile(
    "apps/web/src/features/membership/components/MembershipPageContent.tsx",
  );

  assert(home.includes("Members"), "Home statistics must include Members card");
  assert(home.includes("fetchMembershipStatistics"), "Home must fetch membership statistics");
  assert(
    workspace.includes("MembershipPlatformStatisticsSection"),
    "Workspace must show platform stats",
  );
  assert(
    collective.includes("MembershipPlatformStatisticsSection"),
    "Collective decision must include panel",
  );
  assert(
    nomination.includes("MembershipPlatformStatisticsSection"),
    "Nomination widget must include panel",
  );
  assert(
    membershipPage.includes("MembershipPlatformStatisticsSection"),
    "Membership page must include platform stats",
  );
}

function verifyNoVoteWeightChanges(): void {
  console.log("4. No vote-weight changes");

  const forbiddenPaths = [
    "apps/api/src/modules/initiative-collective-decision",
    "apps/api/src/modules/initiative-decision-vote",
    "packages/types/src/domain/collective-decision-transparent-results.ts",
  ];

  for (const relativePath of forbiddenPaths) {
    const fullPath = path.join(REPO_ROOT, relativePath);

    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const files: string[] = [];

    if (fs.statSync(fullPath).isDirectory()) {
      for (const entry of fs.readdirSync(fullPath, { withFileTypes: true, recursive: true })) {
        if (entry.isFile() && entry.name.endsWith(".ts")) {
          const parent = typeof entry.parentPath === "string" ? entry.parentPath : fullPath;
          files.push(path.join(parent, entry.name));
        }
      }
    } else if (fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }

    for (const filePath of files) {
      const contents = fs.readFileSync(filePath, "utf8").toLowerCase();
      assert(
        !contents.includes("membership-statistics"),
        `Vote logic must not import membership statistics (${path.basename(filePath)})`,
      );
    }
  }
}

async function verifyAggregationAndApi(): Promise<void> {
  console.log("5. Aggregation and API");

  const { isMongoConfigured } = await import("../infrastructure/mongodb/mongo-config.js");
  assert(isMongoConfigured(), "MONGODB_URI must be configured.");

  const { bootstrapAuthPersistence } =
    await import("../infrastructure/mongodb/bootstrap-auth-persistence.js");
  const { registerAndConfirmAuthUser } = await import("../modules/auth/auth.service.js");
  const { deleteAuthUsersByEmailPrefix, findRawAuthUserByEmail } =
    await import("../modules/auth/auth-user.repository.js");
  const { deleteMembershipsByUserIdPrefix } =
    await import("../modules/membership/membership.repository.js");
  const { upsertMembershipApplication, activateMembershipMemberNumber } =
    await import("../modules/membership/index.js");
  const { clearMembershipStatisticsCache, getMembershipStatisticsPayload } =
    await import("../modules/membership-statistics/index.js");
  const { MEMBERSHIP_STATISTICS_CACHE_TTL_MS } =
    await import("../modules/membership-statistics/membership-statistics.types.js");

  const prefix = `membership-statistics-${Date.now()}`;

  await bootstrapAuthPersistence();
  await deleteMembershipsByUserIdPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);
  clearMembershipStatisticsCache();

  const participantEmail = `${prefix}-participant@example.com`;
  const memberEmail = `${prefix}-member@example.com`;

  await registerAndConfirmAuthUser({
    email: participantEmail,
    displayName: "Stats Participant",
    password: "verify-password-123",
  });

  await registerAndConfirmAuthUser({
    email: memberEmail,
    displayName: "Stats Member",
    password: "verify-password-123",
  });

  const memberUser = await findRawAuthUserByEmail(memberEmail);
  assert(memberUser !== null, "Member user must exist.");

  await upsertMembershipApplication({
    userId: memberUser.userId,
    displayName: "Stats Member",
    application: {
      countryCode: "CA",
      displayNameConfirmed: "Stats Member",
      understandMembershipMeaning: true,
      understandNoVoteWeightChange: true,
      understandDataPolicy: true,
      submit: true,
    },
  });
  await activateMembershipMemberNumber({ userId: memberUser.userId });

  const payload = await getMembershipStatisticsPayload();
  assert(payload.members >= 1, "Members count must include active_member records.");
  assert(payload.participants >= 1, "Participants count must include verified non-members.");
  assert(
    payload.totalParticipation === payload.members + payload.participants,
    "Total participation must equal members + participants.",
  );
  assert(Boolean(payload.updatedAt), "Payload must include updatedAt.");
  assert(
    typeof payload.applicationStarted === "number",
    "Payload must include applicationStarted count.",
  );
  assert(
    payload.applicationStarted >= payload.members,
    "applicationStarted must include active members (cumulative).",
  );

  const cached = await getMembershipStatisticsPayload();
  assert(cached.members === payload.members, "Cache must return stable member count.");
  assert(MEMBERSHIP_STATISTICS_CACHE_TTL_MS === 60_000, "Cache TTL must remain 60 seconds.");

  await deleteMembershipsByUserIdPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);
  clearMembershipStatisticsCache();
}

function verifyDocumentation(): void {
  console.log("6. Documentation");

  const doc = readRepoFile("docs/MEMBERSHIP_STATISTICS.md");
  assert(doc.includes("GET /api/v1/statistics/membership"), "Documentation must describe API");
  assert(doc.includes("totalParticipation"), "Documentation must describe aggregation model");
  assert(
    doc.includes("Membership status does not change vote weight") ||
      doc.includes("Membership never changes vote weight"),
    "Documentation must explain voting transparency",
  );
}

function verifyPackageScript(): void {
  console.log("7. Package script");

  const pkg = readRepoFile("package.json");
  assert(
    pkg.includes('"verify:membership-statistics"'),
    "package.json must define verify:membership-statistics",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:membership-statistics pass ${pass} ===`);
  verifyModuleStructure();
  verifySharedTransparencyNote();
  verifyUiIntegrations();
  verifyNoVoteWeightChanges();
  await verifyAggregationAndApi();
  verifyDocumentation();
  verifyPackageScript();
  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= 3; pass += 1) {
    await runPass(pass);
  }

  console.log("\nverify:membership-statistics PASSED (3 consecutive passes).");
}

void runVerificationScript(main);
