/**
 * TASK-096 — Country Experience, Civic Media & Public Data Polish verification.
 * Run: npm run verify:public-data-media-polish
 */

import assertStrict from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TRUSTED_MEDIA_RESOURCES } from "../modules/civic-media-center/content/trusted-media.js";
import { listCountryTrustedMediaResources } from "../modules/country-statistics/country-public.service.js";
import { listPublicCivicArchiveIndex } from "../modules/public-civic-archive/public-civic-archive.projection.js";

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

function verifyCountryStatistics(): void {
  console.log("1. Country statistics cards and icons");

  const page = readRepoFile(
    "apps/web/src/features/country-experience/components/CountryExperienceDynamicPage.tsx",
  );
  const config = readRepoFile(
    "apps/web/src/features/platform-statistics/public-statistics-config.ts",
  );

  assert(
    page.includes("PublicStatisticsGrid"),
    "Country page must use shared PublicStatisticsGrid.",
  );
  assert(
    page.includes("COUNTRY_STATISTIC_CARDS"),
    "Country page must use shared statistic card config.",
  );
  assert(config.includes('label: "Participants"'), "Country statistics must include Participants.");
  assert(
    config.includes('label: "Official Responses"'),
    "Country statistics must include Official Responses.",
  );
  assert(
    config.includes('label: "Civic Action Packages"'),
    "Country statistics must include Civic Action Packages.",
  );

  for (const iconPath of [
    "members.svg",
    "member-check.svg",
    "regions.svg",
    "city.svg",
    "initiatives.svg",
    "collective-decisions.svg",
    "packages.svg",
    "responses.svg",
    "archive.svg",
  ]) {
    assert(
      fileExists(`apps/web/public/icons/workspace/${iconPath}`),
      `Missing workspace statistic icon: ${iconPath}`,
    );
  }

  assert(
    page.includes("platform-statistics"),
    "Country statistics must reuse shared platform statistics styling.",
  );
  assert(
    page.includes("temporarily unavailable"),
    "Country statistics must show unavailable state.",
  );
}

async function verifyCountrySearchAndMedia(): Promise<void> {
  console.log("2. Country search layout and local civic media logos");

  const page = readRepoFile(
    "apps/web/src/features/country-experience/components/CountryExperienceDynamicPage.tsx",
  );
  const css = readRepoFile(
    "apps/web/src/features/country-experience/country-experience-dynamic.css",
  );

  assert(
    page.includes("country-experience-dynamic__search-card"),
    "Country search must use card layout.",
  );
  assert(
    page.includes('className="hu-button hu-button--primary"'),
    "Country search must use primary button.",
  );
  assert(page.includes("Clear Filters"), "Country search must expose Clear Filters.");
  assert(page.includes("Country scope:"), "Country search must show fixed country scope.");
  assert(
    css.includes("country-experience-dynamic__search-primary"),
    "Country search must define primary row.",
  );
  assert(page.includes("MediaLogo"), "Country media cards must use MediaLogo images.");

  const canadaMedia = await listCountryTrustedMediaResources("CA");
  assert(canadaMedia.length === 6, "Canada must expose six local media resources.");
  assert(
    new Set(canadaMedia.map((resource) => resource.id)).size === canadaMedia.length,
    "Country media list must not contain duplicates.",
  );
}

function verifyFooterPlatformLinks(): void {
  console.log("3. Footer Platform navigation");

  const footerLinks = readRepoFile("apps/web/src/features/public-experience/footer-links.ts");

  assert(
    footerLinks.includes('{ label: "Institutions", href: "/institutions"'),
    "Footer column one must start with Institutions.",
  );
  assert(footerLinks.includes('href: "/membership"'), "Footer must include Membership link.");
  assert(footerLinks.includes('href: "/civic-archive"'), "Footer must include Civic Archive link.");
  assert(footerLinks.includes('href: "/media"'), "Footer must include Civic Media link.");

  const columnOne = footerLinks.split("FOOTER_PLATFORM_COLUMN_TWO")[0] ?? "";
  assert(columnOne.includes('href: "/knowledge"'), "Knowledge must remain in column one.");
  assert(!columnOne.includes('href: "/search"'), "Search must not appear in column one.");
}

async function verifyCivicArchiveFilters(): Promise<void> {
  console.log("4. Civic Archive geographic filters");

  const filters = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveFiltersForm.tsx",
  );
  const projection = readRepoFile(
    "apps/api/src/modules/public-civic-archive/public-civic-archive.projection.ts",
  );

  assert(
    filters.includes("GeographySearchSelect"),
    "Civic Archive must use geography search select dropdowns.",
  );
  assert(
    !filters.includes("GeographyMultiSelect"),
    "Civic Archive must not use checkbox multi-select.",
  );
  assert(
    filters.includes('label="City / Community"'),
    "Community field must be labeled City / Community.",
  );
  assert(
    filters.includes('className="hu-button hu-button--primary"'),
    "Apply filters must use primary button.",
  );
  assert(
    projection.includes("parseFilterValues"),
    "Archive projection must support multi-value filters.",
  );
  assert(
    projection.includes("matchesCountryFilter"),
    "Archive projection must resolve country filters.",
  );

  const filtered = await listPublicCivicArchiveIndex({ country: "CA,US" });
  assert(Array.isArray(filtered), "Archive index must accept comma-separated country filters.");
}

