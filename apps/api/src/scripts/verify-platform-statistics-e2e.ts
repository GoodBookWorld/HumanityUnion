/**
 * TASK-078 — Platform statistics verification.
 * Run: npm run verify:platform-statistics
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Member } from "@hu/types";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const REQUIRED_COUNT_KEYS = [
  "users",
  "activeMembers",
  "countries",
  "regions",
  "authors",
  "initiatives",
  "proposals",
  "collectiveDecisions",
  "civicActionPackages",
  "officialResponses",
  "civicArchive",
] as const;

const ICON_FILES = [
  "member-check.svg",
  "members.svg",
  "countries.svg",
  "regions.svg",
  "city.svg",
  "initiatives.svg",
  "collective-decisions.svg",
  "packages.svg",
  "responses.svg",
  "archive.svg",
] as const;

const PRIVATE_FIELD_KEYS = [
  "participantId",
  "authorId",
  "memberId",
  "email",
  "stewardId",
  "userId",
  "profileId",
  "voteHistory",
  "session",
];

const FORBIDDEN_TERMS = [
  "leaderboard",
  "popularity",
  "animated-counter",
  "confetti",
  "pageView",
  "likeCount",
];

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

function verifyModuleStructure(): void {
  console.log("1. Module structure and route registration");

  const requiredFiles = [
    "apps/api/src/modules/platform-statistics/platform-statistics.types.ts",
    "apps/api/src/modules/platform-statistics/platform-statistics.service.ts",
    "apps/api/src/modules/platform-statistics/platform-statistics.routes.ts",
    "apps/api/src/modules/platform-statistics/platform-statistics.cache.ts",
    "apps/api/src/modules/platform-statistics/index.ts",
    "packages/types/src/domain/platform-statistics.ts",
    "docs/PLATFORM_STATISTICS_FOUNDATION.md",
  ];

  for (const relativePath of requiredFiles) {
    assert(fileExists(relativePath), `Missing required file: ${relativePath}`);
  }

  const appSource = readRepoFile("apps/api/src/app.ts");
  assert(
    appSource.includes("platformStatisticsRouter"),
    "app.ts must register platformStatisticsRouter",
  );
  assert(
    appSource.includes('app.use("/api/v1/public", platformStatisticsRouter)'),
    "Platform statistics must mount under /api/v1/public",
  );

  const routes = readRepoFile(
    "apps/api/src/modules/platform-statistics/platform-statistics.routes.ts",
  );
  assert(routes.includes('"/platform-statistics"'), "Router must expose /platform-statistics");
  assert(!routes.includes("requireAuth"), "Public statistics route must not require auth");
}

function verifyIcons(): void {
  console.log("2. Local workspace icon assets");

  for (const iconFile of ICON_FILES) {
    assert(
      fileExists(`apps/web/src/assets/icons/workspace/${iconFile}`),
      `Source icon must exist: ${iconFile}`,
    );
    assert(
      fileExists(`apps/web/public/icons/workspace/${iconFile}`),
      `Public icon must exist: ${iconFile}`,
    );
  }
}

function verifyFrontendIntegration(): void {
  console.log("3. Home widget integration");

  const page = readRepoFile("apps/web/src/features/public-home-v2/components/PublicHomeV2Page.tsx");
  const widget = readRepoFile(
    "apps/web/src/features/platform-statistics/components/HumanityUnionInNumbers.tsx",
  );
  const config = readRepoFile(
    "apps/web/src/features/platform-statistics/public-statistics-config.ts",
  );
  const api = readRepoFile("apps/web/src/features/platform-statistics/platform-statistics-api.ts");

  const heroIndex = page.indexOf("<PublicHomeHeroSection");
  const statsIndex = page.indexOf("<HumanityUnionInNumbers");
  const valuesIndex = page.indexOf("<PublicHomeCoreValuesSection");

  assert(heroIndex >= 0 && statsIndex > heroIndex, "Statistics widget must appear after Hero");
  assert(
    statsIndex >= 0 && valuesIndex > statsIndex,
    "Statistics widget must appear before Core Values",
  );

  assert(widget.includes("Humanity Union in Numbers"), "Widget title must match briefing");
  assert(widget.includes("fetchPlatformStatistics"), "Widget must fetch public statistics");
  assert(
    widget.includes("Platform statistics are temporarily unavailable."),
    "Widget must show calm error state",
  );
  assert(
    widget.includes("PublicStatisticsGrid"),
    "Widget must delegate rendering to PublicStatisticsGrid.",
  );
  assert(
    readRepoFile(
      "apps/web/src/features/platform-statistics/components/PublicStatisticsGrid.tsx",
    ).includes("platform-statistics__card--loading"),
    "Statistics grid must include loading skeleton cards",
  );
  assert(!widget.includes("useCountUp"), "Widget must not use animated counters");
  assert(
    api.includes("/api/v1/public/platform-statistics"),
    "Web client must call public statistics endpoint",
  );

  assert(widget.includes("PublicStatisticsGrid"), "Widget must use shared statistics grid.");
  assert(config.includes('label: "Participants"'), "Public statistics UI must label Participants.");

  for (const iconFile of ICON_FILES) {
    assert(
      config.includes(`/icons/workspace/${iconFile}`),
      `Statistics config must reference icon ${iconFile}`,
    );
  }
}

function verifyNoForbiddenPatterns(): void {
  console.log("4. Privacy and exclusion scan");

  const moduleSources = [
    readRepoFile("apps/api/src/modules/platform-statistics/platform-statistics.service.ts"),
    readRepoFile("apps/api/src/modules/platform-statistics/platform-statistics.routes.ts"),
    readRepoFile("apps/web/src/features/platform-statistics/components/HumanityUnionInNumbers.tsx"),
  ].join("\n");

  for (const term of FORBIDDEN_TERMS) {
    assert(!moduleSources.includes(term), `Forbidden term found: ${term}`);
  }
}

function createMember(id: string, country: string, region: string): Member {
  return {
    id,
    profile: {
      displayName: `Member ${id}`,
      uniqueName: id.replace("member-", ""),
      languages: ["en"],
      country,
      region,
    },
    status: "active",
    verificationLevel: "email",
    roles: ["member"],
    fair: { personal: 0, community: 0, regional: 0, global: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function verifyServiceMetrics(): Promise<void> {
  console.log("5. Service metrics and privacy");

  const { seedMember } = await import("../modules/member/member.store.js");
  const { createParticipationArea } =
    await import("../modules/participation-area/participation-area.store.js");
  const { clearPlatformStatisticsCache, getPlatformStatisticsPayload } =
    await import("../modules/platform-statistics/index.js");
  const { PLATFORM_STATISTICS_CACHE_TTL_MS } =
    await import("../modules/platform-statistics/platform-statistics.types.js");

  clearPlatformStatisticsCache();

  seedMember(createMember("member-stats-a", "Canada", "British Columbia"));
  seedMember(createMember("member-stats-b", "Canada", "Ontario"));

  createParticipationArea({
    participantId: "member-stats-a",
    countrySlug: "canada",
    regionSlug: "british-columbia",
    verificationStatus: "verified",
  });

  createParticipationArea({
    participantId: "member-stats-b",
    countrySlug: "canada",
    regionSlug: "ontario",
    verificationStatus: "verified",
  });

  const firstPayload = await getPlatformStatisticsPayload();

  for (const key of REQUIRED_COUNT_KEYS) {
    assert(key in firstPayload.data, `Missing count field: ${key}`);
    assert(
      Number.isInteger(firstPayload.data[key]) && firstPayload.data[key] >= 0,
      `${key} must be a non-negative integer`,
    );
  }

  assert(firstPayload.meta.activeMemberWindowDays === 90, "Active member window must be 90 days");
  assert(Boolean(firstPayload.meta.generatedAt), "Payload must include generatedAt");
  assert(
    firstPayload.data.users >= 2,
    "Users count must include seeded members when auth store is unavailable",
  );
  assert(firstPayload.data.countries >= 1, "Countries must reflect participation areas");
  assert(firstPayload.data.regions >= 2, "Regions must use country + region identity");

  const serialized = JSON.stringify(firstPayload).toLowerCase();
  for (const key of PRIVATE_FIELD_KEYS) {
    assert(!serialized.includes(`"${key.toLowerCase()}"`), `Payload leaked private field: ${key}`);
  }

  const secondPayload = await getPlatformStatisticsPayload();
  assert(
    secondPayload.meta.generatedAt === firstPayload.meta.generatedAt,
    "Cache must reuse payload within TTL",
  );

  clearPlatformStatisticsCache();
  const thirdPayload = await getPlatformStatisticsPayload();
  assert(
    thirdPayload.meta.generatedAt !== firstPayload.meta.generatedAt ||
      Date.parse(thirdPayload.meta.generatedAt) >= Date.parse(firstPayload.meta.generatedAt),
    "Cache rebuild must produce a fresh payload after clear",
  );

  assert(PLATFORM_STATISTICS_CACHE_TTL_MS === 60_000, "Cache TTL must be 60 seconds");
}

function verifyDocumentation(): void {
  console.log("6. Documentation");

  const doc = readRepoFile("docs/PLATFORM_STATISTICS_FOUNDATION.md");

  assert(doc.includes("Active Members"), "Documentation must define Active Members");
  assert(doc.includes("90"), "Documentation must describe 90-day window");
  assert(
    doc.includes("Users vs Active Members"),
    "Documentation must distinguish Users and Active Members",
  );
  assert(doc.includes("privacy"), "Documentation must describe privacy boundaries");
  assert(doc.includes("60 seconds"), "Documentation must describe cache TTL");
  assert(doc.includes("Mongo"), "Documentation must mention future Mongo aggregation");
}

async function main(): Promise<void> {
  verifyModuleStructure();
  verifyIcons();
  verifyFrontendIntegration();
  verifyNoForbiddenPatterns();
  await verifyServiceMetrics();
  verifyDocumentation();

  console.log("\nTASK-078 verify:platform-statistics PASS");
}

const { runVerificationScript } = await import("./verification-script-lifecycle.js");
void runVerificationScript(main);
