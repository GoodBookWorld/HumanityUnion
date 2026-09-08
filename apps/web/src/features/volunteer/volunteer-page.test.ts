import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  VOLUNTEER_ASSETS,
  VOLUNTEER_CREATE_INITIATIVE_HREF,
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

  it("Create Initiative CTA links to canonical create route", () => {
    const content = read("features/volunteer/components/VolunteerPageContent.tsx");
    assert.equal(VOLUNTEER_CREATE_INITIATIVE_HREF, "/initiatives/create");
    assert.match(content, /VOLUNTEER_CREATE_INITIATIVE_HREF/);
    assert.match(content, /t\("createInitiativeCta"\)/);
  });

  it("required volunteer assets resolve under public/icons/volunteer", () => {
    for (const assetPath of Object.values(VOLUNTEER_ASSETS)) {
      const absolute = path.join(webRoot, "public", assetPath.replace(/^\//, ""));
      assert.ok(existsSync(absolute), `missing ${assetPath}`);
      assert.match(assetPath, /^\/icons\/volunteer\//);
    }
    assert.doesNotMatch(Object.values(VOLUNTEER_ASSETS).join("\n"), /\.DS_Store/);
  });

  it("does not reference .DS_Store or unused leaf asset", () => {
    const content = read("features/volunteer/components/VolunteerPageContent.tsx");
    const constants = read("features/volunteer/volunteer.constants.ts");
    assert.doesNotMatch(content, /\.DS_Store|leaf\.png/);
    assert.doesNotMatch(constants, /\.DS_Store|leaf\.png/);
  });

  it("Support Volunteer CTA defaults to /volunteer", () => {
    assert.equal(SUPPORT_LINK_FALLBACKS.volunteer, "/volunteer");
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /href=\{links\.volunteerUrl\}/);
    assert.match(content, /volunteer\.noteAvailable/);
  });

  it("Knowledge Subsections includes Civic Media Center and Volunteering", () => {
    const sidebar = read("features/knowledge-center/components/KnowledgeSidebar.tsx");
    assert.match(sidebar, /CIVIC_MEDIA_ROUTE/);
    assert.match(sidebar, /tNav\("civicMediaCenter"\)/);
    assert.match(sidebar, /href="\/volunteer"/);
    assert.match(sidebar, /tNav\("volunteering"\)/);
    assert.match(sidebar, /knowledge-center__nav-heading-link/);
  });

  it("HTML Sitemap includes /volunteer Volunteering entry", () => {
    const sitemap = read("features/public-experience/components/PublicSiteMapPage.tsx");
    assert.match(sitemap, /href:\s*"\/volunteer"/);
    assert.match(sitemap, /siteMapVolunteering/);
    assert.doesNotMatch(sitemap, /app\/sitemap\.ts|STATIC_PUBLIC_SITEMAP/);
  });

  it("responsive CSS stacks sections below ~900px and uses two columns on desktop", () => {
    const css = read("features/volunteer/volunteer-page.css");
    assert.match(css, /@media \(min-width:\s*900px\)/);
    assert.match(
      css,
      /\.volunteer-page__section[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.35fr\)/,
    );
    assert.match(css, /\.volunteer-page__section[\s\S]*grid-template-columns:\s*1fr/);
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
