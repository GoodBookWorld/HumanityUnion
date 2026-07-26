/**
 * TASK-106 — Home collections, resource visuals, and IP geography verification.
 * Run: npm run verify:home-collections-ip-geography
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { runVerificationScript } from "./verification-script-lifecycle.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

dotenv.config({ path: path.join(REPO_ROOT, "apps/api/.env") });
dotenv.config({ path: path.join(REPO_ROOT, ".env") });

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifySharedCollection(): void {
  console.log("1. Shared horizontal collection");

  const collection = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeHorizontalCollection.tsx",
  );
  const css = readRepoFile("apps/web/src/features/public-home-v2/public-home-carousel.css");

  assert(
    collection.includes("export function PublicHomeHorizontalCollection"),
    "Shared PublicHomeHorizontalCollection must exist.",
  );
  assert(collection.includes("Previous"), "Collection must expose Previous control.");
  assert(collection.includes("Next"), "Collection must expose Next control.");
  assert(collection.includes("public-home-carousel__dot"), "Collection must expose progress dots.");
  assert(css.includes("overflow-x: auto"), "Collection must support horizontal scrolling.");
  assert(css.includes("fade-end"), "Collection must expose edge fade affordance.");
  assert(collection.includes("prefers-reduced-motion"), "Collection must respect reduced motion.");
  assert(!collection.includes("autoplay"), "Collection must not autoplay.");
}

function verifyInitiativesSection(): void {
  console.log("2. Latest Civic Initiatives");

  const section = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeLatestInitiativesSection.tsx",
  );
  const constants = readRepoFile("apps/web/src/features/public-home-v2/constants.ts");

  assert(
    constants.includes("Explore initiatives addressing challenges of global significance"),
    "Initiatives subtitle must describe global significance.",
  );
  assert(
    constants.includes("Use the map or Search to discover civic activity"),
    "Initiatives subtitle must guide map/Search discovery.",
  );
  assert(
    section.includes("PublicHomeHorizontalCollection"),
    "Initiatives must use shared collection.",
  );
  assert(
    section.includes("HOME_INITIATIVE_PLACEHOLDER_MAX"),
    "Initiatives must cap UI placeholders.",
  );
  assert(
    constants.includes("HOME_INITIATIVE_PLACEHOLDER_MAX = 2"),
    "Initiatives placeholders max 2.",
  );
  assert(section.includes("View All Initiatives"), "Initiatives must include View All action.");
  assert(
    !section.includes("public-initiative-mini-card-window__viewport"),
    "Initiatives must not use vertical scroll window.",
  );
}

function verifyPublicImpactSection(): void {
  console.log("3. Latest Public Impact");

  const section = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeLatestPublicImpactSection.tsx",
  );
  const constants = readRepoFile("apps/web/src/features/public-home-v2/constants.ts");

  assert(
    !section.includes("No public impact records are available yet."),
    "Public impact must not show negative empty warning.",
  );
  assert(
    constants.includes(
      "Documented outcomes, implementation progress, and measurable civic results.",
    ),
    "Public impact subtitle must match briefing.",
  );
  assert(
    section.includes("PublicImpactPlaceholderCard"),
    "Public impact must support UI placeholders.",
  );
  assert(
    section.includes("PublicHomeHorizontalCollection"),
    "Public impact must use shared collection.",
  );
}

function verifyKnowledgeSection(): void {
  console.log("4. Knowledge collection");

  const section = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeKnowledgeSection.tsx",
  );
  const collection = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeKnowledgeCollection.tsx",
  );
  const constants = readRepoFile("apps/web/src/features/public-home-v2/constants.ts");
  const css = readRepoFile("apps/web/src/features/public-home-v2/public-home-v2.css");

  assert(collection.includes('layout="four-three-one"'), "Knowledge must use 4/3/1 layout.");
  assert(
    constants.includes("PUBLIC_HOME_KNOWLEDGE_MUTED_TONES"),
    "Knowledge must define muted tones.",
  );
  assert(
    css.includes("public-home-v2__knowledge-card--pale-blue"),
    "Knowledge cards must use muted palette.",
  );
  assert(section.includes("Explore Knowledge"), "Knowledge must include Explore Knowledge action.");
  assert(!section.includes("public-home-v2__card-grid"), "Knowledge must not use static grid.");
}

function verifyResourceSections(): void {
  console.log("5. Civic Media and Civic Archive visuals");

  const media = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeCivicMediaSection.tsx",
  );
  const archive = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeCivicArchiveSection.tsx",
  );
  const css = readRepoFile("apps/web/src/features/public-home-v2/public-home-v2.css");

  assert(
    media.includes("/images/media/all-media.webp"),
    "Civic Media must use exact background asset.",
  );
  assert(
    archive.includes("/images/media/all-archives.webp"),
    "Civic Archive must use exact background asset.",
  );
  assert(
    css.includes("--public-home-resource-image-opacity"),
    "Resource opacity token must exist.",
  );
  assert(
    css.includes("pointer-events: none"),
    "Decorative backgrounds must ignore pointer events.",
  );
  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/public/images/media/all-media.webp")),
    "Civic Media asset must exist.",
  );
  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/public/images/media/all-archives.webp")),
    "Civic Archive asset must exist.",
  );
}

function verifyIpGeography(): void {
  console.log("6. Approximate IP geographic navigator");

  const geoSection = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeGeographicNavigationSection.tsx",
  );
  const navigator = readRepoFile(
    "apps/web/src/features/public-home-v2/components/ApproximateIpGeographicNavigator.tsx",
  );
  const resolver = readRepoFile(
    "apps/api/src/modules/ip-geography/resolve-approximate-ip-geography.ts",
  );
  const routes = readRepoFile("apps/api/src/modules/ip-geography/ip-geography.routes.ts");
  const docs = readRepoFile("docs/IP_GEOLOCATION_OPERATIONS.md");

  assert(
    geoSection.includes("ApproximateIpGeographicNavigator"),
    "Home geo section must use approximate IP navigator.",
  );
  assert(
    !geoSection.includes('from "../../global-experience/components/GeographicNavigator"'),
    "Home must not use demo GeographicNavigator defaults.",
  );
  assert(navigator.includes("Approximate location"), "Navigator must show approximate label.");
  assert(
    navigator.includes("fetchApproximateIpGeography"),
    "Navigator must fetch server IP geography.",
  );
  assert(
    !navigator.includes("Participation Area"),
    "Navigator must not reference Participation Area.",
  );
  assert(resolver.includes("resolveApproximateIpGeography"), "Resolver module must exist.");
  assert(
    routes.includes('Cache-Control", "private, no-store"'),
    "IP geography endpoint must disable shared caching.",
  );
  assert(routes.includes("/approximate"), "IP geography route must exist.");
  assert(docs.includes("no-store"), "Operations doc must describe cache isolation.");
}

async function verifyIpGeographyRuntime(): Promise<void> {
  console.log("7. IP geography runtime");

  const { resolveApproximateIpGeography, resetApproximateIpGeographyForTests } =
    await import("../modules/ip-geography/resolve-approximate-ip-geography.js");

  resetApproximateIpGeographyForTests();

  const localResult = resolveApproximateIpGeography({
    ip: "127.0.0.1",
    headers: {},
  } as never);

  assert(localResult.source === "unavailable", "Local requests must fall back to unavailable.");

  process.env.IP_GEOLOCATION_DEV_FIXTURE = "CA::CA-BC::Nelson";
  const fixtureResult = resolveApproximateIpGeography({
    ip: "8.8.8.8",
    headers: { "cf-ipcountry": "US" },
  } as never);

  assert(fixtureResult.countryCode === "CA", "Dev fixture must override hosting headers.");
  assert(fixtureResult.cityName === "Nelson", "Dev fixture must include city when provided.");

  delete process.env.IP_GEOLOCATION_DEV_FIXTURE;

  const headerResult = resolveApproximateIpGeography({
    ip: "8.8.8.8",
    headers: {
      "cf-ipcountry": "CA",
      "cf-region-code": "BC",
      "cf-ipcity": "Vancouver",
    },
  } as never);

  assert(headerResult.source === "hosting_header", "Hosting headers must resolve geography.");
  assert(headerResult.countryCode === "CA", "Hosting country header must normalize to CA.");
  assert(headerResult.cityName === "Vancouver", "Hosting city header must pass through.");
}

function verifyPageRhythm(): void {
  console.log("8. Page rhythm and opportunity cards");

  const css = readRepoFile("apps/web/src/features/public-home-v2/public-home-v2.css");
  const opportunities = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeOpportunitySection.tsx",
  );

  assert(css.includes("overflow-x: clip"), "Home page must prevent horizontal overflow.");
  assert(
    !opportunities.includes("card--highlight"),
    "Opportunity cards must not use permanent highlight styling.",
  );
}

async function main(): Promise<void> {
  verifySharedCollection();
  verifyInitiativesSection();
  verifyPublicImpactSection();
  verifyKnowledgeSection();
  verifyResourceSections();
  verifyIpGeography();
  await verifyIpGeographyRuntime();
  verifyPageRhythm();
  console.log("\nTASK-106 verify:home-collections-ip-geography PASS");
}

void runVerificationScript(main);
