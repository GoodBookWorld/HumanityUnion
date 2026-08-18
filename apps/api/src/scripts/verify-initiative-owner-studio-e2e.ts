/**
 * TASK-105C — Owner Initiative Studio consolidation verification.
 * Run: npm run verify:initiative-owner-studio
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const PASS_COUNT = 3;

dotenv.config({ path: path.resolve(REPO_ROOT, "apps/api/.env") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyWorkspaceSimplification(): void {
  console.log("1. Workspace initiatives simplification");

  const workspace = readRepoFile(
    "apps/web/src/features/initiatives/components/InitiativeWorkspace.tsx",
  );
  const sections = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/initiative-workspace-sections.ts",
  );
  const card = readRepoFile("apps/web/src/features/initiatives/components/InitiativeCard.tsx");

  assert(!workspace.includes('title="Overview"'), "Workspace must remove Overview section.");
  assert(
    !workspace.includes('title="Lifecycle Timeline"'),
    "Workspace must remove Lifecycle Timeline section.",
  );
  assert(
    !workspace.includes('title="Manage Initiative"'),
    "Workspace must not duplicate Manage Initiative section.",
  );
  assert(
    !workspace.includes('title="Collaborative Analysis"'),
    "Workspace must not duplicate Collaborative Analysis section.",
  );
  assert(
    workspace.includes("StartNewInitiativeButton"),
    "Workspace must retain Start New Initiative flow.",
  );
  assert(
    workspace.includes("MyInitiativesDashboard"),
    "Workspace must retain My Initiatives lists.",
  );
  assert(
    sections.includes('"My Initiatives"') && sections.includes('"Start New Initiative"'),
    "Workspace section registry must match simplified hub.",
  );
  assert(
    card.includes("buildInitiativeExperienceHref"),
    "Initiative cards must link to canonical initiative experience route.",
  );
  assert(
    card.includes("Manage Initiative") && card.includes("Open Initiative"),
    "Initiative cards must expose clear action labels.",
  );
}

function verifyOwnerModeRelocation(): void {
  console.log("2. Canonical experience Manage via stewardship");

  const centerPanel = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
  );
  const experiencePage = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
  );
  const loader = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/CanonicalInitiativeExperienceLoader.tsx",
  );
  const experienceRoutes = readRepoFile(
    "apps/web/src/features/initiative-owner-studio/initiative-experience-routes.ts",
  );
  const managePanel = readRepoFile(
    "apps/web/src/features/initiative-owner-studio/components/InitiativeOwnerManagePanel.tsx",
  );
  const routes = readRepoFile("apps/api/src/modules/initiatives/initiative.routes.ts");
  const ownerService = readRepoFile(
    "apps/api/src/modules/initiatives/initiative-owner-access.service.ts",
  );

  assert(centerPanel.includes('"Manage"'), "Center navigation must include Manage tab label.");
  assert(
    centerPanel.includes("showManageTab"),
    "Manage tab must be authorization-gated in center panel.",
  );
  assert(
    experiencePage.includes("viewerIsSteward") && experiencePage.includes("canShowManage"),
    "Manage visibility must follow viewerIsSteward, not ownerMode.",
  );
  assert(
    !experiencePage.includes("ownerMode"),
    "Public experience page must not use ownerMode as Manage authority.",
  );
  assert(
    experienceRoutes.includes("/initiatives/public/"),
    "Experience href builders must target the canonical public route.",
  );
  assert(
    loader.includes("getPublicInitiativeExperience") &&
      loader.includes("getInitiativeOwnerAccess"),
    "Canonical loader must fetch experience + owner-access with credentials.",
  );
  assert(
    managePanel.includes('id="manage-initiative"'),
    "Manage Initiative section must live in owner studio panel.",
  );
  assert(routes.includes("/owner-access"), "Initiative API must expose owner-access endpoint.");
  assert(
    ownerService.includes("canManage: false"),
    "Owner access service must deny non-owners without leaking data.",
  );
  assert(
    fs.existsSync(
      path.join(REPO_ROOT, "apps/web/src/app/initiatives/public/[initiativeId]/page.tsx"),
    ),
    "Canonical initiative experience route must exist at /initiatives/public/{id}.",
  );
  assert(
    !fs.existsSync(
      path.join(
        REPO_ROOT,
        "apps/web/src/features/initiative-owner-studio/components/InitiativeExperiencePage.tsx",
      ),
    ),
    "Legacy InitiativeExperiencePage dual mount must be removed.",
  );
}

async function verifyOwnerAccessRuntime(): Promise<void> {
  console.log("3. Owner access authorization runtime");

  process.env.INITIATIVE_PERSISTENCE = "memory";

  const { createInitiativeDraft } = await import("../modules/initiatives/initiative.service.js");
  const { getInitiativeOwnerAccess } =
    await import("../modules/initiatives/initiative-owner-access.service.js");

  const ownerIdentity = { participantId: "owner-participant", displayName: "Owner" };
  const otherIdentity = { participantId: "other-participant", displayName: "Other" };

  const draft = createInitiativeDraft(ownerIdentity, {
    title: `Owner Studio Draft ${Date.now()}`,
    description: "Draft description",
    activityArea: "Community Development",
  });

  const ownerAccess = getInitiativeOwnerAccess({
    initiativeId: draft.initiativeId,
    identity: ownerIdentity,
  });

  assert(ownerAccess.canManage, "Initiative owner must receive manage access.");
  assert(
    ownerAccess.initiative?.initiativeId === draft.initiativeId,
    "Owner must receive initiative record.",
  );

  const denied = getInitiativeOwnerAccess({
    initiativeId: draft.initiativeId,
    identity: otherIdentity,
  });

  assert(!denied.canManage, "Unrelated participant must be denied manage access.");
  assert(denied.initiative === null, "Denied owner access must not return initiative payload.");
}

function verifyCacheSafety(): void {
  console.log("4. Cache safety and draft separation");

  const publicCanonicalPage = readRepoFile(
    "apps/web/src/app/initiatives/public/[initiativeId]/page.tsx",
  );
  const legacyRedirectPage = readRepoFile(
    "apps/web/src/app/initiatives/[initiativeId]/page.tsx",
  );
  const loader = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/CanonicalInitiativeExperienceLoader.tsx",
  );
  const draftShell = readRepoFile(
    "apps/web/src/features/initiative-owner-studio/components/InitiativeOwnerDraftShell.tsx",
  );

  assert(
    publicCanonicalPage.includes('dynamic = "force-dynamic"'),
    "Canonical public initiative route must disable shared static cache.",
  );
  assert(
    publicCanonicalPage.includes("CanonicalInitiativeExperienceLoader"),
    "Canonical public route must mount CanonicalInitiativeExperienceLoader.",
  );
  assert(
    legacyRedirectPage.includes("window.location.replace") &&
      legacyRedirectPage.includes("/initiatives/public/"),
    "Legacy /initiatives/{id} must redirect into canonical public experience.",
  );
  assert(
    loader.includes("getInitiativeOwnerAccess"),
    "Owner tools must load through authenticated client access probe.",
  );
  assert(
    draftShell.includes("Draft initiative — owner access only"),
    "Draft shell must not present public availability.",
  );
}

function verifyPackageScripts(): void {
  console.log("5. Verification script registration");

  const pkg = readRepoFile("package.json");
  assert(
    pkg.includes('"verify:initiative-owner-studio"'),
    "package.json must define verify:initiative-owner-studio.",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:initiative-owner-studio pass ${pass} ===`);
  verifyWorkspaceSimplification();
  verifyOwnerModeRelocation();
  await verifyOwnerAccessRuntime();
  verifyCacheSafety();
  verifyPackageScripts();
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log("\nverify:initiative-owner-studio PASSED (3 consecutive passes).");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
