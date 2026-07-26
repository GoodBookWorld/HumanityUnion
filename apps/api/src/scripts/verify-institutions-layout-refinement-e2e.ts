/**
 * TASK-109C — Institutions anchor offset and layout refinement verification.
 * Run: npm run verify:institutions-layout-refinement
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const STICKY_NAV_TARGETS = [
  {
    label: "Architecture",
    targetId: "institutions-architecture",
    headingId: "institutions-architecture-title",
  },
  {
    label: "Institutions",
    targetId: "institutions-grid-section",
    headingId: "institutions-grid-title",
  },
  {
    label: "Protection",
    targetId: "institutions-protection",
    headingId: "institutions-hierarchy-title",
  },
  { label: "WPC", targetId: "institution-wpc", headingId: "institutions-wpc-title" },
  {
    label: "Regional Offices",
    targetId: "regional-offices",
    headingId: "institutions-regional-title",
  },
  {
    label: "Related Initiatives",
    targetId: "institutions-related-initiatives",
    headingId: "institutions-related-initiatives-title",
  },
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyAnchorOffsetCss(): void {
  console.log("1. Anchor offset CSS");

  const css = readRepoFile("apps/web/src/features/institutions/institutions.css");

  assert(
    css.includes("--institutions-nav-height"),
    "CSS must define institutions nav height variable",
  );
  assert(
    css.includes("--institutions-anchor-offset"),
    "CSS must define institutions anchor offset variable",
  );
  assert(
    css.includes("var(--hu-header-height)") && css.includes("var(--institutions-nav-height)"),
    "Anchor offset must account for header and institutions sticky navigation",
  );
  assert(
    css.includes("scroll-margin-top: var(--institutions-anchor-offset)"),
    "Sections must use scroll-margin-top",
  );
  assert(
    css.includes("#institutions-architecture") &&
      css.includes("#institutions-grid-section") &&
      css.includes("#institutions-protection") &&
      css.includes("#institution-wpc") &&
      css.includes("#regional-offices") &&
      css.includes("#institutions-related-initiatives"),
    "All sticky navigation section targets must receive scroll-margin-top",
  );
  assert(
    css.includes("--institutions-nav-height: 0px"),
    "Mobile offset must remove institutions nav height when sticky navigation is hidden",
  );
  assert(
    css.includes("top: var(--hu-header-height)"),
    "Sticky institutions navigation must sit below the global header",
  );
}

function verifyStickyNavigationLinks(): void {
  console.log("2. Sticky navigation links and section IDs");

  const constants = readRepoFile("apps/web/src/features/institutions/constants.ts");
  const stickyNav = readRepoFile(
    "apps/web/src/features/institutions/components/InstitutionsStickyNav.tsx",
  );
  const page = readRepoFile(
    "apps/web/src/features/institutions/components/InstitutionsPageContent.tsx",
  );
  const hierarchy = readRepoFile(
    "apps/web/src/features/institutions/components/HpcWpcHierarchySection.tsx",
  );
  const wpc = readRepoFile("apps/web/src/features/institutions/components/WpcFeaturedCard.tsx");
  const related = readRepoFile(
    "apps/web/src/features/institutions/components/InstitutionsLatestInitiativesSection.tsx",
  );
  const ribbon = readRepoFile(
    "apps/web/src/features/institutions/components/InstitutionNavigationRibbon.tsx",
  );

  assert(
    stickyNav.includes("href={`#${item.targetId}`}"),
    "Sticky navigation must use valid hash href links",
  );
  assert(
    !stickyNav.includes("scrollIntoView"),
    "Sticky navigation must rely on native hash scrolling",
  );

  for (const target of STICKY_NAV_TARGETS) {
    assert(
      constants.includes(`targetId: "${target.targetId}"`),
      `Sticky navigation constants must include target: ${target.label}`,
    );
  }

  assert(
    ribbon.includes('id="institutions-architecture"'),
    "Architecture section must expose stable anchor ID",
  );
  assert(
    page.includes('id="institutions-grid-section"'),
    "Institutions section must expose stable anchor ID",
  );
  assert(
    hierarchy.includes('id="institutions-protection"'),
    "Protection section must expose stable anchor ID",
  );
  assert(wpc.includes('id="institution-wpc"'), "WPC section must expose stable anchor ID");
  assert(
    page.includes('id="regional-offices"'),
    "Regional offices section must expose stable anchor ID",
  );
  assert(
    related.includes('id="institutions-related-initiatives"'),
    "Related initiatives section must expose stable anchor ID",
  );

  for (const target of STICKY_NAV_TARGETS) {
    assert(
      page.includes(`id="${target.targetId}"`) ||
        hierarchy.includes(`id="${target.targetId}"`) ||
        wpc.includes(`id="${target.targetId}"`) ||
        related.includes(`id="${target.targetId}"`) ||
        ribbon.includes(`id="${target.targetId}"`),
      `Section anchor must exist for ${target.label}: #${target.targetId}`,
    );
    assert(
      page.includes(`id="${target.headingId}"`) ||
        hierarchy.includes(`id="${target.headingId}"`) ||
        wpc.includes(`id="${target.headingId}"`) ||
        related.includes(`id="${target.headingId}"`) ||
        ribbon.includes(`id="${target.headingId}"`),
      `Section heading must exist for ${target.label}: #${target.headingId}`,
    );
  }
}

function verifyHpcIllustrationSizing(): void {
  console.log("3. HPC illustration sizing");

  const css = readRepoFile("apps/web/src/features/institutions/institutions.css");
  const illustration = readRepoFile(
    "apps/web/src/features/institutions/components/InstitutionIllustration.tsx",
  );

  assert(
    illustration.includes('hpc: "/images/institutions/hpc.webp"'),
    "HPC hero illustration must use /images/institutions/hpc.webp",
  );
  assert(
    css.includes(".institutions-hierarchy__node .institutions-hero-illustration"),
    "HPC hero illustration must be scoped to hierarchy presentation",
  );
  assert(
    css.includes("min(100%, 500px)"),
    "HPC illustration must cap desktop width at approximately 500px",
  );
  assert(
    css.includes("max-height: 300px"),
    "HPC illustration must cap desktop height at approximately 300px",
  );
  assert(css.includes("aspect-ratio: 5 / 3"), "HPC illustration must preserve a 5:3 aspect ratio");
  assert(css.includes("margin-inline: auto"), "HPC illustration must be centered");
}

function verifyWpcFeaturedLayout(): void {
  console.log("4. WPC featured 30/70 layout");

  const css = readRepoFile("apps/web/src/features/institutions/institutions.css");
  const wpc = readRepoFile("apps/web/src/features/institutions/components/WpcFeaturedCard.tsx");
  const illustration = readRepoFile(
    "apps/web/src/features/institutions/components/InstitutionIllustration.tsx",
  );

  assert(
    wpc.includes("institutions-wpc-featured__media"),
    "WPC illustration must live in a dedicated media column",
  );
  assert(
    wpc.includes("institutions-wpc-featured__body"),
    "WPC body must remain a dedicated content column",
  );
  assert(wpc.includes('id="institutions-wpc-title"'), "WPC heading ID must remain for ARIA");
  assert(
    wpc.includes('aria-labelledby="institutions-wpc-title"'),
    "WPC section must retain ARIA heading relationship",
  );
  assert(wpc.includes("<details"), "WPC accordion content must remain present");
  assert(
    css.includes("grid-template-columns: minmax(220px, 30%) minmax(0, 70%)"),
    "WPC desktop layout must use a 30/70 grid",
  );
  assert(
    css.includes("grid-template-columns: 1fr"),
    "WPC layout must stack to one column on mobile",
  );
  assert(
    wpc.includes('variant="hero"') && illustration.includes('wpc: "/images/institutions/wpc.webp"'),
    "WPC featured illustration must use the hero WPC asset mapping",
  );
}

function verifyAccessibility(): void {
  console.log("5. Accessibility refinements");

  const css = readRepoFile("apps/web/src/features/institutions/institutions.css");
  const stickyNav = readRepoFile(
    "apps/web/src/features/institutions/components/InstitutionsStickyNav.tsx",
  );
  const wpc = readRepoFile("apps/web/src/features/institutions/components/WpcFeaturedCard.tsx");

  assert(
    stickyNav.includes(":focus-visible") ||
      css.includes(".institutions-sticky-nav__link:focus-visible"),
    "Sticky navigation links must retain visible focus styles",
  );
  assert(wpc.includes("decorative"), "WPC illustration must avoid duplicated adjacent alt text");
}

function main(): void {
  verifyAnchorOffsetCss();
  verifyStickyNavigationLinks();
  verifyHpcIllustrationSizing();
  verifyWpcFeaturedLayout();
  verifyAccessibility();

  console.log("\nverify:institutions-layout-refinement PASS");
}

main();
