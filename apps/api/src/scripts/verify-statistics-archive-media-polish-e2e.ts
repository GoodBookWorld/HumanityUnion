/**
 * TASK-097 — Statistics consistency, archive filters, and media polish verification.
 * Run: npm run verify:statistics-archive-media-polish
 */

import assertStrict from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TRUSTED_MEDIA_RESOURCES } from "../modules/civic-media-center/content/trusted-media.js";
import { listCountryTrustedMediaResources } from "../modules/country-statistics/country-public.service.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const PASS_COUNT = 3;

const HOME_CARD_LABELS = [
  "Participants",
  "Members",
  "Countries",
  "Regions",
  "Initiatives",
  "Collective Decisions",
  "Civic Action Packages",
  "Official Responses",
  "Civic Archive",
] as const;

const COUNTRY_CARD_LABELS = [
  "Participants",
  "Members",
  "Regions",
  "Cities / Communities",
  "Initiatives",
  "Collective Decisions",
  "Civic Action Packages",
  "Official Responses",
  "Civic Archive",
] as const;

const CANADA_MEDIA = [
  {
    id: "cbc",
    logo: "cbc.webp",
    url: "https://www.cbc.ca/",
  },
  {
    id: "globe-and-mail",
    logo: "globe-mail.webp",
    url: "https://www.theglobeandmail.com/",
  },
  {
    id: "global-news-canada",
    logo: "global-news.webp",
    url: "https://globalnews.ca/",
  },
  {
    id: "la-presse-canada",
    logo: "la-presse.webp",
    url: "https://www.lapresse.ca/",
  },
  {
    id: "canadian-press",
    logo: "ca-press.webp",
    url: "https://www.thecanadianpress.com/",
  },
  {
    id: "ctv-news-canada",
    logo: "ctv.webp",
    url: "https://www.ctvnews.ca/",
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

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, relativePath));
}

function verifyStatisticsConfig(): void {
  console.log("1. Shared public statistics configuration");

  const config = readRepoFile(
    "apps/web/src/features/platform-statistics/public-statistics-config.ts",
  );
  const homeWidget = readRepoFile(
    "apps/web/src/features/platform-statistics/components/HumanityUnionInNumbers.tsx",
  );
  const countryPage = readRepoFile(
    "apps/web/src/features/country-experience/components/CountryExperienceDynamicPage.tsx",
  );
  const grid = readRepoFile(
    "apps/web/src/features/platform-statistics/components/PublicStatisticsGrid.tsx",
  );

  assert(config.includes('label: "Participants"'), "Statistics config must label Participants.");
  assert(!config.includes('label: "Users"'), "Statistics config must not label Users in UI.");
  assertStrict.equal(
    (config.match(/HOME_STATISTIC_CARDS[\s\S]*?];/)?.[0]?.match(/label:/g) ?? []).length,
    9,
    "Home must define exactly 9 statistic cards.",
  );
  assertStrict.equal(
    (config.match(/COUNTRY_STATISTIC_CARDS[\s\S]*?];/)?.[0]?.match(/label:/g) ?? []).length,
    9,
    "Country must define exactly 9 statistic cards.",
  );

  for (const label of HOME_CARD_LABELS) {
    assert(config.includes(`label: "${label}"`), `Home config must include ${label}.`);
  }

  for (const label of COUNTRY_CARD_LABELS) {
    assert(config.includes(`label: "${label}"`), `Country config must include ${label}.`);
  }

  assert(
    !/COUNTRY_STATISTIC_CARDS[\s\S]*label: "Countries"/.test(config),
    "Country cards must not include Countries.",
  );

  const countrySection = config.split("COUNTRY_STATISTIC_CARDS")[1] ?? "";
  const regionsIndex = countrySection.indexOf('label: "Regions"');
  const citiesIndex = countrySection.indexOf('label: "Cities / Communities"');
  assert(
    regionsIndex >= 0 && citiesIndex > regionsIndex,
    "Cities / Communities must follow Regions.",
  );

  assert(homeWidget.includes("PublicStatisticsGrid"), "Home must use PublicStatisticsGrid.");
  assert(
    countryPage.includes("PublicStatisticsGrid"),
    "Country page must use PublicStatisticsGrid.",
  );
  assert(
    countryPage.includes("COUNTRY_STATISTIC_CARDS"),
    "Country page must import shared country card config.",
  );
  assert(
    !fileExists("apps/web/src/features/country-experience/country-statistics-icons.ts"),
    "Legacy country-statistics-icons must be removed.",
  );
  assert(grid.includes("Unavailable"), "Statistics grid must preserve unavailable state.");
  assert(
    grid.includes("platform-statistics__grid"),
    "Statistics grid must preserve shared layout.",
  );

  for (const icon of [
    "members.svg",
    "member-check.svg",
    "countries.svg",
    "regions.svg",
    "city.svg",
    "initiatives.svg",
    "collective-decisions.svg",
    "packages.svg",
    "responses.svg",
    "archive.svg",
  ]) {
    assert(
      fileExists(`apps/web/public/icons/workspace/${icon}`),
      `Missing statistic icon asset: ${icon}`,
    );
  }
}

