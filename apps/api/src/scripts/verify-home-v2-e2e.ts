/**
 * TASK-067 — Public Home Experience v2 verification.
 * Run: npm run verify:home-v2
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const HOME_V2_DIR = path.join(REPO_ROOT, "apps/web/src/features/public-home-v2");

const HERO_HEADLINE = "Bringing people together to create positive change.";
const HERO_SUBHEADLINE =
  "A civic platform that empowers people with practical tools for social growth, justice, security, and progress.";

const CORE_VALUES = ["Responsibility", "Justice", "Security", "Progress"] as const;

const OPPORTUNITY_TITLES = [
  "Improve your community",
  "Build solutions together",
  "Turn public concerns into action",
  "Preserve experience for future generations",
] as const;

const PIPELINE_STEPS = [
  "Problem",
  "Initiative",
  "Analysis",
  "Proposal",
  "Decision",
  "Implementation",
  "Impact",
  "Archive",
] as const;

const FORBIDDEN_HOME_TERMS = [
  "Join Now",
  "Revolutionary",
  "Amazing",
  "Best platform",
  "news feed",
  "popularity ranking",
  "testimonial",
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function readHomeV2Sources(): string {
  const files = fs
    .readdirSync(HOME_V2_DIR, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".ts"))
    .map((entry) => fs.readFileSync(path.join(HOME_V2_DIR, entry), "utf-8"));

  return files.join("\n");
}

function verifyHeroAndValues(): void {
  console.log("1. Hero and core values");

  const constants = readRepoFile("apps/web/src/features/public-home-v2/constants.ts");
  assert(constants.includes(HERO_HEADLINE), "Hero headline must match briefing");
  assert(constants.includes(HERO_SUBHEADLINE), "Hero subheadline must match briefing");

  for (const value of CORE_VALUES) {
    assert(constants.includes(value), `Core value missing: ${value}`);
  }

  const hero = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeHeroSection.tsx",
  );
  assert(
    hero.includes("PUBLIC_HOME_HERO") || hero.includes("Create Initiative"),
    "Hero must include Create Initiative CTA",
  );
  assert(
    hero.includes("PublicHomeCreateInitiativeCta") ||
      readRepoFile(
        "apps/web/src/features/public-home-v2/components/PublicHomeCreateInitiativeCta.tsx",
      ).includes("useClientAuthStatus"),
    "Hero Create Initiative CTA must be auth-aware",
  );
  assert(
    hero.includes("Explore Knowledge") || constants.includes("Explore Knowledge"),
    "Hero must include Explore Knowledge CTA",
  );
}

function verifyNoPlatformNameRepetition(): void {
  console.log("2. No repeated platform name in section headings");

  const sectionFiles = fs
    .readdirSync(path.join(HOME_V2_DIR, "components"))
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => readRepoFile(`apps/web/src/features/public-home-v2/components/${file}`));

  for (const source of sectionFiles) {
    const headings = source.match(/<h[23][^>]*>[^<]+<\/h[23]>/g) ?? [];

    for (const heading of headings) {
      assert(
        !heading.includes("Humanity Union"),
        `Section heading must not repeat platform name: ${heading}`,
      );
    }
  }
}

function verifyHomeSections(): void {
  console.log("3. Home sections and opportunity cards");

  const page = readRepoFile("apps/web/src/features/public-home-v2/components/PublicHomeV2Page.tsx");
  const sources = readHomeV2Sources();

  const heroIndex = page.indexOf("<PublicHomeHeroSection");
  const statsIndex = page.indexOf("<HumanityUnionInNumbers");
  const valuesIndex = page.indexOf("<PublicHomeCoreValuesSection");

  assert(heroIndex >= 0 && statsIndex > heroIndex, "Statistics widget must appear after Hero");
  assert(
    statsIndex >= 0 && valuesIndex > statsIndex,
    "Statistics widget must appear before Core Values",
  );

  for (const component of [
    "PublicHomeHeroSection",
    "HumanityUnionInNumbers",
    "PublicHomeCoreValuesSection",
    "PublicHomeOpportunitySection",
    "PublicHomeCivicPipelineSection",
    "PublicHomeLatestInitiativesSection",
    "PublicHomeLatestPublicImpactSection",
    "PublicHomeKnowledgeSection",
    "PublicHomeCivicMediaSection",
    "PublicHomeCivicArchiveSection",
    "PublicHomeEcosystemStatementSection",
    "PublicHomeGeographicNavigationSection",
  ]) {
    assert(page.includes(component), `Public home page must render ${component}`);
  }

  for (const title of OPPORTUNITY_TITLES) {
    assert(sources.includes(title), `Opportunity card missing: ${title}`);
  }
}

function verifyCivicPipelineWidget(): void {
  console.log("4. Civic pipeline widget");

  const pipeline = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeCivicPipelineSection.tsx",
  );
  const constants = readRepoFile("apps/web/src/features/public-home-v2/constants.ts");
  const pipelineSource = `${pipeline}\n${constants}`;

  for (const step of PIPELINE_STEPS) {
    assert(pipelineSource.includes(step), `Pipeline step missing: ${step}`);
  }

  assert(pipeline.includes("<h3>"), "Pipeline must use HTML text headings");
  assert(!pipeline.includes("<img"), "Pipeline must not embed text in images");
}

function verifyLatestInitiativesWindow(): void {
  console.log("5. Latest initiatives window and public impact carousel");

  const carousel = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeHorizontalCollection.tsx",
  );
  const initiatives = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeLatestInitiativesSection.tsx",
  );
  const impact = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeLatestPublicImpactSection.tsx",
  );
  const api = readRepoFile("apps/web/src/features/public-home-v2/api.ts");
  const miniCard = readRepoFile(
    "apps/web/src/features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx",
  );

  assert(
    carousel.includes('aria-roledescription="carousel"'),
    "Carousel must expose carousel role",
  );
  assert(carousel.includes("aria-label"), "Carousel controls must include aria labels");
  assert(carousel.includes("768px"), "Carousel must support mobile single-card behavior");
  assert(carousel.includes("visibleCount"), "Carousel must support multi-card desktop behavior");

  assert(
    initiatives.includes("fetchHomeLatestInitiatives"),
    "Initiatives must use world initiatives API",
  );
  assert(initiatives.includes("PublicInitiativeMiniCard"), "Initiatives must use shared mini card");
  assert(
    initiatives.includes("PublicInitiativeMiniCardPlaceholder"),
    "Initiatives must render UI-only placeholder slots",
  );
  assert(
    initiatives.includes("HOME_LATEST_INITIATIVES_SLOT_COUNT"),
    "Initiatives window must cap at 18 slots",
  );
  assert(
    initiatives.includes("PublicHomeHorizontalCollection") ||
      initiatives.includes("PublicHomeCarousel"),
    "Initiatives must use shared horizontal collection",
  );
  assert(
    initiatives.includes("View All Initiatives"),
    "Initiatives section must include View All action",
  );
  assert(
    api.includes("fetchWorldInitiativesProjection"),
    "Home data must use world initiatives projection endpoint",
  );
  assert(
    miniCard.includes("/initiatives/public/"),
    "Mini card must link to public initiative route",
  );
  assert(
    impact.includes("fetchLatestPublicImpactRecords"),
    "Public impact must use public search API",
  );
  assert(impact.includes("Explore →"), "Impact cards must include Explore action");
  assert(!initiatives.includes("bootstrap"), "Initiatives window must not use bootstrap fake data");
}

function verifyKnowledgeMediaArchiveSections(): void {
  console.log("6. Knowledge, Civic Media, and Civic Archive sections");

  const knowledge = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeKnowledgeSection.tsx",
  );
  const constants = readRepoFile("apps/web/src/features/public-home-v2/constants.ts");
  const knowledgeSource = `${knowledge}\n${constants}`;
  const media = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeCivicMediaSection.tsx",
  );
  const archive = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeCivicArchiveSection.tsx",
  );

  for (const entry of ["Explanations", "Guides", "Constitution", "Civic Media", "Glossary"]) {
    assert(knowledgeSource.includes(entry), `Knowledge section missing entry: ${entry}`);
  }

  assert(knowledge.includes("Explore Knowledge"), "Knowledge section must include CTA");
  assert(media.includes("Explore Civic Media"), "Civic Media section must include CTA");
  assert(
    media.includes("Understand the news. Verify the facts. Turn public issues into civic action."),
    "Civic Media copy must match briefing",
  );
  assert(archive.includes("Explore Civic Archive"), "Civic Archive section must include CTA");
}

function verifyEcosystemAndMapPlaceholder(): void {
  console.log("7. Ecosystem statement and geographic navigation");

  const ecosystem = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeEcosystemStatementSection.tsx",
  );
  const geoSection = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeGeographicNavigationSection.tsx",
  );
  const map = readRepoFile("apps/web/src/features/world-map/components/InteractiveWorldMap.tsx");
  const constants = readRepoFile("apps/web/src/features/public-home-v2/constants.ts");
  const ecosystemSource = `${ecosystem}\n${constants}`;

  assert(
    ecosystemSource.includes(
      "You have entered a civic space where people who share your commitment work together",
    ),
    "Final civic ecosystem statement required",
  );
  assert(
    ecosystemSource.includes(
      "Every meaningful change begins with people who choose to act responsibly.",
    ),
    "Supporting ecosystem line required",
  );
  assert(
    ecosystem.includes("Explore the World") || constants.includes("Explore the World"),
    "Explore the World CTA required",
  );
  assert(
    geoSection.includes("ApproximateIpGeographicNavigator") ||
      geoSection.includes("GeographicNavigator"),
    "Home geographic navigation must include navigator",
  );
  assert(
    map.includes("interactive-world-map-boundary"),
    "Home must include replaceable world map boundary",
  );
  assert(
    map.includes("/countries/") || map.includes("/search?country="),
    "World map boundary must navigate to country discovery",
  );
}

function verifyAccessibilityAndLayout(): void {
  console.log("8. Accessibility and layout integration");

  const globalPage = readRepoFile(
    "apps/web/src/features/global-experience/components/GlobalExperiencePage.tsx",
  );
  const layout = readRepoFile("apps/web/src/design-system/components/HumanityLayout.tsx");
  const header = readRepoFile("apps/web/src/design-system/components/HumanityHeader.tsx");
  const nav = readRepoFile("apps/web/src/features/public-experience/constants.ts");

  assert(layout.includes('id="main-content"'), "Layout must preserve main content landmark");
  assert(layout.includes("hu-skip-link"), "Layout must provide global skip link");
  assert(globalPage.includes("<main"), "Home must preserve semantic main landmark");
  assert(globalPage.includes("PublicHomeV2Page"), "Global experience home must render v2 page");
  assert(
    readRepoFile("apps/web/src/design-system/layout.css").includes(".humanity-header"),
    "Sticky header styles must remain",
  );
  assert(nav.includes('href: "/"'), "Header navigation must include Home");
  assert(nav.includes('href: "/knowledge"'), "Header navigation must include Knowledge");
  assert(nav.includes('href: "/media"'), "Header navigation must include Civic Media");
  assert(nav.includes('href: "/search"'), "Header navigation must include Search");
  assert(header.includes("HeaderAuthUtility"), "Header must include Workspace/Login auth link");
}

function verifyForbiddenFeatures(): void {
  console.log("9. Forbidden marketing and fake-data patterns");

  const sources = readHomeV2Sources();

  for (const term of FORBIDDEN_HOME_TERMS) {
    assert(!sources.includes(term), `Home v2 must not include forbidden term: ${term}`);
  }

  assert(
    !sources.includes("WORLD_LATEST_INITIATIVES_PUBLIC_PROJECTION"),
    "Home must not import bootstrap initiatives",
  );
}

function main(): void {
  verifyHeroAndValues();
  verifyNoPlatformNameRepetition();
  verifyHomeSections();
  verifyCivicPipelineWidget();
  verifyLatestInitiativesWindow();
  verifyKnowledgeMediaArchiveSections();
  verifyEcosystemAndMapPlaceholder();
  verifyAccessibilityAndLayout();
  verifyForbiddenFeatures();
  console.log("verify:home-v2 passed.");
}

main();
