import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  VOLUNTEER_ASSETS,
  VOLUNTEER_CREATE_INITIATIVE_HREF,
  VOLUNTEER_CREATE_INITIATIVE_ICON,
  VOLUNTEER_ROUTE,
} from "./volunteer.constants.js";
import { SUPPORT_LINK_FALLBACKS } from "../support/support.constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Volunteer public page", () => {
  it("exposes canonical /volunteer route with public container shell", () => {
    const page = read("app/volunteer/page.tsx");
    assert.match(page, /features\/volunteer\/components\/VolunteerPageContent/);
    assert.match(page, /hu-page-container/);
    assert.match(page, /hu-page-container--sectioned/);
    assert.equal(VOLUNTEER_ROUTE, "/volunteer");
  });

  it("renders hero and numbered major sections with i18n", () => {
    const content = read("features/volunteer/components/VolunteerPageContent.tsx");
    assert.match(content, /useTranslations\("volunteerPublic"\)/);
    assert.match(content, /t\("eyebrow"\)/);
    assert.match(content, /t\("title"\)/);
    assert.match(content, /t\("lead"\)/);
    assert.match(content, /volunteer-intro-heading/);
    assert.match(content, /volunteer-meaning-heading/);
    assert.match(content, /volunteer-take-part-heading/);
    assert.match(content, /t\("intro\.heading"\)/);
    assert.match(content, /t\("meaning\.heading"\)/);
    assert.match(content, /t\("takePart\.heading"\)/);
  });

  it("uses a desktop main column plus one shared sidebar for visual, actions, and CTA", () => {
    const content = read("features/volunteer/components/VolunteerPageContent.tsx");
    assert.match(content, /volunteer-page__body-main/);
    assert.match(content, /volunteer-page__sidebar/);
    assert.match(content, /ResizeObserver/);
    assert.match(content, /--volunteer-sidebar-height/);

    const sidebarBlock = content.slice(
      content.indexOf('className="volunteer-page__sidebar"'),
      content.indexOf("</aside>", content.indexOf('className="volunteer-page__sidebar"')),
    );
    const visualAt = sidebarBlock.indexOf("volunteer-page__visual-card");
    const actionsAt = sidebarBlock.indexOf("volunteer-page__actions-card");
    const ctaAt = sidebarBlock.indexOf("volunteer-page__section-aside--cta");
    assert.ok(visualAt >= 0 && actionsAt > visualAt && ctaAt > actionsAt);
    assert.doesNotMatch(
      content.slice(content.indexOf("volunteer-page__body-main"), content.indexOf("volunteer-page__sidebar")),
      /volunteer-page__visual-card|volunteer-page__actions-card|volunteer-page__section-aside--cta/,
    );
  });

  it("Create Initiative CTA links to canonical create route with workspace icon", () => {
    const content = read("features/volunteer/components/VolunteerPageContent.tsx");
    assert.equal(VOLUNTEER_CREATE_INITIATIVE_HREF, "/initiatives/create");
    assert.equal(VOLUNTEER_CREATE_INITIATIVE_ICON, "/icons/workspace/initiatives.svg");
    assert.match(content, /VOLUNTEER_CREATE_INITIATIVE_HREF/);
    assert.match(content, /VOLUNTEER_CREATE_INITIATIVE_ICON/);
    assert.match(content, /t\("createInitiativeCta"\)/);
    assert.ok(
      existsSync(path.join(webRoot, "public", VOLUNTEER_CREATE_INITIATIVE_ICON.replace(/^\//, ""))),
    );
  });

  it("required volunteer assets resolve under public/icons/volunteer", () => {
    for (const assetPath of Object.values(VOLUNTEER_ASSETS)) {
      const absolute = path.join(webRoot, "public", assetPath.replace(/^\//, ""));
      assert.ok(existsSync(absolute), `missing ${assetPath}`);
      assert.match(assetPath, /^\/icons\/volunteer\//);
    }
    assert.equal(VOLUNTEER_ASSETS.hero, "/icons/volunteer/top-volunteer.webp");
    assert.ok(
      existsSync(path.join(webRoot, "public/icons/volunteer/top-volunteer.webp")),
    );
    assert.doesNotMatch(Object.values(VOLUNTEER_ASSETS).join("\n"), /\.DS_Store/);
  });

  it("does not reference .DS_Store or unused leaf asset", () => {
    const content = read("features/volunteer/components/VolunteerPageContent.tsx");
    const constants = read("features/volunteer/volunteer.constants.ts");
    assert.doesNotMatch(content, /\.DS_Store|leaf\.png/);
    assert.doesNotMatch(constants, /\.DS_Store|leaf\.png/);
  });

  it("uses top-volunteer.webp as the full hero CSS background; no hero-art block", () => {
    const content = read("features/volunteer/components/VolunteerPageContent.tsx");
    const css = read("features/volunteer/volunteer-page.css");
    assert.doesNotMatch(content, /volunteer-page__hero-art|volunteer-page__hero-media|volunteer-page__hero-image/);
    assert.doesNotMatch(css, /volunteer-page__hero-art/);
    assert.match(
      css,
      /\.volunteer-page__hero[\s\S]*top-volunteer\.webp/,
    );
    assert.match(
      css,
      /@media \(min-width:\s*600px\)[\s\S]*background-size:\s*auto,\s*contain|@media \(min-width:\s*600px\)[\s\S]*background-size:\s*contain/,
    );
    assert.match(
      css,
      /@media \(max-width:\s*599px\)[\s\S]*\.volunteer-page__hero[\s\S]*background-image:\s*none/,
    );
  });

  it("does not use custom wheel / window.scrollBy handoff; keeps native overflow scrolling", () => {
    const content = read("features/volunteer/components/VolunteerPageContent.tsx");
    const css = read("features/volunteer/volunteer-page.css");
    assert.doesNotMatch(content, /addEventListener\("wheel"|window\.scrollBy|preventDefault|mainRef/);
    assert.match(css, /\.volunteer-page__body-main--synced[\s\S]*overflow-y:\s*auto/);
    assert.match(css, /\.volunteer-page__body-main--synced[\s\S]*overscroll-behavior-y:\s*auto/);
  });

  it("Create Initiative CTA centers icon+label as one cluster", () => {
    const content = read("features/volunteer/components/VolunteerPageContent.tsx");
    const css = read("features/volunteer/volunteer-page.css");
    assert.match(content, /volunteer-page__cta-cluster/);
    assert.match(css, /\.volunteer-page__cta-cluster[\s\S]*inline-flex/);
    assert.match(css, /\.volunteer-page__cta\.hu-button[\s\S]*justify-content:\s*center/);
    assert.match(css, /\.volunteer-page__cta-icon[\s\S]*width:\s*48px/);
  });

  it("honey-earth hover enlargement is tablet+ only and uses scale(2)", () => {
    const css = read("features/volunteer/volunteer-page.css");
    assert.match(css, /@media \(min-width:\s*768px\)[\s\S]*\.volunteer-page__visual-image:hover[\s\S]*transform:\s*scale\(2\)/);
    assert.match(css, /\.volunteer-page__visual-image[\s\S]*transform:\s*scale\(1\)/);
    assert.match(css, /\.volunteer-page__visual-image[\s\S]*transition:[\s\S]*transform/);
    assert.match(css, /@media \(max-width:\s*767px\)[\s\S]*\.volunteer-page__visual-image:hover[\s\S]*transform:\s*none/);
    assert.match(css, /\.volunteer-page__visual-card[\s\S]*overflow:\s*visible/);
  });

  it("Support Volunteer CTA defaults to /volunteer", () => {
    assert.equal(SUPPORT_LINK_FALLBACKS.volunteer, "/volunteer");
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /href=\{links\.volunteerUrl\}/);
    assert.match(content, /volunteer\.noteAvailable/);
  });

  it("Knowledge Subsections highlight Civic Media Center and Volunteering", () => {
    const sidebar = read("features/knowledge-center/components/KnowledgeSidebar.tsx");
    const css = read("features/knowledge-center/knowledge-center.css");
    assert.match(sidebar, /CIVIC_MEDIA_ROUTE/);
    assert.match(sidebar, /tNav\("civicMediaCenter"\)/);
    assert.match(sidebar, /href="\/volunteer"/);
    assert.match(sidebar, /tNav\("volunteering"\)/);
    assert.match(sidebar, /knowledge-center__nav-heading-link--accent/);
    assert.match(css, /\.knowledge-center__nav-heading-link--accent\s*\{[^}]*color:\s*#df9815/s);
    assert.match(
      css,
      /\.knowledge-center__nav-heading-link--accent:hover[\s\S]*color:\s*var\(--hu-color-primary\)/,
    );
  });

  it("HTML Sitemap includes /volunteer Volunteering entry", () => {
    const sitemap = read("features/public-experience/components/PublicSiteMapPage.tsx");
    assert.match(sitemap, /href:\s*"\/volunteer"/);
    assert.match(sitemap, /siteMapVolunteering/);
    assert.doesNotMatch(sitemap, /app\/sitemap\.ts|STATIC_PUBLIC_SITEMAP/);
  });

  it("desktop body uses 70/30 layout; hero values stay left ~60%; mobile restores full width", () => {
    const css = read("features/volunteer/volunteer-page.css");
    assert.match(css, /@media \(min-width:\s*900px\)/);
    assert.match(
      css,
      /\.volunteer-page__body[\s\S]*grid-template-columns:\s*minmax\(0,\s*7fr\)\s+minmax\(14rem,\s*3fr\)/,
    );
    assert.match(css, /\.volunteer-page__body-main--synced[\s\S]*max-height:\s*var\(--volunteer-sidebar-height\)/);
    assert.match(css, /@media \(max-width:\s*899px\)[\s\S]*max-height:\s*none/);
    assert.match(css, /@media \(max-width:\s*899px\)[\s\S]*overflow:\s*visible/);
    assert.match(
      css,
      /@media \(min-width:\s*600px\)[\s\S]*\.volunteer-page__hero-copy[\s\S]*width:\s*60%/,
    );
    assert.match(
      css,
      /@media \(max-width:\s*599px\)[\s\S]*\.volunteer-page__hero-copy[\s\S]*width:\s*100%/,
    );
  });
});

describe("Volunteer i18n catalogs", () => {
  it("volunteerPublic and volunteering nav keys exist in supported UI locales", () => {
    for (const locale of ["en", "uk", "ar", "zh-Hant"] as const) {
      const messages = JSON.parse(
        readFileSync(
          path.join(webSrc, `features/i18n/messages/${locale}.json`),
          "utf8",
        ),
      ) as {
        volunteerPublic: { title: string; createInitiativeCta: string };
        knowledgePublic: { nav: { volunteering: string; civicMediaCenter: string } };
        navigation: { siteMapVolunteering: string };
      };
      assert.equal(typeof messages.volunteerPublic.title, "string");
      assert.equal(typeof messages.volunteerPublic.createInitiativeCta, "string");
      assert.equal(typeof messages.knowledgePublic.nav.volunteering, "string");
      assert.equal(typeof messages.knowledgePublic.nav.civicMediaCenter, "string");
      assert.equal(typeof messages.navigation.siteMapVolunteering, "string");
    }
  });
});

describe("Volunteer staging hygiene", () => {
  it("leaf.png is not part of the required volunteer asset set", () => {
    const requiredPaths = Object.values(VOLUNTEER_ASSETS) as string[];
    assert.equal(requiredPaths.includes("/icons/volunteer/leaf.png"), false);
    assert.equal(requiredPaths.some((p) => p.includes(".DS_Store")), false);
  });
});