function verifyCivicArchiveFilters(): void {
  console.log("2. Civic Archive compact dependent selectors");

  const filters = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveFiltersForm.tsx",
  );
  const css = readRepoFile("apps/web/src/app/civic-archive/civic-archive-page.css");

  assert(
    filters.includes("GeographySearchSelect"),
    "Civic Archive must use GeographySearchSelect dropdowns.",
  );
  assert(
    !filters.includes("GeographyMultiSelect"),
    "Civic Archive must not use checkbox multi-select.",
  );
  assert(filters.includes('label="Country"'), "Civic Archive must expose Country select.");
  assert(filters.includes('label="Region"'), "Civic Archive must expose Region select.");
  assert(
    filters.includes('label="City / Community"'),
    "Civic Archive must expose City / Community select.",
  );
  assert(filters.includes("disabled={!country}"), "Region must stay disabled until Country.");
  assert(filters.includes("handleCountryChange"), "Country change must reset dependent values.");
  assert(filters.includes("handleClearFilters"), "Civic Archive must expose Clear Filters.");
  assert(filters.includes("hu-form-actions"), "Civic Archive actions must use hu-form-actions.");
  assert(
    filters.includes('className="hu-button hu-button--primary"'),
    "Search must use primary button.",
  );
  assert(
    css.includes("civic-archive-page__filters-primary"),
    "Archive filters must use compact primary row.",
  );
  assert(
    css.includes("civic-archive-page__filters-row"),
    "Archive filters must use secondary row.",
  );
}

function verifyFormControlsAndButtons(): void {
  console.log("3. Form control border token and responsive buttons");

  const tokens = readRepoFile("apps/web/src/design-system/tokens.css");
  const components = readRepoFile("apps/web/src/design-system/components.css");

  assert(
    tokens.includes("--hu-control-border: #dadce0"),
    "Tokens must define --hu-control-border.",
  );
  assert(
    tokens.includes("--hu-border-default: var(--hu-control-border)"),
    "Default border alias must reference control border token.",
  );
  assert(
    components.includes("var(--hu-control-border)"),
    "Components must use control border token.",
  );
  assert(components.includes("width: fit-content"), "Buttons must size to content.");
  assert(components.includes("white-space: normal"), "Buttons must allow wrapped labels.");
  assert(components.includes(".hu-form-actions"), "Design system must define hu-form-actions.");
  assert(
    components.includes("border-color: var(--hu-color-primary)"),
    "Focus state must override neutral border.",
  );
  assert(
    components.includes("border-color: var(--hu-color-danger)"),
    "Error state must override neutral border.",
  );
}

