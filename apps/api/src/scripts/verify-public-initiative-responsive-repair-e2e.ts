/**
 * TASK-103B — Public Initiative responsive layout, geography, and analysis repair.
 * Run: npm run verify:public-initiative-responsive-repair
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

async function verifySharedGeographyFormatter(): Promise<void> {
  console.log("1. Shared public geography formatter");

  const webFormatter = readRepoFile("apps/web/src/data/geography/format-public-geography.ts");
  const apiFormatter = readRepoFile("apps/api/src/shared/format-public-geography.ts");
  const geographyLabel = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicGeographyLabel.tsx",
  );

  assert(
    webFormatter.includes("formatPublicGeographyLabel"),
    "Web formatter must expose label helper.",
  );
  assert(webFormatter.includes('return "World"'), "Web formatter must fall back to World.");
  assert(webFormatter.includes(" · "), "Web formatter must use canonical separator.");
  assert(
    apiFormatter.includes("formatPublicGeographyLabel"),
    "API formatter must expose label helper.",
  );
  assert(
    geographyLabel.includes("formatPublicGeography"),
    "PublicGeographyLabel must reuse formatter.",
  );

  const { formatPublicGeographyLabel } = await import("../shared/format-public-geography.js");

  assert(
    formatPublicGeographyLabel({
      city: "Nelson",
      region: "British Columbia",
      country: "Canada",
    }) === "Nelson · British Columbia · Canada",
    "City · Region · Country formatting must match spec.",
  );
  assert(
    formatPublicGeographyLabel({ region: "British Columbia", country: "Canada" }) ===
      "British Columbia · Canada",
    "Region · Country formatting must match spec.",
  );
  assert(
    formatPublicGeographyLabel({ country: "Canada" }) === "Canada",
    "Country-only label required.",
  );
  assert(formatPublicGeographyLabel({}) === "World", "Empty geography must resolve to World.");
}

function verifySupportNotSticky(): void {
  console.log("2. Support widget sticky removal");

  const css = readRepoFile(
    "apps/web/src/features/public-initiative-experience/public-initiative-experience.css",
  );
  const support = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeSupportStatistics.tsx",
  );

  assert(!css.includes("pie-support--sticky"), "Support must not use sticky modifier class.");
  assert(
    !css.match(/\.pie-support[\s\S]*position:\s*sticky/),
    "Support section must not be sticky.",
  );
  assert(
    !support.includes("pie-support--sticky"),
    "Support component must not apply sticky class.",
  );
  assert(
    css.includes(".pie-layout__lifecycle") && css.includes("position: sticky"),
    "Lifecycle sidebar may remain sticky on desktop.",
  );
}

function verifyResponsiveBreakpoints(): void {
  console.log("3. Responsive breakpoints (768px / 500px)");

  const css = readRepoFile(
    "apps/web/src/features/public-initiative-experience/public-initiative-experience.css",
  );

  assert(
    css.includes("max-width: var(--hu-workspace-max-width)"),
    "Page must use full workspace width.",
  );
  assert(
    css.includes("@media (max-width: 1023px) and (min-width: 768px)"),
    "Tablet range must stay 3-column.",
  );
  assert(css.includes("@media (max-width: 767px)"), "Right sidebar must hide below 768px.");
  assert(css.includes("@media (max-width: 499px)"), "True mobile layout must begin below 500px.");
  assert(
    css.includes("grid-column: 1 / -1"),
    "Sidebar must reflow below center content below 768px.",
  );
}

function verifySharedExperienceLayout(): void {
  console.log("4. Shared public experience layout");

  const required = [
    "apps/web/src/features/public-initiative-experience/components/PublicCivicRecordExperienceLayout.tsx",
    "apps/web/src/features/public-initiative-experience/components/PublicExperienceHero.tsx",
    "apps/web/src/features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
    "apps/web/src/features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeAnalysisExperiencePage.tsx",
  ];

  for (const file of required) {
    assert(fs.existsSync(path.join(REPO_ROOT, file)), `Missing shared component: ${file}`);
  }

  const initiativePage = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
  );
  const analysisPage = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeAnalysisExperiencePage.tsx",
  );
  const layout = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicCivicRecordExperienceLayout.tsx",
  );

  assert(
    initiativePage.includes("PublicCivicRecordExperienceLayout"),
    "Initiative page must use shared layout.",
  );
  assert(
    analysisPage.includes("PublicCivicRecordExperienceLayout"),
    "Analysis page must use shared layout.",
  );
  assert(layout.includes("pie-layout"), "Shared layout must expose three-part grid.");
  assert(
    analysisPage.includes("PublicExperienceSidebar"),
    "Analysis page must include right sidebar widgets.",
  );
  assert(
    analysisPage.includes('supportLabel="Initiative Support"'),
    "Analysis support must label parent initiative.",
  );
}

function verifyAnalysisPageCleanup(): void {
  console.log("5. Public analysis page cleanup");

  const analysisPage = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeAnalysisExperiencePage.tsx",
  );
  const routePage = readRepoFile(
    "apps/web/src/app/initiative-analyses/public/[analysisId]/page.tsx",
  );

  assert(analysisPage.includes('id="analysis"'), "Analysis main section must remain.");
  assert(
    analysisPage.includes("PublicDiscussionPanel"),
    "Discussion must appear below analysis content.",
  );
  assert(
    analysisPage.includes('activeStageId="analysis"'),
    "Lifecycle must highlight analysis stage.",
  );
  assert(
    routePage.includes("PublicInitiativeAnalysisExperiencePage"),
    "Route must render analysis experience.",
  );
  assert(
    !analysisPage.includes("View Public Initiative"),
    "Redundant initiative link must be removed.",
  );
  assert(!analysisPage.includes("Civic Integration"), "Civic Integration tab must be removed.");
  assert(!analysisPage.includes("Civic Context"), "Civic Context tab must be removed.");
  assert(
    !analysisPage.includes("Related Civic Records"),
    "Related Civic Records tab must be removed.",
  );
}

function verifyDiscussionAuthState(): void {
  console.log("6. Discussion auth-state synchronization");

  const discussion = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
  );
  const center = readRepoFile(
    "apps/web/src/features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
  );

  assert(
    discussion.includes("useClientAuthStatus"),
    "Discussion must use client auth status hook.",
  );
  assert(discussion.includes("getMe()"), "Discussion must verify account eligibility via getMe.");
  assert(
    discussion.includes("resolveSafeReturnTo"),
    "Discussion login must preserve safe return URL.",
  );
  assert(discussion.includes("#discussion"), "Discussion return URL must target discussion hash.");
  assert(
    !center.includes("requiresLogin"),
    "Center panel must not freeze guest-only discussion state.",
  );
  assert(
    discussion.includes("Sign in to join the discussion"),
    "Guest prompt must remain for unauthenticated users.",
  );
  assert(
    discussion.includes("pie-discussion__form"),
    "Authenticated users must see comment form markup.",
  );
}

function verifySearchGeographyReuse(): void {
  console.log("7. Search initiative header geography");

  const search = readRepoFile(
    "apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx",
  );

  assert(search.includes("formatPublicGeography"), "Search must reuse shared geography formatter.");
}

function verifyApiGeographyProjection(): void {
  console.log("8. API experience geography label");

  const service = readRepoFile(
    "apps/api/src/modules/initiatives/public-initiative-experience.service.ts",
  );

  assert(
    service.includes("formatPublicGeography") || service.includes("resolvePublicGeography"),
    "Experience service must resolve canonical geography labels.",
  );
}

function verifyPackageScript(): void {
  console.log("9. Verification script registration");

  const pkg = readRepoFile("package.json");
  assert(
    pkg.includes('"verify:public-initiative-responsive-repair"'),
    "package.json must define verify:public-initiative-responsive-repair",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:public-initiative-responsive-repair pass ${pass} ===`);
  await verifySharedGeographyFormatter();
  verifySupportNotSticky();
  verifyResponsiveBreakpoints();
  verifySharedExperienceLayout();
  verifyAnalysisPageCleanup();
  verifyDiscussionAuthState();
  verifySearchGeographyReuse();
  verifyApiGeographyProjection();
  verifyPackageScript();
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log("\nverify:public-initiative-responsive-repair PASSED (3 consecutive passes).");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
