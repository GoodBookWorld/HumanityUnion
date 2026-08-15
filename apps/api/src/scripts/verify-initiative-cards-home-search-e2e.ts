/**
 * TASK-104 — Initiative Cards, Home Initiatives Window & Search Simplification verification.
 * Run: npm run verify:initiative-cards-home-search
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

function verifySharedMiniCard(): void {
  console.log("1. Shared PublicInitiativeMiniCard");

  const card = readRepoFile(
    "apps/web/src/features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx",
  );
  const css = readRepoFile(
    "apps/web/src/features/public-initiative-mini-card/public-initiative-mini-card.css",
  );

  assert(
    fileExists("apps/web/src/features/public-initiative-mini-card/index.ts"),
    "Mini card barrel required.",
  );
  assert(
    card.includes("export function PublicInitiativeMiniCard"),
    "Mini card component required.",
  );
  assert(card.includes("<Link"), "Mini card must use full-card Link.");
  assert(card.includes("/initiatives/public/"), "Mini card must link to public initiative route.");
  assert(card.includes("aria-label"), "Mini card must expose accessible name.");
  assert(
    card.includes("PUBLIC_INITIATIVE_MINI_CARD_FALLBACK_IMAGE"),
    "Mini card must define image fallback.",
  );
  assert(
    card.includes("/images/initiatives/initiative-default.webp"),
    "Mini card fallback must use /images/initiatives/initiative-default.webp.",
  );
  assert(card.includes("PublicInitiativeMiniCardPlaceholder"), "Placeholder card must be defined.");
  assert(
    card.includes("Initiative slot awaiting publication"),
    "Placeholder must use awaiting-publication label.",
  );
  assert(
    card.includes("pointer-events: none") || css.includes("pointer-events: none"),
    "Placeholder must not be clickable.",
  );
  assert(css.includes("grid-template-columns: repeat(3"), "Mini card grid must support 3 columns.");
  assert(
    css.includes("grid-template-columns: 1fr"),
    "Mini card grid must support 1 column on mobile.",
  );
  assert(css.includes("-webkit-line-clamp"), "Mini card must clamp overflowing text.");
}

function verifyHomeLatestInitiativesWindow(): void {
  console.log("2. Home latest initiatives window");

  const section = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeLatestInitiativesSection.tsx",
  );
  const api = readRepoFile("apps/web/src/features/public-home-v2/api.ts");
  const heroCss = readRepoFile("apps/web/src/features/public-home-v2/public-home-v2.css");

  assert(
    section.includes("Latest Civic Initiatives") ||
      section.includes("PUBLIC_HOME_LATEST_INITIATIVES"),
    "Home section title required.",
  );
  assert(
    section.includes("PUBLIC_HOME_LATEST_INITIATIVES") ||
      section.includes("Explore initiatives addressing challenges of global significance"),
    "Home section subtitle required.",
  );
  assert(section.includes("PublicInitiativeMiniCard"), "Home must render shared mini card.");
  assert(
    section.includes("PublicInitiativeMiniCardPlaceholder"),
    "Home must render placeholder slots.",
  );
  assert(section.includes("HOME_LATEST_INITIATIVES_SLOT_COUNT"), "Home must use 18-slot constant.");
  assert(
    api.includes("fetchWorldInitiativesProjection"),
    "Home API must use world initiatives projection.",
  );
  assert(
    api.includes("HOME_LATEST_INITIATIVES_SLOT_COUNT = 18"),
    "Home API must request limit=18.",
  );
  assert(
    section.includes("PublicHomeHorizontalCollection") || section.includes("PublicHomeCarousel"),
    "Home must use shared horizontal collection.",
  );
  assert(
    section.includes("View All Initiatives"),
    "Home must include View All Initiatives action.",
  );
  assert(section.includes('href="/initiatives"'), "View All must route to /initiatives.");
  assert(!section.includes("bootstrap"), "Home must not use bootstrap fake initiatives.");
  assert(
    heroCss.includes("--public-home-hero-background-image"),
    "Hero background CSS variable required.",
  );
  assert(
    heroCss.includes("/illustrations/unity.webp"),
    "Hero background must reference unity.webp.",
  );
  assert(heroCss.includes("@media (min-width: 1024px)"), "Hero background must be desktop-only.");
}

function verifyCountryPageUsage(): void {
  console.log("3. Country page mini card usage");

  const page = readRepoFile(
    "apps/web/src/features/country-experience/components/CountryExperienceDynamicPage.tsx",
  );
  const service = readRepoFile("apps/api/src/modules/country-statistics/country-public.service.ts");

  assert(page.includes("CountryInitiativeRailCard"), "Country page must use initiative rail cards.");
  assert(
    page.includes("HuxDiscoverySection") || page.includes("HuxDirectorySection"),
    "Country page must use HUX horizontal sections.",
  );
  assert(
    !page.includes("CountryInitiativeCard"),
    "Country page must not keep bespoke initiative card.",
  );
  assert(
    !page.includes("PublicInitiativeMiniCardPlaceholder"),
    "Country page must not show placeholders.",
  );
  assert(
    service.includes("listCountryInitiativeCardProjections"),
    "Country API projection required.",
  );
  assert(
    service.includes("resolveInitiativeSearchGeography"),
    "Country filtering must use geography resolver.",
  );
  assert(service.includes("summary:"), "Country card projection must include summary.");
  assert(
    service.includes("geographyLabel:"),
    "Country card projection must include geography label.",
  );
}

function verifyWorldInitiativesApi(): void {
  console.log("4. World initiatives API");

  const routes = readRepoFile(
    "apps/api/src/modules/initiatives/public-world-initiatives.routes.ts",
  );
  const projection = readRepoFile(
    "apps/api/src/modules/initiatives/initiative-world-initiatives.projection.ts",
  );

  assert(
    routes.includes("WORLD_INITIATIVES_DEFAULT_LIMIT"),
    "World route must honor default limit.",
  );
  assert(routes.includes("req.query.limit"), "World route must accept limit query param.");
  assert(routes.includes("supportSummary"), "World route must enrich support summary.");
  assert(
    projection.includes("WORLD_INITIATIVES_DEFAULT_LIMIT = 18"),
    "Projection default limit must be 18.",
  );
  assert(projection.includes("summary:"), "World projection must include summary.");
}

function verifySearchSimplification(): void {
  console.log("5. Global Search simplification");

  const search = readRepoFile(
    "apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx",
  );
  const css = readRepoFile("apps/web/src/features/global-search/global-search-page.css");

  assert(search.includes("global-search-page__filters"), "Search form section required.");
  assert(search.includes("global-search-page__results"), "Search results section required.");
  assert(search.includes("Search Results"), "Search results heading required.");
  assert(
    search.includes("Enter keywords or select filters to find public civic records."),
    "Initial state copy required.",
  );
  assert(
    search.includes("No public civic records match your search."),
    "No-results copy required.",
  );
  assert(search.includes("Search is temporarily unavailable."), "API failure copy required.");
  assert(search.includes("InitiativeTimelineGroup"), "Grouped initiative lifecycle must remain.");
  assert(search.includes('view: "grouped"'), "Search must request grouped results.");
  assert(!search.includes("Back to Home"), "Search must not include Back to Home section.");
  assert(
    !search.includes("global-search-page__facets"),
    "Search must not render separate facets aside.",
  );
  assert(
    !search.includes("global-search-page__intro"),
    "Search must not include promotional intro.",
  );
  assert(
    css.includes(".global-search-page__results"),
    "Search results container styling required.",
  );
}

function runPass(pass: number): void {
  console.log(`\n=== verify:initiative-cards-home-search pass ${pass} ===`);
  verifySharedMiniCard();
  verifyHomeLatestInitiativesWindow();
  verifyCountryPageUsage();
  verifyWorldInitiativesApi();
  verifySearchSimplification();
}

for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
  runPass(pass);
}

console.log("\nverify:initiative-cards-home-search PASSED (3 consecutive passes).");