async function verifyCanadaMedia(): Promise<void> {
  console.log("4. Canada local civic media resources");

  const canadaMedia = await listCountryTrustedMediaResources("CA");
  assertStrict.equal(canadaMedia.length, 6, "Canada must expose exactly six media resources.");

  for (const required of CANADA_MEDIA) {
    const record = TRUSTED_MEDIA_RESOURCES.find((resource) => resource.id === required.id);
    assertStrict.ok(record, `Missing trusted media record: ${required.id}`);
    assertStrict.equal(record.countryCode, "CA", `${required.id} must use countryCode CA.`);
    assertStrict.equal(
      record.logoUrl,
      `/images/media/canada/${required.logo}`,
      `${required.id} must use approved logo path.`,
    );
    assertStrict.equal(
      record.websiteUrl,
      required.url,
      `${required.id} must use official website URL.`,
    );
    assert(
      fileExists(`apps/web/public/images/media/canada/${required.logo}`),
      `Missing Canada logo asset: ${required.logo}`,
    );
  }

  const countryPage = readRepoFile(
    "apps/web/src/features/country-experience/components/CountryExperienceDynamicPage.tsx",
  );
  assert(countryPage.includes("MediaLogo"), "Country media cards must render MediaLogo.");
  assert(
    countryPage.includes('rel="noopener noreferrer"'),
    "Country media external links must be safe.",
  );
}

function verifyCivicMediaCenterPolish(): void {
  console.log("5. Civic Media Center card normalization");

  const page = readRepoFile(
    "apps/web/src/features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
  );
  const css = readRepoFile(
    "apps/web/src/features/civic-media-center/components/civic-media-resource-cards.css",
  );

  assert(
    page.includes("HuxDirectoryShell") || page.includes("TrustedMediaCategoryTabs"),
    "Trusted media sections must use HUX directory experience.",
  );
  assert(page.includes('layout="four-two-one"'), "Trusted media rails must use four/two/one layout.");
  assert(
    page.includes("civic-media-resource-card__body"),
    "Resource cards must use clamped body copy.",
  );
  assert(css.includes("height: 100%"), "Resource cards must stretch to equal height.");
  assert(css.includes("-webkit-line-clamp: 3"), "Resource card body must clamp long copy.");
  assert(css.includes("margin-top: auto"), "Card actions must anchor to card bottom.");
}

function verifyDocumentation(): void {
  console.log("6. Documentation");

  const countryDoc = readRepoFile("docs/COUNTRY_EXPERIENCE.md");
  const archiveDoc = readRepoFile("docs/CIVIC_ARCHIVE.md");
  const mediaDoc = readRepoFile("docs/CIVIC_MEDIA_CENTER.md");
  const designDoc = readRepoFile("docs/DESIGN_SYSTEM.md");

  assert(countryDoc.includes("nine"), "Country documentation must describe nine statistics.");
  assert(countryDoc.includes("Participants"), "Country documentation must use Participants label.");
  assert(
    countryDoc.includes("Cities / Communities"),
    "Country documentation must describe Cities / Communities.",
  );
  assert(
    archiveDoc.includes("GeographySearchSelect"),
    "Archive documentation must describe dropdown selectors.",
  );
  assert(
    !archiveDoc.includes("GeographyMultiSelect"),
    "Archive documentation must not reference checkbox lists.",
  );
  assert(mediaDoc.includes("category frame"), "Media documentation must describe category frame.");
  assert(mediaDoc.includes("equal"), "Media documentation must describe equal card sizing.");
  assert(
    designDoc.includes("--hu-control-border"),
    "Design system docs must document control border token.",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:statistics-archive-media-polish pass ${pass} ===`);
  verifyStatisticsConfig();
  verifyCivicArchiveFilters();
  verifyFormControlsAndButtons();
  await verifyCanadaMedia();
  verifyCivicMediaCenterPolish();
  verifyDocumentation();
  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log(
    `\nverify:statistics-archive-media-polish PASSED (${PASS_COUNT} consecutive passes).`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
