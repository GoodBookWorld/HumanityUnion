/**
 * TASK-091 — Membership UI Foundation verification.
 * Run: npm run verify:membership-ui
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const FEATURE_DIR = path.join(REPO_ROOT, "apps/web/src/features/membership");

const REQUIRED_COMPONENTS = [
  "components/MembershipPageContent.tsx",
  "components/MembershipHero.tsx",
  "components/MembershipMeaningCards.tsx",
  "components/MembershipNotMeans.tsx",
  "components/MembershipStatusCard.tsx",
  "components/MembershipJourneySection.tsx",
  "components/MembershipTimeline.tsx",
  "components/MembershipApplicationForm.tsx",
  "components/MembershipContributionCard.tsx",
  "components/MembershipBenefitsGrid.tsx",
  "components/MembershipFaqAccordion.tsx",
  "components/MembershipProfileSection.tsx",
  "components/MembershipWorkspaceWidget.tsx",
  "components/MembershipCohortBadge.tsx",
  "components/membership-page.css",
  "components/membership-timeline.css",
  "membership.constants.ts",
  "membership-labels.ts",
  "membership-api.ts",
] as const;

const REQUIRED_UI_STRINGS = [
  "Become a Humanity Union Member",
  "What Membership Does NOT Mean",
  "Membership Journey",
  "Membership Application",
  "Save Draft",
  "Submit Application",
  "Draft saved successfully.",
  "Application submitted successfully.",
  "Membership Contribution",
  "Become a Member",
  "Membership already active.",
  "Frequently Asked Questions",
  "Open Membership",
  "Continue Membership",
] as const;

const FORBIDDEN_UI_TERMS = ["stripe", "webhook"] as const;

function readFeatureSourcesExceptApi(): string {
  return fs
    .readdirSync(FEATURE_DIR, { recursive: true })
    .filter(
      (entry): entry is string =>
        typeof entry === "string" &&
        /\.(tsx|ts|css)$/.test(entry) &&
        !entry.endsWith("membership-api.ts"),
    )
    .map((entry) => fs.readFileSync(path.join(FEATURE_DIR, entry), "utf-8"))
    .join("\n");
}

function readUiComponentSources(): string {
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

function verifyRouteAndComponents(): void {
  console.log("1. Route and component boundaries");

  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/app/membership/page.tsx")),
    "Membership route must exist at /membership",
  );

  for (const file of REQUIRED_COMPONENTS) {
    assert(fs.existsSync(path.join(FEATURE_DIR, file)), `Missing membership UI file: ${file}`);
  }

  const page = readRepoFile("apps/web/src/app/membership/page.tsx");
  assert(
    page.includes("MembershipPageContent"),
    "Membership page must render MembershipPageContent",
  );
}

function verifyHeaderAndNavigation(): void {
  console.log("2. Header and workspace navigation");

  const nav = readRepoFile("apps/web/src/features/public-experience/constants.ts");
  const header = readRepoFile("apps/web/src/design-system/components/HumanityHeader.tsx");
  const workspaceNav = readRepoFile(
    "apps/web/src/features/initiatives/components/WorkspaceNavigation.tsx",
  );

  assert(nav.includes('href: "/membership"'), "Primary navigation must include Membership");
  assert(header.includes("/membership"), "Header destination resolver must include /membership");
  assert(workspaceNav.includes("/membership"), "Workspace navigation must include Membership");
}

function verifyProfileAndWorkspaceIntegration(): void {
  console.log("3. Profile and workspace integration");

  const profile = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfilePreview.tsx",
  );
  const profileSection = readRepoFile(
    "apps/web/src/features/membership/components/MembershipProfileSection.tsx",
  );
  const workspace = readRepoFile(
    "apps/web/src/features/workspace-home/components/WorkspaceHomeDashboard.tsx",
  );
  const workspaceWidget = readRepoFile(
    "apps/web/src/features/membership/components/MembershipWorkspaceWidget.tsx",
  );

  assert(
    profile.includes("MembershipProfileSection"),
    "Member profile preview must include MembershipProfileSection",
  );
  assert(
    profileSection.includes("Open Membership"),
    "Profile section must include Open Membership button",
  );
  assert(
    workspace.includes("MembershipWorkspaceWidget"),
    "Workspace home must include Membership widget",
  );
  assert(
    workspaceWidget.includes("Continue Membership"),
    "Workspace widget must include Continue Membership button",
  );
}

function verifyPageStructureAndCopy(): void {
  console.log("4. Page structure and copy");

  const sources = readFeatureSourcesExceptApi();

  for (const text of REQUIRED_UI_STRINGS) {
    assert(sources.includes(text), `Membership UI must include copy: ${text}`);
  }

  for (const term of FORBIDDEN_UI_TERMS) {
    assert(
      !readUiComponentSources().toLowerCase().includes(term),
      `Membership UI must not reference forbidden term: ${term}`,
    );
  }

  assert(
    sources.includes("membership-cohort-badge--member"),
    "Member badge must use primary member styling",
  );
  assert(
    sources.includes("membership-cohort-badge--participant"),
    "Participant badge must use neutral styling",
  );
  assert(
    sources.includes("membership-timeline__step--complete"),
    "Timeline must style completed steps",
  );
  assert(sources.includes("membership-faq-accordion"), "FAQ must use accordion pattern");
}

function verifyDocumentation(): void {
  console.log("5. Documentation");

  const docPath = path.join(REPO_ROOT, "docs/MEMBERSHIP_UI_FOUNDATION.md");
  assert(fs.existsSync(docPath), "docs/MEMBERSHIP_UI_FOUNDATION.md must exist");

  const doc = fs.readFileSync(docPath, "utf-8");
  assert(doc.includes("page structure"), "Documentation must describe page structure");
  assert(doc.includes("user journey"), "Documentation must describe user journey");
  assert(
    fs.existsSync(path.join(REPO_ROOT, "docs/STRIPE_MEMBERSHIP_CONTRIBUTION.md")),
    "docs/STRIPE_MEMBERSHIP_CONTRIBUTION.md must exist",
  );
}

function verifyPackageScript(): void {
  console.log("6. Package script");

  const pkg = readRepoFile("package.json");
  assert(pkg.includes('"verify:membership-ui"'), "package.json must define verify:membership-ui");
}

function runPass(pass: number): void {
  console.log(`\n=== verify:membership-ui pass ${pass} ===`);
  verifyRouteAndComponents();
  verifyHeaderAndNavigation();
  verifyProfileAndWorkspaceIntegration();
  verifyPageStructureAndCopy();
  verifyDocumentation();
  verifyPackageScript();
}

for (let pass = 1; pass <= 3; pass += 1) {
  runPass(pass);
}

console.log("\nverify:membership-ui PASSED (3 consecutive passes).");
