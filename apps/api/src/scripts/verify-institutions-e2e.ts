/**
 * TASK-070 / TASK-109 — Institutions Experience verification.
 * Run: npm run verify:institutions
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const INSTITUTIONS_DIR = path.join(REPO_ROOT, "apps/web/src/features/institutions");
const INSTITUTIONS_IMAGES_DIR = path.join(REPO_ROOT, "apps/web/public/images/institutions");

const HERO_HEADLINE = "Building the Institutions of Responsible Global Cooperation";
const FOOTER_LINE = "Institutions are not built by declarations.";

const ARCHITECTURE_BLOCKS = [
  "Participants",
  "Initiatives",
  "Collaborative Analysis",
  "Collective Decision",
  "Humanity Council",
  "Implementation",
  "Public Impact",
  "Civic Archive",
] as const;

const INSTITUTION_IMAGE_FILES = [
  "humanity-council.webp",
  "chamber-state.webp",
  "chamber-ia.webp",
  "expert-analysis.webp",
  "state-collaboration.webp",
  "secretariat.webp",
  "protection-center.webp",
  "hpc.webp",
  "wpc.webp",
  "csd.webp",
  "regional-org.webp",
] as const;

const INSTITUTION_NAMES = [
  "Humanity Council",
  "Chamber of State Representatives",
  "Chamber of Intellectual Analysis",
  "Expert Analysis Team",
  "State Collaboration Department",
  "Secretariat",
  "Humanity Protection Command Center (HPC)",
  "World Protection Corps (WPC)",
  "Community Self-Defense Units",
  "Regional Humanity Union Offices",
] as const;

const STATUS_BADGES = ["Concept", "Future Institution", "Under Development"] as const;

const WPC_ACCORDION_TITLES = [
  "1. Centralized Management & Coordination",
  "2. Composition & Structure",
  "3. Recruitment & Training",
  "4. Operational Deployment & Command",
  "5. Financial & Logistical Support",
  "6. Integration with National & International Bodies",
  "7. Legal & Ethical Foundations",
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function readInstitutionsSources(): string {
  const files = fs
    .readdirSync(INSTITUTIONS_DIR, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && /\.(tsx|css|ts)$/.test(entry))
    .map((entry) => fs.readFileSync(path.join(INSTITUTIONS_DIR, entry), "utf-8"));

  return files.join("\n");
}

function verifyRouteAndNavigation(): void {
  console.log("1. Route and navigation");

  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/app/institutions/page.tsx")),
    "Institutions route must exist at /institutions",
  );

  const nav = readRepoFile("apps/web/src/features/public-experience/constants.ts");
  const footer = readRepoFile("apps/web/src/features/public-experience/footer-links.ts");
  const header = readRepoFile("apps/web/src/design-system/components/HumanityHeader.tsx");

  assert(nav.includes('href: "/institutions"'), "Primary navigation must link to /institutions");
  assert(footer.includes('href: "/institutions"'), "Footer must link to /institutions");
  assert(
    header.includes('pathname.startsWith("/institutions")'),
    "Header must mark Institutions active",
  );
}

function verifyHeroAndFooter(): void {
  console.log("2. Hero and footer statement");

  const constants = readRepoFile("apps/web/src/features/institutions/constants.ts");
  const page = readRepoFile(
    "apps/web/src/features/institutions/components/InstitutionsPageContent.tsx",
  );

  assert(constants.includes(HERO_HEADLINE), "Hero headline must be present");
  assert(
    constants.includes("proposed constitutional institutions of Humanity Union"),
    "Information banner must explain proposed constitutional institutions",
  );
  assert(constants.includes(FOOTER_LINE), "Footer statement must be present");
  assert(page.includes("institutions-hero"), "Page must render hero section");
  assert(page.includes("institutions-footer-statement"), "Page must render footer statement");
  assert(
    page.includes("PublicHomeCreateInitiativeCta"),
    "Hero must reuse shared Create Initiative CTA navigation",
  );
}

function verifyArchitectureRibbon(): void {
  console.log("3. Institution navigation ribbon");

  const constants = readRepoFile("apps/web/src/features/institutions/constants.ts");
  const ribbon = readRepoFile(
    "apps/web/src/features/institutions/components/InstitutionNavigationRibbon.tsx",
  );
  const css = readRepoFile("apps/web/src/features/institutions/institutions.css");

  for (const block of ARCHITECTURE_BLOCKS) {
    assert(constants.includes(block), `Architecture must include block: ${block}`);
  }

  assert(
    ribbon.includes("institutions-architecture__block"),
    "Ribbon must render clickable architecture blocks",
  );
  assert(
    ribbon.includes("focus-visible") ||
      css.includes("institutions-architecture__block:focus-visible"),
    "Ribbon blocks must support keyboard focus styles",
  );
  assert(ribbon.includes("scrollIntoView"), "Ribbon blocks must navigate to related sections");
  assert(
    css.includes("institutions-ribbon__track"),
    "Ribbon must include auto-scrolling track styles",
  );
  assert(css.includes("prefers-reduced-motion"), "Ribbon must respect reduced motion preferences");
}

function verifyInstitutionCards(): void {
  console.log("4. Institution cards and status badges");

  const content = readRepoFile("apps/web/src/features/institutions/content.ts");
  const card = readRepoFile("apps/web/src/features/institutions/components/InstitutionCard.tsx");

  for (const name of INSTITUTION_NAMES) {
    assert(content.includes(name), `Institution content must include: ${name}`);
  }

  for (const badge of STATUS_BADGES) {
    assert(content.includes(badge), `Status badge type must be defined: ${badge}`);
  }

  assert(card.includes("Learn More"), "Institution cards must include Learn More");
  assert(
    card.includes("Create Nomination") || card.includes("Create Initiative"),
    "Institution cards must include Create Nomination or Create Initiative placeholder",
  );
  assert(
    card.includes("All Nominations"),
    "Nominatable institution cards must include All Nominations",
  );
  assert(card.includes("Related Knowledge"), "Institution cards must include Related Knowledge");
  assert(
    card.includes("href={`/knowledge/${institution.knowledgeSlug}`}"),
    "Cards must link to Knowledge",
  );
  assert(card.includes("institutions-card__footer"), "Institution cards must align footer content");
}

function verifyIllustrationsAndHierarchy(): void {
  console.log("5. Illustrations and protection hierarchy");

  const illustrations = readRepoFile(
    "apps/web/src/features/institutions/components/InstitutionIllustration.tsx",
  );
  const hierarchy = readRepoFile(
    "apps/web/src/features/institutions/components/HpcWpcHierarchySection.tsx",
  );
  const constants = readRepoFile("apps/web/src/features/institutions/constants.ts");
  const css = readRepoFile("apps/web/src/features/institutions/institutions.css");

  assert(
    illustrations.includes("aspect-ratio: 16 / 9") || css.includes("aspect-ratio: 16 / 9"),
    "Illustrations must use 16:9 ratio",
  );
  assert(
    illustrations.includes("/images/institutions/"),
    "Illustrations must load from local institution assets",
  );
  assert(illustrations.includes('loading="lazy"'), "Illustrations must lazy-load images");

  for (const imageFile of INSTITUTION_IMAGE_FILES) {
    assert(
      fs.existsSync(path.join(INSTITUTIONS_IMAGES_DIR, imageFile)),
      `Institution image asset must exist: ${imageFile}`,
    );
  }

  assert(hierarchy.includes("Humanity Protection Command Center"), "Hierarchy must name HPC");
  assert(hierarchy.includes("World Protection Corps (WPC)"), "Hierarchy must name WPC");
  assert(
    constants.includes("Operational Command"),
    "Hierarchy must include operational command step",
  );
  assert(
    constants.includes("Regional Humanity Union Offices"),
    "Hierarchy must include regional offices step",
  );
  assert(
    constants.includes("Community Self-Defense Units"),
    "Hierarchy must include community self-defense step",
  );
  assert(hierarchy.includes("commands"), "Hierarchy must show command relationship");
}

function verifyWpcAccordion(): void {
  console.log("6. WPC featured card and accordion");

  const constants = readRepoFile("apps/web/src/features/institutions/constants.ts");
  const wpc = readRepoFile("apps/web/src/features/institutions/components/WpcFeaturedCard.tsx");

  assert(wpc.includes("institutions-wpc-featured"), "WPC must use featured card layout");
  assert(wpc.includes("<details"), "WPC accordion must use expandable sections");
  assert(wpc.includes("<summary"), "WPC accordion must expose section titles");

  for (const title of WPC_ACCORDION_TITLES) {
    assert(constants.includes(title), `WPC accordion must include section: ${title}`);
  }

  assert(WPC_ACCORDION_TITLES.length === 7, "WPC accordion must contain exactly seven sections");
}

function verifyKnowledgeAndInitiatives(): void {
  console.log("7. Knowledge links and latest initiatives");

  const api = readRepoFile("apps/web/src/features/institutions/api.ts");
  const initiatives = readRepoFile(
    "apps/web/src/features/institutions/components/InstitutionsLatestInitiativesSection.tsx",
  );

  assert(api.includes("fetchPublicSearch"), "Latest initiatives must reuse public search endpoint");
  assert(api.includes("limit = 3"), "Latest initiatives must request maximum three records");
  assert(
    initiatives.includes("Related Initiatives"),
    "Page must include Related Initiatives section",
  );
  assert(
    initiatives.includes("PublicHomeHorizontalCollection"),
    "Related initiatives must reuse shared horizontal collection component",
  );
  assert(
    initiatives.includes("PublicInitiativeMiniCard"),
    "Related initiatives must reuse shared mini initiative cards",
  );
}

function verifyPresentationAndAccessibility(): void {
  console.log("8. Presentation layers and accessibility");

  const sources = readInstitutionsSources();
  const page = readRepoFile(
    "apps/web/src/features/institutions/components/InstitutionsPageContent.tsx",
  );
  const layout = readRepoFile("apps/web/src/design-system/components/HumanityLayout.tsx");

  assert(page.includes("InstitutionsStickyNav"), "Page must include sticky section navigation");
  assert(
    page.includes("institutions-section--hero"),
    "Page must include alternating hero background",
  );
  assert(
    page.includes("institutions-section--institutions"),
    "Page must include alternating institutions background",
  );
  assert(
    sources.includes('href: "#"') || sources.includes('href="#"'),
    "Footer and card Create Initiative placeholders must remain for non-hero actions",
  );
  assert(sources.includes("aria-labelledby"), "Institutions page must use labelled sections");
  assert(sources.includes("aria-label"), "Institutions page must include aria labels");
  assert(layout.includes("hu-skip-link"), "Layout must provide skip link");
  assert(
    sources.includes("prefers-reduced-motion"),
    "Institutions CSS must respect reduced motion",
  );
}

function verifyStaticOnly(): void {
  console.log("9. Static implementation only");

  const sources = readInstitutionsSources();
  const forbidden = ["institutions.routes", "institutions.service", "InstitutionProfile", "CRM"];

  for (const term of forbidden) {
    assert(!sources.includes(term), `Institutions feature must not include ${term}`);
  }

  assert(
    !fs.existsSync(path.join(REPO_ROOT, "apps/api/src/modules/institutions")),
    "Institutions must not add backend module in TASK-070",
  );
}

function main(): void {
  verifyRouteAndNavigation();
  verifyHeroAndFooter();
  verifyArchitectureRibbon();
  verifyInstitutionCards();
  verifyIllustrationsAndHierarchy();
  verifyWpcAccordion();
  verifyKnowledgeAndInitiatives();
  verifyPresentationAndAccessibility();
  verifyStaticOnly();

  console.log("\nverify:institutions PASS");
}

main();
