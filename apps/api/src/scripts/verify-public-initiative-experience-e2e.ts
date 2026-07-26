/**
 * TASK-103 — Public Initiative Experience verification.
 * Run: npm run verify:public-initiative-experience
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function verifyStructure(): void {
  console.log("1. Module structure");

  const required = [
    "packages/types/src/domain/public-initiative-experience.ts",
    "apps/api/src/modules/initiatives/public-initiative-experience.service.ts",
    "apps/api/src/modules/initiatives/public-initiative-experience.routes.ts",
    "apps/api/src/modules/initiative-support/initiative-support.service.ts",
    "apps/api/src/modules/initiative-support/initiative-support.routes.ts",
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    "apps/web/src/features/public-initiative-experience/components/PublicExperienceHero.tsx",
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeLifecycleNav.tsx",
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeSupportStatistics.tsx",
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeRevisionHistory.tsx",
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeLatestInitiatives.tsx",
    "apps/web/src/features/public-initiative-experience/public-initiative-experience.css",
    "docs/PUBLIC_INITIATIVE_EXPERIENCE.md",
    "docs/INITIATIVE_LIFECYCLE.md",
  ];

  for (const file of required) {
    assert(fs.existsSync(path.join(REPO_ROOT, file)), `Missing file: ${file}`);
  }

  const app = readRepoFile("apps/api/src/app.ts");
  assert(app.includes("publicInitiativeExperienceRouter"), "app.ts must mount experience router");
  assert(app.includes("initiativeSupportRouter"), "app.ts must mount support router");
}

function verifyHeroAndLayout(): void {
  console.log("2. Hero and responsive layout");

  const css = readRepoFile(
    "apps/web/src/features/public-initiative-experience/public-initiative-experience.css",
  );
  const hero = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicExperienceHero.tsx",
  );
  const page = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
  );
  const layout = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicCivicRecordExperienceLayout.tsx",
  );

  assert(css.includes("grid-template-columns: 2fr 3fr"), "Hero must use 40/60 desktop columns.");
  assert(css.includes("grid-template-columns: minmax"), "Layout must use three-column grid.");
  assert(hero.includes("InitiativeImage"), "Hero must use initiative image component.");
  assert(hero.includes("pie-hero__summary"), "Hero must expose concise summary.");
  assert(
    page.includes("PublicCivicRecordExperienceLayout") || layout.includes("pie-layout"),
    "Page must use experience layout grid.",
  );
  assert(!page.includes("CivicIntegrationPanel"), "Page must not include Civic Integration panel.");
}

function verifyLifecycleAndTabs(): void {
  console.log("3. Lifecycle navigation and center tabs");

  const types = readRepoFile("packages/types/src/domain/public-initiative-experience.ts");
  const nav = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeLifecycleNav.tsx",
  );
  const center = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
  );
  const routePage = readRepoFile("apps/web/src/app/initiatives/public/[initiativeId]/page.tsx");

  assert(
    types.includes("PUBLIC_INITIATIVE_EXPERIENCE_STAGES"),
    "Types must define ordered stages.",
  );
  assert(
    types.includes("collaborative-analysis"),
    "Stages must include collaborative analysis hash.",
  );
  assert(
    nav.includes('aria-current={isActive ? "step" : undefined}'),
    "Lifecycle uses aria-current.",
  );
  assert(nav.includes("stateLabel"), "Lifecycle must expose textual state labels.");
  assert(center.includes('role="tablist"'), "Center must use tab semantics.");
  assert(center.includes("Overview"), "Center must include Overview tab.");
  assert(center.includes("Related Civic Records"), "Center must include related records tab.");
  assert(center.includes("Discussion"), "Center must include Discussion tab.");
  assert(
    routePage.includes("PublicInitiativeExperiencePage"),
    "Route must render experience page.",
  );
}

function verifySupportAndSidebar(): void {
  console.log("4. Support, revision history, latest initiatives");

  const support = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeSupportStatistics.tsx",
  );
  const revisions = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeRevisionHistory.tsx",
  );
  const latest = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeLatestInitiatives.tsx",
  );
  const page = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
  );

  assert(support.includes("/icons/workspace/like.svg"), "Support must use like icon.");
  assert(support.includes("Participants"), "Support must show Participants count.");
  assert(support.includes("Visitors"), "Support must show Visitors separately.");
  assert(
    support.includes("INITIATIVE_SUPPORT_TRANSPARENCY_NOTE"),
    "Support must show transparency note.",
  );
  assert(revisions.includes("pie-revisions__list"), "Revision history must be scrollable list.");
  assert(latest.includes("InitiativeImage"), "Latest initiatives must use thumbnails.");
  assert(!page.includes("Discussion Preview"), "Page must not include discussion preview sidebar.");
}

function verifyApiContract(): void {
  console.log("5. Public experience API");

  const service = readRepoFile(
    "apps/api/src/modules/initiatives/public-initiative-experience.service.ts",
  );
  const routes = readRepoFile(
    "apps/api/src/modules/initiatives/public-initiative-experience.routes.ts",
  );

  assert(
    service.includes("buildPublicInitiativeExperienceProjection"),
    "Service must compose experience.",
  );
  assert(
    service.includes("PUBLIC_INITIATIVE_EXPERIENCE_STAGES"),
    "Service must reuse stage model.",
  );
  assert(routes.includes("/:initiativeId/experience"), "Route must expose experience endpoint.");
}

async function verifyRuntime(): Promise<void> {
  console.log("6. Runtime API smoke");

  const { resetInitiativeSupportStoreForTests, setInitiativeSupportSignal } =
    await import("../modules/initiative-support/initiative-support.service.js");
  const { getInitiativeById, listInitiatives } =
    await import("../modules/initiatives/initiative.store.js");
  const { buildPublicInitiativeExperienceProjection } =
    await import("../modules/initiatives/public-initiative-experience.service.js");

  await resetInitiativeSupportStoreForTests();

  const initiative =
    getInitiativeById("initiative-bootstrap-001") ??
    listInitiatives().find((item) => item.lifecyclePhase === "projected") ??
    getInitiativeById("initiative-bootstrap-001");

  assert(Boolean(initiative), "Sample public initiative must exist for runtime verification.");

  await setInitiativeSupportSignal({
    initiativeId: initiative!.initiativeId,
    userId: "verify-user-participant",
    signal: "like",
  });

  const experience = await buildPublicInitiativeExperienceProjection({
    initiative: initiative!,
    userId: null,
    viewerKey: "verify-viewer",
  });

  assert(
    experience.hero.summary.length <= experience.initiative.description.length,
    "Hero summary must not exceed full description.",
  );
  assert(experience.lifecycleStages.length >= 8, "Lifecycle must expose multiple stages.");
  assert(experience.supportStatistics.views.total >= 1, "View count must increment.");
  assert(experience.discussion.commentsAvailable === true, "Discussion backend must be available.");
}

function verifyPackageScript(): void {
  console.log("7. Verification script registration");

  const pkg = readRepoFile("package.json");
  assert(
    pkg.includes('"verify:public-initiative-experience"'),
    "package.json must define verify:public-initiative-experience",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:public-initiative-experience pass ${pass} ===`);
  verifyStructure();
  verifyHeroAndLayout();
  verifyLifecycleAndTabs();
  verifySupportAndSidebar();
  verifyApiContract();
  await verifyRuntime();
  verifyPackageScript();
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log("\nverify:public-initiative-experience PASSED (3 consecutive passes).");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
