import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  REGIONAL_PROGRAM_ASSETS,
  REGIONAL_PROGRAM_ICONS,
  REGIONAL_PROGRAM_JOIN_MAILTO,
  REGIONAL_PROGRAM_ROUTE,
  REGIONAL_PROGRAM_VOLUNTEER_HREF,
} from "./regional-program.constants.js";
import { SUPPORT_LINK_FALLBACKS, SUPPORT_REGIONAL_PROGRAM_URL } from "../support/support.constants.js";
import { isPublicSeoLocalePath } from "@hu/types";
import { STATIC_PUBLIC_SITEMAP_PATHS } from "../../lib/seo/sitemap/providers/static-public-pages.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Regional Development Program public page", () => {
  it("exposes canonical /regional-program route with public container shell", () => {
    const page = read("app/regional-program/page.tsx");
    assert.match(page, /features\/regional-program\/components\/RegionalProgramPageContent/);
    assert.match(page, /hu-page-container/);
    assert.match(page, /hu-page-container--sectioned/);
    assert.equal(REGIONAL_PROGRAM_ROUTE, "/regional-program");
    assert.equal(
      existsSync(path.join(webSrc, "app/[locale]/regional-program/page.tsx")),
      true,
    );
  });

  it("uses regionalProgramPublic i18n and required section headings", () => {
    const content = read("features/regional-program/components/RegionalProgramPageContent.tsx");
    assert.match(content, /useTranslations\("regionalProgramPublic"\)/);
    assert.match(content, /regional-program-mission-heading/);
    assert.match(content, /regional-program-activities-heading/);
    assert.match(content, /regional-program-tools-heading/);
    assert.match(content, /regional-program-benefits-heading/);
    assert.match(content, /regional-program-development-heading/);
    assert.match(content, /regional-program-presence-heading/);
    assert.match(content, /regional-program-principles-heading/);
    assert.match(content, /regional-program-final-cta-heading/);
    assert.doesNotMatch(content, /Bring Humanity Union to Your Community/);
  });

  it("Join CTA uses mailto and Volunteer CTA uses /volunteer", () => {
    const content = read("features/regional-program/components/RegionalProgramPageContent.tsx");
    assert.equal(REGIONAL_PROGRAM_JOIN_MAILTO, "mailto:info@huws.org");
    assert.equal(REGIONAL_PROGRAM_VOLUNTEER_HREF, "/volunteer");
    assert.match(content, /REGIONAL_PROGRAM_JOIN_MAILTO/);
    assert.match(content, /REGIONAL_PROGRAM_VOLUNTEER_HREF/);
    assert.doesNotMatch(content, /fetch\(|apiRequest|useState\(/);
  });

  it("required illustration assets exist under public/illustrations/support", () => {
    for (const assetPath of Object.values(REGIONAL_PROGRAM_ASSETS)) {
      const absolute = path.join(webRoot, "public", assetPath.replace(/^\//, ""));
      assert.ok(existsSync(absolute), `missing ${assetPath}`);
      assert.match(assetPath, /^\/illustrations\/support\//);
      assert.match(assetPath, /\.webp$/);
    }
  });

  it("icons are true-vector brand-blue SVGs without embedded rasters", () => {
    for (const iconPath of Object.values(REGIONAL_PROGRAM_ICONS)) {
      const absolute = path.join(webRoot, "public", iconPath.replace(/^\//, ""));
      assert.ok(existsSync(absolute), `missing ${iconPath}`);
      const svg = readFileSync(absolute, "utf8");
      assert.doesNotMatch(svg, /data:image/);
      assert.match(svg, /#0174b0/i);
    }
  });

  it("RTL hero and final CTA use dir=rtl CSS without locale hardcodes", () => {
    const css = read("features/regional-program/regional-program-page.css");
    assert.match(css, /\[dir=["']rtl["']\]\s*\.regional-program-page__hero/);
    assert.match(css, /\[dir=["']rtl["']\]\s*\.regional-program-page__final-cta/);
    assert.match(css, /humanity-union-teamwork-hands-rtl\.webp/);
    assert.match(css, /hikers-sunset-mountain-panorama-rtl\.webp/);
    assert.doesNotMatch(css, /["']ar["']|["']he["']|locale\s*===\s*["']ar["']/);
  });

  it("SEO perimeter, sitemap, and Support CTA integrate safely", () => {
    assert.equal(isPublicSeoLocalePath("/regional-program"), true);
    assert.ok((STATIC_PUBLIC_SITEMAP_PATHS as readonly string[]).includes("/regional-program"));
    assert.equal(SUPPORT_REGIONAL_PROGRAM_URL, "/regional-program");
    assert.equal(SUPPORT_LINK_FALLBACKS.regional_program, "/regional-program");
    const sitemap = read("features/public-experience/components/PublicSiteMapPage.tsx");
    assert.match(sitemap, /href:\s*"\/regional-program"/);
    assert.match(sitemap, /siteMapRegionalProgram/);
    const primaryNav = read("features/public-experience/constants.ts");
    assert.doesNotMatch(primaryNav, /regional-program|Regional Program/);
  });

  it("generateMetadata uses regionalProgramPublic title/subtitle", () => {
    const page = read("app/regional-program/page.tsx");
    assert.match(page, /getTranslations\(["']regionalProgramPublic["']\)/);
    assert.match(page, /canonicalPath:\s*"\/regional-program"/);
    assert.match(page, /localeFreeCanonicalPath:\s*"\/regional-program"/);
    assert.match(page, /buildPublicPageMetadataForRequest/);
  });
});

describe("Regional Program i18n foundation", () => {
  it("regionalProgramPublic exists in English foundation catalog", () => {
    const messages = JSON.parse(
      readFileSync(path.join(webSrc, "features/i18n/messages/en.json"), "utf8"),
    ) as {
      regionalProgramPublic: { title: string; subtitle: string };
      navigation: { siteMapRegionalProgram: string };
    };
    assert.equal(messages.regionalProgramPublic.title, "Bring Humanity Union to Your Community");
    assert.equal(typeof messages.regionalProgramPublic.subtitle, "string");
    assert.equal(messages.navigation.siteMapRegionalProgram, "Regional Development Program");
  });
});
