/**
 * TASK-068 — Public Home Experience polish verification.
 * Run: npm run verify:home-polish
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

const RESPONSIVE_BREAKPOINTS = ["1024px", "768px", "390px"] as const;

const FORBIDDEN_LIBS = ["swiper", "framer-motion", "react-slick", "embla-carousel"] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function readHomeSources(): string {
  const files = fs
    .readdirSync(HOME_V2_DIR, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && /\.(tsx|css|ts)$/.test(entry))
    .map((entry) => fs.readFileSync(path.join(HOME_V2_DIR, entry), "utf-8"));

  return files.join("\n");
}

function verifyCopyUnchanged(): void {
  console.log("1. Agreed copy unchanged");

  const constants = readRepoFile("apps/web/src/features/public-home-v2/constants.ts");
  assert(constants.includes(HERO_HEADLINE), "Hero headline must remain unchanged");
  assert(constants.includes(HERO_SUBHEADLINE), "Hero subheadline must remain unchanged");
  assert(
    constants.includes(
      "You have entered a civic space where people who share your commitment work together",
    ),
    "Ecosystem statement must remain unchanged",
  );
  assert(
    constants.includes("Every meaningful change begins with people who choose to act responsibly."),
    "Supporting ecosystem line must remain unchanged",
  );

  for (const step of PIPELINE_STEPS) {
    assert(constants.includes(step), `Pipeline stage must remain unchanged: ${step}`);
  }
}

function verifyPolishStyles(): void {
  console.log("2. Polish styles and design tokens");

  const css = readRepoFile("apps/web/src/features/public-home-v2/public-home-v2.css");

  assert(css.includes("var(--hu-"), "Home polish must use Humanity design tokens");
  assert(css.includes("prefers-reduced-motion"), "Home polish must support reduced motion");
  assert(
    css.includes("public-home-v2__card--interactive"),
    "Opportunity cards must have interactive polish",
  );
  assert(
    css.includes("public-home-v2__geographic-navigation") ||
      css.includes("interactive-world-map-boundary__frame"),
    "Home must reserve geographic navigation / map frame space",
  );
  assert(
    css.includes("public-home-v2__ecosystem"),
    "Ecosystem statement must have dedicated polish",
  );

  for (const breakpoint of RESPONSIVE_BREAKPOINTS) {
    assert(css.includes(breakpoint), `Responsive polish must cover ${breakpoint}`);
  }
}

function verifyPipelinePolish(): void {
  console.log("3. Civic pipeline layout polish");

  const pipeline = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeCivicPipelineSection.tsx",
  );
  const css = readRepoFile("apps/web/src/features/public-home-v2/public-home-v2.css");

  assert(pipeline.includes("aria-label={`Step"), "Pipeline steps must expose accessible labels");
  assert(
    pipeline.includes("pipeline-connector--horizontal"),
    "Pipeline must include horizontal connectors",
  );
  assert(
    pipeline.includes("pipeline-connector--vertical"),
    "Pipeline must include vertical connectors",
  );
  assert(!pipeline.includes("<img"), "Pipeline must not use image text");
  assert(!pipeline.includes("<svg"), "Pipeline must not use SVG text");
  assert(
    css.includes("grid-template-columns: repeat(4"),
    "Pipeline must use desktop stepped layout",
  );
}

function verifyCarouselPolish(): void {
  console.log("4. Carousel accessibility polish");

  const carousel = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeCarousel.tsx",
  );
  const css = readRepoFile("apps/web/src/features/public-home-v2/public-home-v2.css");

  assert(carousel.includes("ArrowLeft"), "Carousel must support keyboard previous navigation");
  assert(carousel.includes("ArrowRight"), "Carousel must support keyboard next navigation");
  assert(carousel.includes("aria-label"), "Carousel must include aria labels");
  assert(
    carousel.includes("focus-visible") || css.includes("focus-visible"),
    "Carousel must define visible focus",
  );
  assert(!carousel.includes("autoplay"), "Carousel must not autoplay");
  assert(!carousel.includes("setInterval"), "Carousel must not use timed rotation");

  for (const lib of FORBIDDEN_LIBS) {
    assert(!carousel.includes(lib), `Carousel must not use animation library: ${lib}`);
  }
}

function verifySectionLayoutPolish(): void {
  console.log("5. Knowledge, Civic Media, and Archive section polish");

  const sources = readHomeSources();

  assert(
    sources.includes("public-home-v2__section--resource"),
    "Resource sections must share layout class",
  );
  assert(
    sources.includes("public-home-v2__section-intro"),
    "Sections must use consistent intro layout",
  );
  assert(sources.includes("Explore Knowledge"), "Knowledge CTA must remain");
  assert(sources.includes("Explore Civic Media"), "Civic Media CTA must remain");
  assert(sources.includes("Explore Civic Archive"), "Civic Archive CTA must remain");
}

function verifyNoBackendOrFeatureCreep(): void {
  console.log("6. No backend changes or new features");

  const sources = readHomeSources();
  const apiDir = path.join(REPO_ROOT, "apps/api/src/modules");

  assert(!sources.includes("Institutions"), "Home polish must not add Institutions page");
  assert(
    sources.includes("Explore civic activity by place") ||
      sources.includes("interactive-world-map-boundary"),
    "Home must include geographic navigation or map boundary",
  );
  assert(!sources.includes("leaflet"), "Home polish must not implement live map");
  assert(!sources.includes("mapbox"), "Home polish must not implement live map");

  const newApiFiles = fs
    .readdirSync(apiDir, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.includes("public-home"));

  assert(newApiFiles.length === 0, "Home polish must not add new backend modules");
}

function verifyAccessibilityBasics(): void {
  console.log("7. Accessibility basics");

  const globalPage = readRepoFile(
    "apps/web/src/features/global-experience/components/GlobalExperiencePage.tsx",
  );
  const layout = readRepoFile("apps/web/src/design-system/components/HumanityLayout.tsx");
  const css = readRepoFile("apps/web/src/features/public-home-v2/public-home-v2.css");

  assert(layout.includes('id="main-content"'), "Layout must preserve main content landmark");
  assert(layout.includes("hu-skip-link"), "Layout must provide global skip link");
  assert(globalPage.includes("<main"), "Home must preserve semantic main landmark");
  assert(
    css.includes("public-home-v2__visually-hidden"),
    "Home must include visually hidden utility",
  );
  assert(css.includes("--hu-focus-ring"), "Home must use design system focus ring token");
}

function main(): void {
  verifyCopyUnchanged();
  verifyPolishStyles();
  verifyPipelinePolish();
  verifyCarouselPolish();
  verifySectionLayoutPolish();
  verifyNoBackendOrFeatureCreep();
  verifyAccessibilityBasics();
  console.log("verify:home-polish passed.");
}

main();