function verifyHomeStatistics(): void {
  console.log("5. Home statistics data sources");

  const homeStats = readRepoFile(
    "apps/web/src/features/platform-statistics/components/HumanityUnionInNumbers.tsx",
  );

  assert(
    homeStats.includes("fetchPlatformStatistics"),
    "Home statistics must use platform statistics API.",
  );
  assert(
    homeStats.includes("fetchMembershipStatistics"),
    "Home statistics must use membership statistics API.",
  );
  assert(
    homeStats.includes("Promise.allSettled"),
    "Home statistics must tolerate partial API failures.",
  );
  assert(
    homeStats.includes("Unavailable"),
    "Home statistics must not show zero for unavailable metrics.",
  );
  assert(!homeStats.includes("Math.random"), "Home statistics must not use random values.");
}

function verifyMemberAnchors(): void {
  console.log("6. Member anchor offset and geography");

  const profileSection = readRepoFile("apps/web/src/components/member/profile-section.css");
  const tokens = readRepoFile("apps/web/src/design-system/tokens.css");
  const participation = readRepoFile(
    "apps/web/src/features/participation-area/components/ParticipationAreaSection.tsx",
  );

  assert(
    tokens.includes("--humanity-header-offset"),
    "Design tokens must define humanity header offset.",
  );
  assert(
    profileSection.includes("scroll-margin-top: var(--humanity-header-offset"),
    "Profile sections must scroll below fixed header.",
  );
  assert(
    participation.includes("GeographySearchSelect"),
    "Participation area must use geography selectors.",
  );
}

function verifyCivicMediaCenter(): void {
  console.log("7. Civic Media Center logos, resources, and carousels");

  const page = readRepoFile(
    "apps/web/src/features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
  );
  const trustedMedia = readRepoFile(
    "apps/api/src/modules/civic-media-center/content/trusted-media.ts",
  );

  assert(page.includes("MediaLogo"), "Civic Media Center must render MediaLogo images.");
  assert(
    page.includes('layout="four-two-one"'),
    "Trusted media sections must use shared four/two/one rail layout.",
  );
  assert(
    page.includes("HuxDirectorySection") || page.includes("HuxDiscoveryShell"),
    "Civic Media page must use HUX horizontal rails.",
  );
  assert(trustedMedia.includes("logoUrl"), "Trusted media records must include logoUrl.");
  assert(trustedMedia.includes("al-jazeera"), "Trusted media must include Al Jazeera.");
  assert(trustedMedia.includes("new-york-times"), "Trusted media must include The New York Times.");
  assert(
    trustedMedia.includes("washington-post"),
    "Trusted media must include The Washington Post.",
  );

  const requiredAssets = [
    "afp.webp",
    "aljazeera.webp",
    "dw.webp",
    "guardian.webp",
    "le-monde.webp",
    "npr.webp",
    "nytimes.webp",
    "pbs.webp",
    "wpost.webp",
  ];

  const canadaAssets = [
    "cbc.webp",
    "globe-mail.webp",
    "global-news.webp",
    "la-presse.webp",
    "ca-press.webp",
    "ctv.webp",
  ];

  for (const asset of requiredAssets) {
    assert(
      fileExists(`apps/web/public/images/media/${asset}`),
      `Missing civic media logo asset: ${asset}`,
    );
  }

  for (const asset of canadaAssets) {
    assert(
      fileExists(`apps/web/public/images/media/canada/${asset}`),
      `Missing Canada civic media logo asset: ${asset}`,
    );
  }

  const ids = TRUSTED_MEDIA_RESOURCES.map((resource) => resource.id);
  assertStrict.equal(
    new Set(ids).size,
    ids.length,
    "Trusted media resources must not contain duplicates.",
  );
}

function verifyDocumentation(): void {
  console.log("8. Documentation");

  assert(fileExists("docs/COUNTRY_EXPERIENCE.md"), "Country Experience documentation must exist.");
  assert(fileExists("docs/CIVIC_MEDIA_CENTER.md"), "Civic Media Center documentation must exist.");
  assert(fileExists("docs/CIVIC_ARCHIVE.md"), "Civic Archive documentation must exist.");

  const countryDoc = readRepoFile("docs/COUNTRY_EXPERIENCE.md");
  assert(countryDoc.includes("nine"), "Country documentation must describe nine statistics.");
  assert(
    countryDoc.includes("logoUrl"),
    "Country documentation must describe media logo behavior.",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:public-data-media-polish pass ${pass} ===`);
  verifyCountryStatistics();
  await verifyCountrySearchAndMedia();
  verifyFooterPlatformLinks();
  await verifyCivicArchiveFilters();
  verifyHomeStatistics();
  verifyMemberAnchors();
  verifyCivicMediaCenter();
  verifyDocumentation();
  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log(`\nverify:public-data-media-polish PASSED (${PASS_COUNT} consecutive passes).`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
