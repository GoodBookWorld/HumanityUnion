/**
 * TASK-047 — Humanity Design System Foundation verification.
 * Run: npm run verify:design-system
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const DESIGN_SYSTEM_DIR = path.join(REPO_ROOT, "apps/web/src/design-system");
const PUBLIC_EXPERIENCE_PAGES = [
  "apps/web/src/features/global-experience/components/GlobalExperiencePage.tsx",
  "apps/web/src/features/country-experience/components/CountryExperiencePage.tsx",
  "apps/web/src/features/region-experience/components/RegionExperiencePage.tsx",
  "apps/web/src/features/community-experience/components/CommunityExperiencePage.tsx",
];

const OFFICIAL_COMPONENTS = [
  "Button",
  "Card",
  "ProfileCard",
  "MetricCard",
  "Badge",
  "SectionHeader",
  "WorkspaceSectionShell",
  "PublicLink",
  "EmptyState",
  "LoadingState",
  "ErrorState",
  "StatusBanner",
  "HelperText",
  "NotificationCard",
  "TimelineItem",
  "ContextPanel",
  "PipelineStage",
];

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

function verifyDesignTokens(): void {
  console.log("1. Design tokens");

  const tokens = readRepoFile("apps/web/src/design-system/tokens.css");
  assert(tokens.includes("--hu-color-primary: #0174b0"), "Primary color must be #0174B0");
  assert(tokens.includes("--hu-space-"), "Spacing scale must be defined");
  assert(tokens.includes("--hu-radius-"), "Border radius scale must be defined");
  assert(tokens.includes("--hu-header-height"), "Header height token must be defined");
  assert(tokens.includes("--hu-shadow-"), "Shadow tokens must be defined");
}

function verifyGlobalLayoutShell(): void {
  console.log("2. Global layout shell");

  const layout = readRepoFile("apps/web/src/app/layout.tsx");
  const globals = readRepoFile("apps/web/src/app/globals.css");
  const humanityLayout = readRepoFile("apps/web/src/design-system/components/HumanityLayout.tsx");

  assert(layout.includes("HumanityLayout"), "Root layout must wrap pages with HumanityLayout");
  assert(globals.includes("humanity-design-system.css"), "Globals must import design system CSS");
  assert(humanityLayout.includes("HumanityHeader"), "HumanityLayout must render HumanityHeader");
  assert(humanityLayout.includes("HumanityFooter"), "HumanityLayout must render HumanityFooter");
}

function verifyStickyHeader(): void {
  console.log("3. Sticky global header");

  const layoutCss = readRepoFile("apps/web/src/design-system/layout.css");
  const header = readRepoFile("apps/web/src/design-system/components/HumanityHeader.tsx");

  assert(layoutCss.includes(".humanity-header"), "Layout CSS must define humanity header");
  assert(layoutCss.includes("position: sticky"), "Header must be sticky");
  assert(header.includes("humanity-header"), "HumanityHeader must use humanity-header class");
}

function verifyNoDuplicateHeaders(): void {
  console.log("4. No duplicate public headers");

  for (const file of PUBLIC_EXPERIENCE_PAGES) {
    const source = readRepoFile(file);
    assert(
      !source.includes("<PublicExperienceHeader"),
      `${file} must not render duplicate PublicExperienceHeader`,
    );
    assert(
      !source.includes("<PublicExperienceFooter"),
      `${file} must not render duplicate PublicExperienceFooter`,
    );
  }
}

function verifyStickyWorkspaceNavigation(): void {
  console.log("5. Sticky workspace navigation");

  const css = readRepoFile("apps/web/src/components/member/member-workspace.css");
  assert(css.includes("position: sticky"), "Workspace nav must be sticky");
  assert(
    css.includes("var(--hu-header-height)"),
    "Workspace nav sticky top must account for header",
  );
}

function verifyStickyAssistant(): void {
  console.log("6. Sticky civic assistant");

  const css = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/workspace-civic-assistant.css",
  );
  assert(css.includes(".workspace-civic-assistant__sticky"), "Assistant sticky wrapper must exist");
  assert(css.includes("position: sticky"), "Assistant must be sticky");
  assert(
    css.includes("var(--hu-header-height)"),
    "Assistant sticky top must account for global header",
  );
}

function verifySharedComponents(): void {
  console.log("7. Official shared components");

  const indexSource = readRepoFile("apps/web/src/design-system/index.ts");
  for (const component of OFFICIAL_COMPONENTS) {
    assert(indexSource.includes(component), `Design system must export ${component}`);
  }

  const requiredFiles = [
    "apps/web/src/design-system/components/Button.tsx",
    "apps/web/src/design-system/components/Card.tsx",
    "apps/web/src/design-system/components/ApiUnavailableState.tsx",
    "apps/web/src/design-system/components/HumanityLayout.tsx",
  ];

  for (const file of requiredFiles) {
    assert(fs.existsSync(path.join(REPO_ROOT, file)), `Missing design system file: ${file}`);
  }
}

function verifyApiUnavailableUx(): void {
  console.log("8. API unavailable UX");

  const apiState = readRepoFile("apps/web/src/design-system/components/ApiUnavailableState.tsx");
  assert(apiState.includes("Try again"), "ApiUnavailableState must include retry action");
  assert(apiState.includes("Back to Home"), "ApiUnavailableState must include back to home action");
  assert(apiState.includes('role="alert"'), "ApiUnavailableState must expose alert role");

  const memberPages = [
    "apps/web/src/app/initiatives/page.tsx",
    "apps/web/src/app/profile/page.tsx",
    "apps/web/src/app/preferences/page.tsx",
    "apps/web/src/app/member/page.tsx",
  ];

  for (const file of memberPages) {
    const source = readRepoFile(file);
    assert(source.includes("ApiUnavailableState"), `${file} must use ApiUnavailableState`);
    for (const message of RAW_API_MESSAGES) {
      assert(!source.includes(message), `${file} must not show raw API message: ${message}`);
    }
  }
}

function verifyTypographyAndSpacing(): void {
  console.log("9. Typography and spacing systems");

  const typography = readRepoFile("apps/web/src/design-system/typography.css");
  const components = readRepoFile("apps/web/src/design-system/components.css");

  assert(typography.includes(".hu-heading-1"), "Typography must define heading hierarchy");
  assert(components.includes("var(--hu-space-"), "Components must use spacing tokens");
  assert(components.includes("var(--hu-radius-"), "Components must use radius tokens");
}

function verifyAccessibilityBasics(): void {
  console.log("10. Accessibility basics");

  const header = readRepoFile("apps/web/src/design-system/components/HumanityHeader.tsx");
  const components = readRepoFile("apps/web/src/design-system/components.css");

  assert(header.includes('aria-label="Primary navigation"'), "Header nav must have aria label");
  assert(header.includes("aria-current="), "Header must mark current page");
  assert(components.includes(":focus-visible"), "Design system must define focus-visible styles");
}

function verifyResponsiveRules(): void {
  console.log("11. Responsive behavior");

  const layoutCss = readRepoFile("apps/web/src/design-system/layout.css");
  const memberCss = readRepoFile("apps/web/src/components/member/member-workspace.css");
  const initiativeCss = readRepoFile(
    "apps/web/src/features/initiatives/components/initiative-workspace-layout.css",
  );

  assert(layoutCss.includes("@media (max-width: 768px)"), "Layout must define mobile rules");
  assert(memberCss.includes("@media (max-width: 768px)"), "Workspace must define mobile rules");
  assert(
    initiativeCss.includes("@media (max-width: 1024px)"),
    "Initiative layout must define tablet rules",
  );
}

function verifyCssArchitecture(): void {
  console.log("12. CSS architecture");

  assert(fs.existsSync(DESIGN_SYSTEM_DIR), "Design system directory must exist");
  assert(
    fs.existsSync(path.join(DESIGN_SYSTEM_DIR, "humanity-design-system.css")),
    "Design system entry CSS must exist",
  );

  const uxCss = readRepoFile(
    "apps/web/src/features/initiative-workspace-ux/initiative-workspace-ux.css",
  );
  assert(
    uxCss.includes("var(--hu-") || uxCss.includes("var(--color-"),
    "Workspace UX CSS must reference shared tokens",
  );
}

function verifyPublicExperienceStructure(): void {
  console.log("13. Public Experience structure preserved");

  for (const file of PUBLIC_EXPERIENCE_PAGES) {
    const source = readRepoFile(file);
    assert(source.includes('id="main-content"'), `${file} must preserve main content landmark`);
    assert(source.includes("__skip-link"), `${file} must preserve skip link`);
  }
}

function main(): void {
  verifyDesignTokens();
  verifyGlobalLayoutShell();
  verifyStickyHeader();
  verifyNoDuplicateHeaders();
  verifyStickyWorkspaceNavigation();
  verifyStickyAssistant();
  verifySharedComponents();
  verifyApiUnavailableUx();
  verifyTypographyAndSpacing();
  verifyAccessibilityBasics();
  verifyResponsiveRules();
  verifyCssArchitecture();
  verifyPublicExperienceStructure();

  console.log("\nTASK-047 verify:design-system PASS");
}

main();
