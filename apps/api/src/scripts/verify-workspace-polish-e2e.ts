/**
 * TASK-049 — Workspace Polish verification.
 * Run: npm run verify:workspace-polish
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const RAW_API_MESSAGES = [
  "Initiative API is not available.",
  "Member API is not available.",
  "Preferences API is not available.",
];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyStickyTokens(): void {
  console.log("1. Unified sticky offset tokens");

  const tokens = readRepoFile("apps/web/src/design-system/tokens.css");
  const polish = readRepoFile("apps/web/src/design-system/workspace-polish.css");

  assert(tokens.includes("--hu-sticky-top"), "Sticky top token must exist");
  assert(tokens.includes("--hu-sticky-max-height"), "Sticky max height token must exist");
  assert(tokens.includes("--hu-scroll-margin-top"), "Scroll margin token must exist");
  assert(polish.includes("var(--hu-sticky-top)"), "Workspace polish must use sticky top token");
}

function verifyStickyHeader(): void {
  console.log("2. Sticky global header");

  const layout = readRepoFile("apps/web/src/design-system/layout.css");
  const humanityLayout = readRepoFile("apps/web/src/design-system/components/HumanityLayout.tsx");

  assert(layout.includes(".humanity-header"), "Header styles must exist");
  assert(layout.includes("position: sticky"), "Header must be sticky");
  assert(humanityLayout.includes("HumanityHeader"), "Layout must render global header");
  assert(
    !humanityLayout.includes("PublicExperienceHeader"),
    "Layout must not duplicate public header",
  );
}

function verifyStickyNavigation(): void {
  console.log("3. Sticky workspace navigation");

  const polish = readRepoFile("apps/web/src/design-system/workspace-polish.css");
  const memberCss = readRepoFile("apps/web/src/components/member/member-workspace.css");

  assert(
    polish.includes(".member-workspace__nav") && polish.includes("position: sticky"),
    "Workspace nav must be sticky on desktop",
  );
  assert(
    memberCss.includes("member-workspace__nav-link--active"),
    "Section nav must support active highlighting",
  );
  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/components/member/WorkspaceSectionNav.tsx")),
    "WorkspaceSectionNav client component must exist",
  );
}

function verifyStickyAssistant(): void {
  console.log("4. Sticky civic assistant");

  const polish = readRepoFile("apps/web/src/design-system/workspace-polish.css");
  const assistantCss = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/workspace-civic-assistant.css",
  );

  assert(
    polish.includes(".workspace-civic-assistant") && polish.includes("position: sticky"),
    "Assistant must be sticky on desktop",
  );
  assert(
    assistantCss.includes("var(--hu-sticky-max-height)"),
    "Assistant internal scroll must use sticky max height token",
  );
}

function verifyApiUnavailableExperience(): void {
  console.log("5. API unavailable workspace shell");

  const initiativesPage = readRepoFile("apps/web/src/app/initiatives/page.tsx");
  const unavailable = readRepoFile(
    "apps/web/src/features/initiatives/components/InitiativesUnavailableWorkspace.tsx",
  );

  assert(
    initiativesPage.includes("InitiativesUnavailableWorkspace"),
    "Initiatives page must use unavailable workspace shell",
  );
  assert(
    initiativesPage.includes("MemberWorkspace") && initiativesPage.includes("WorkspaceNavigation"),
    "Unavailable state must preserve workspace navigation",
  );
  assert(
    unavailable.includes("WorkspaceCivicAssistant"),
    "Unavailable state must preserve civic assistant",
  );
  assert(
    unavailable.includes("Workspace temporarily unavailable"),
    "Unavailable card must use participant-friendly title",
  );

  for (const message of RAW_API_MESSAGES) {
    assert(!initiativesPage.includes(message), `Must not show raw API message: ${message}`);
  }
}

function verifySkipLinkBehavior(): void {
  console.log("6. Skip link accessibility");

  const layout = readRepoFile("apps/web/src/design-system/components/HumanityLayout.tsx");
  const polish = readRepoFile("apps/web/src/design-system/workspace-polish.css");
  const globalPage = readRepoFile(
    "apps/web/src/features/global-experience/components/GlobalExperiencePage.tsx",
  );

  assert(layout.includes('className="hu-skip-link"'), "Global layout must provide skip link");
  assert(layout.includes('id="main-content"'), "Global layout must expose main content landmark");
  assert(polish.includes(".hu-skip-link"), "Skip link must be visually hidden until focus");
  assert(
    polish.includes("clip: rect(0, 0, 0, 0)"),
    "Skip link must use accessible visually-hidden pattern",
  );
  assert(!globalPage.includes("skip-link"), "Public pages must not duplicate skip links");
}

function verifySpacingConsistency(): void {
  console.log("7. Spacing token consistency");

  const profileSection = readRepoFile("apps/web/src/components/member/profile-section.css");
  const workspaceUx = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/initiative-workspace-ux.css",
  );
  const assistantCss = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/workspace-civic-assistant.css",
  );

  assert(profileSection.includes("var(--hu-space-"), "Profile sections must use spacing tokens");
  assert(workspaceUx.includes("var(--hu-space-"), "Workspace UX must use spacing tokens");
  assert(assistantCss.includes("var(--hu-space-"), "Assistant must use spacing tokens");
  assert(
    profileSection.includes("scroll-margin-top: var(--hu-scroll-margin-top)"),
    "Anchor targets must account for sticky header offset",
  );
}

function verifyLoadingErrorConsistency(): void {
  console.log("8. Loading and error state consistency");

  const workspaceUx = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/initiative-workspace-ux.css",
  );
  const loading = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/components/WorkspaceLoadingState.tsx",
  );
  const error = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/components/WorkspaceErrorState.tsx",
  );

  assert(workspaceUx.includes(".workspace-loading"), "Loading styles must exist");
  assert(workspaceUx.includes(".workspace-error"), "Error styles must exist");
  assert(workspaceUx.includes(".workspace-empty"), "Empty styles must exist");
  assert(loading.includes('role="status"'), "Loading state must expose status role");
  assert(error.includes("workspace-error"), "Error state must use shared class");
}

function verifyNoDuplicateHeaders(): void {
  console.log("9. No duplicate headers");

  const pages = [
    "apps/web/src/features/global-experience/components/GlobalExperiencePage.tsx",
    "apps/web/src/features/country-experience/components/CountryExperiencePage.tsx",
    "apps/web/src/features/region-experience/components/RegionExperiencePage.tsx",
    "apps/web/src/features/community-experience/components/CommunityExperiencePage.tsx",
  ];

  for (const page of pages) {
    const source = readRepoFile(page);
    assert(!source.includes("<PublicExperienceHeader"), `${page} must not duplicate header`);
    assert(!source.includes("<PublicExperienceFooter"), `${page} must not duplicate footer`);
  }
}

function verifyResponsiveRules(): void {
  console.log("10. Responsive behavior");

  const initiativeLayout = readRepoFile(
    "apps/web/src/features/initiatives/components/initiative-workspace-layout.css",
  );
  const polish = readRepoFile("apps/web/src/design-system/workspace-polish.css");
  const assistantCss = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/workspace-civic-assistant.css",
  );

  assert(
    initiativeLayout.includes("@media (max-width: 1024px)"),
    "Initiative layout must define tablet rules",
  );
  assert(
    initiativeLayout.includes("@media (max-width: 1200px)"),
    "Initiative layout must define 1200px rules",
  );
  assert(
    polish.includes("@media (max-width: 768px)"),
    "Workspace polish must define mobile nav rules",
  );
  assert(
    assistantCss.includes(".workspace-civic-assistant__toggle"),
    "Assistant drawer toggle must remain for tablet/mobile",
  );
}

function main(): void {
  verifyStickyTokens();
  verifyStickyHeader();
  verifyStickyNavigation();
  verifyStickyAssistant();
  verifyApiUnavailableExperience();
  verifySkipLinkBehavior();
  verifySpacingConsistency();
  verifyLoadingErrorConsistency();
  verifyNoDuplicateHeaders();
  verifyResponsiveRules();

  console.log("\nTASK-049 verify:workspace-polish PASS");
}

main();
