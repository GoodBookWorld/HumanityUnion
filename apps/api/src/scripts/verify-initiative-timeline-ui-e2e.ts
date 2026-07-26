/**
 * TASK-098 — Initiative timeline, member UX, and workspace polish verification.
 * Run: npm run verify:initiative-timeline-ui
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

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, relativePath));
}

function verifyInitiativeTimeline(): void {
  console.log("1. Initiative Timeline Group search results");

  const searchPage = readRepoFile(
    "apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx",
  );
  const timelineGroup = readRepoFile(
    "apps/web/src/features/global-search/components/InitiativeTimelineGroup.tsx",
  );
  const stages = readRepoFile("apps/web/src/features/global-search/initiative-timeline-stages.ts");
  const types = readRepoFile("packages/types/src/domain/global-search.ts");

  assert(
    searchPage.includes("InitiativeTimelineGroup"),
    "Search must render InitiativeTimelineGroup.",
  );
  assert(searchPage.includes('view: "grouped"'), "Search must request grouped API results.");
  assert(searchPage.includes("displayResults"), "Search must consume grouped displayResults.");
  assert(
    timelineGroup.includes("initiative-timeline-group__timeline"),
    "Timeline group must expose stage columns.",
  );
  assert(stages.includes("INITIATIVE_TIMELINE_STAGES"), "Timeline must use ordered stage model.");
  assert(stages.includes("improvement_proposal"), "Timeline must support future stages.");
  assert(
    types.includes("InitiativeLifecycleSearchGroup"),
    "Search types must define grouped results.",
  );
  assert(types.includes("totalDisplayResults"), "Search response must expose display totals.");
}

function verifyCivicArchiveResults(): void {
  console.log("2. Civic Archive initiative card results grid");

  const page = readRepoFile("apps/web/src/app/civic-archive/page.tsx");
  const css = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/civic-archive-results.css",
  );

  assert(
    page.includes("CivicArchiveResultsPanel"),
    "Archive page must use results panel component.",
  );
  assert(
    readRepoFile(
      "apps/web/src/features/public-civic-archive/components/PublicArchiveInitiativeCard.tsx",
    ).includes("civic-archive-record-card"),
    "Archive results must render initiative-style cards.",
  );
  assert(
    css.includes("grid-template-columns: repeat(3"),
    "Archive desktop grid must show 3 columns.",
  );
  assert(css.includes("repeat(2"), "Archive tablet grid must show 2 columns.");
  assert(css.includes("grid-template-columns: 1fr"), "Archive mobile grid must show 1 column.");
}

function verifyParticipationAreaCommunity(): void {
  console.log("3. Participation Area community selector");

  const section = readRepoFile(
    "apps/web/src/features/participation-area/components/ParticipationAreaSection.tsx",
  );

  assert(
    section.includes('label="City / Community"'),
    "Community field must be labeled City / Community.",
  );
  assert(section.includes("GeographySearchSelect"), "Community must use GeographySearchSelect.");
  assert(
    section.includes("disabled={!regionSlug") || section.includes("!regionSlug ||"),
    "Community must depend on Region.",
  );
}

function verifyLinkedInProfile(): void {
  console.log("4. LinkedIn profile integration");

  const profileTypes = readRepoFile("packages/types/src/domain/member-profile.ts");
  const workspace = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfileWorkspace.tsx",
  );
  const summaries = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberSettingsSummaries.tsx",
  );
  const linksSection = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfessionalLinksSection.tsx",
  );
  const validators = readRepoFile(
    "apps/api/src/modules/member-profile/member-profile.validators.ts",
  );

  assert(profileTypes.includes("linkedinUrl"), "MemberProfile must include linkedinUrl.");
  assert(validators.includes("validateLinkedInUrl"), "Validators must validate LinkedIn URLs.");
  assert(
    validators.includes("https://www.linkedin.com/"),
    "LinkedIn must require linkedin.com prefix.",
  );
  assert(
    workspace.includes("MemberProfessionalLinksSection"),
    "Professional links must use dedicated section.",
  );
  assert(linksSection.includes("icons/civic/website.svg"), "Website field must show website icon.");
  assert(
    linksSection.includes("icons/civic/icons8-linkedin.svg"),
    "LinkedIn field must show LinkedIn icon.",
  );
  assert(
    summaries.includes("MemberProfessionalLinksDisplay"),
    "Summaries must show professional links separately from skills.",
  );
  assert(linksSection.includes('rel="noopener noreferrer"'), "External links must be safe.");
}

function verifyWorkspaceHeader(): void {
  console.log("5. Workspace header simplification");

  const header = readRepoFile(
    "apps/web/src/features/workspace-home/components/WorkspacePersonalHeader.tsx",
  );
  const css = readRepoFile(
    "apps/web/src/features/workspace-home/components/workspace-personal-header.css",
  );

  assert(
    !header.includes("workspace-personal-header__identity"),
    "Workspace header must remove identity block.",
  );
  assert(
    header.includes("workspace-personal-header__actions"),
    "Workspace header must retain actions.",
  );
  assert(
    css.includes("justify-content: flex-start"),
    "Workspace header actions must expand naturally.",
  );
}

function verifyCivicActivityPolish(): void {
  console.log("6. Civic Activity summary icons and anchors");

  const workspace = readRepoFile(
    "apps/web/src/features/civic-activity/components/MyCivicActivityWorkspace.tsx",
  );
  const section = readRepoFile(
    "apps/web/src/features/civic-activity/components/MyCivicActivitySection.tsx",
  );
  const profileSectionCss = readRepoFile("apps/web/src/components/member/profile-section.css");

  assert(
    workspace.includes("/icons/workspace/initiatives.svg"),
    "Activity summary must include initiative icon.",
  );
  assert(
    workspace.includes("/icons/workspace/analyses.svg"),
    "Activity summary must include analyses icon.",
  );
  assert(
    section.includes('id="section-activity-summary"'),
    "Activity Summary anchor must match nav.",
  );
  assert(
    section.includes('id="section-activity-timeline"'),
    "Activity Timeline anchor must match nav.",
  );
  assert(
    profileSectionCss.includes("scroll-margin-top"),
    "Profile sections must offset fixed header.",
  );
}

function verifyMembershipHero(): void {
  console.log("7. Membership hero illustration");

  const hero = readRepoFile("apps/web/src/features/membership/components/MembershipHero.tsx");
  const css = readRepoFile("apps/web/src/features/membership/components/membership-page.css");

  assert(
    hero.includes("MEMBER_BADGE_IMAGE_PATH"),
    "Membership hero must use member badge illustration.",
  );
  assert(hero.includes('loading="lazy"'), "Membership illustration must lazy load.");
  assert(hero.includes("alt="), "Membership illustration must include alt text.");
  assert(css.includes("membership-hero__layout"), "Membership hero must use responsive layout.");
  assert(
    fileExists("apps/web/public/illustrations/membership/member-badge.webp"),
    "Membership hero illustration asset must exist.",
  );
}

function verifyDocumentation(): void {
  console.log("8. Documentation");

  assert(fileExists("docs/SEARCH.md"), "SEARCH documentation must exist.");
  assert(fileExists("docs/MEMBER_PROFILE.md"), "MEMBER_PROFILE documentation must exist.");
  assert(fileExists("docs/WORKSPACE.md"), "WORKSPACE documentation must exist.");
  assert(fileExists("docs/CIVIC_ACTIVITY.md"), "CIVIC_ACTIVITY documentation must exist.");
  assert(fileExists("docs/MEMBERSHIP.md"), "MEMBERSHIP documentation must exist.");

  const searchDoc = readRepoFile("docs/SEARCH.md");
  const archiveDoc = readRepoFile("docs/CIVIC_ARCHIVE.md");

  assert(
    searchDoc.includes("Initiative Timeline Group"),
    "SEARCH docs must describe timeline groups.",
  );
  assert(archiveDoc.includes("Archive Results"), "Archive docs must describe results grid.");
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:initiative-timeline-ui pass ${pass} ===`);
  verifyInitiativeTimeline();
  verifyCivicArchiveResults();
  verifyParticipationAreaCommunity();
  verifyLinkedInProfile();
  verifyWorkspaceHeader();
  verifyCivicActivityPolish();
  verifyMembershipHero();
  verifyDocumentation();
  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log(`\nverify:initiative-timeline-ui PASSED (${PASS_COUNT} consecutive passes).`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
