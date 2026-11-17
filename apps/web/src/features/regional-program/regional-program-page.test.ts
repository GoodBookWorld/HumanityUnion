import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  REGIONAL_PROGRAM_ACTIVITY_ICONS,
  REGIONAL_PROGRAM_ASSETS,
  REGIONAL_PROGRAM_BENEFIT_ICON,
  REGIONAL_PROGRAM_JOIN_MAILTO,
  REGIONAL_PROGRAM_PRINCIPLE_ICON,
  REGIONAL_PROGRAM_ROUTE,
  REGIONAL_PROGRAM_TOOL_ICONS,
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

function publicPath(assetPath: string): string {
  return path.join(webRoot, "public", assetPath.replace(/^\//, ""));
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
    assert.match(content, /useLocalizedBrand/);
    assert.match(content, /t\("title",\s*siteName\)/);
    assert.match(content, /t\("description",\s*siteName\)/);
    assert.match(content, /t\("mission\.body",\s*siteName\)/);
    assert.match(content, /t\("tools\.body",\s*siteName\)/);
    assert.match(content, /t\("tools\.imageAlt",\s*siteName\)/);
    assert.match(content, /t\("presence\.imageAlt",\s*siteName\)/);
    assert.match(content, /t\("principles\.legal",\s*siteName\)/);
    assert.match(content, /t\("finalCta\.body",\s*siteName\)/);
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

  it("Join CTA defaults to mailto and Volunteer CTA uses /volunteer", () => {
    const content = read("features/regional-program/components/RegionalProgramPageContent.tsx");
    assert.equal(REGIONAL_PROGRAM_JOIN_MAILTO, "mailto:info@huws.org");
    assert.equal(REGIONAL_PROGRAM_VOLUNTEER_HREF, "/volunteer");
    assert.match(content, /REGIONAL_PROGRAM_JOIN_MAILTO/);
    assert.match(content, /REGIONAL_PROGRAM_VOLUNTEER_HREF/);
    assert.match(content, /isRrpApplicationEntryEnabled\(\)/);
    // Flag-ON path may use client auth; flag-OFF path must still reference mailto.
    assert.match(content, /mailto:info@huws\.org|REGIONAL_PROGRAM_JOIN_MAILTO/);
  });

  it("required illustration assets exist under public/illustrations/support", () => {
    for (const assetPath of Object.values(REGIONAL_PROGRAM_ASSETS)) {
      assert.ok(existsSync(publicPath(assetPath)), `missing ${assetPath}`);
      assert.match(assetPath, /^\/illustrations\/support\//);
      assert.match(assetPath, /\.webp$/);
    }
  });

  it("hero and final CTA use identical LTR/RTL illustration URLs", () => {
    assert.equal(
      REGIONAL_PROGRAM_ASSETS.hero,
      "/illustrations/support/humanity-union-teamwork-hands.webp",
    );
    assert.equal(REGIONAL_PROGRAM_ASSETS.heroRtl, REGIONAL_PROGRAM_ASSETS.hero);
    assert.equal(
      REGIONAL_PROGRAM_ASSETS.cta,
      "/illustrations/support/hikers-sunset-mountain.webp",
    );
    assert.equal(REGIONAL_PROGRAM_ASSETS.ctaRtl, REGIONAL_PROGRAM_ASSETS.cta);
    assert.doesNotMatch(REGIONAL_PROGRAM_ASSETS.hero, /-rtl\.webp$/);
    assert.doesNotMatch(REGIONAL_PROGRAM_ASSETS.cta, /-rtl\.webp$/);
    const content = read("features/regional-program/components/RegionalProgramPageContent.tsx");
    assert.match(content, /rtlSrc=\{REGIONAL_PROGRAM_ASSETS\.heroRtl\}/);
    assert.match(content, /rtlSrc=\{REGIONAL_PROGRAM_ASSETS\.ctaRtl\}/);
  });

  it("activity icons are true-vector brand-blue SVGs without embedded rasters", () => {
    for (const iconPath of Object.values(REGIONAL_PROGRAM_ACTIVITY_ICONS)) {
      assert.ok(existsSync(publicPath(iconPath)), `missing ${iconPath}`);
      assert.match(iconPath, /\.svg$/);
      const svg = readFileSync(publicPath(iconPath), "utf8");
      assert.doesNotMatch(svg, /data:image/);
      assert.match(svg, /#0174b0/i);
    }
  });

  it("tool, benefit, and principle icons resolve to existing public assets", () => {
    for (const iconPath of Object.values(REGIONAL_PROGRAM_TOOL_ICONS)) {
      assert.ok(existsSync(publicPath(iconPath)), `missing ${iconPath}`);
    }
    assert.ok(existsSync(publicPath(REGIONAL_PROGRAM_BENEFIT_ICON)));
    assert.ok(existsSync(publicPath(REGIONAL_PROGRAM_PRINCIPLE_ICON)));
    assert.equal(REGIONAL_PROGRAM_TOOL_ICONS.initiatives, "/icons/workspace/initiatives.svg");
    assert.equal(REGIONAL_PROGRAM_TOOL_ICONS.media, "/icons/burger/blog.png");
    assert.equal(REGIONAL_PROGRAM_BENEFIT_ICON, "/icons/workspace/proposals.png");
    assert.equal(REGIONAL_PROGRAM_PRINCIPLE_ICON, "/icons/messenger/attention.png");
  });

  it("activity cards omit numeric badges and use 42px volunteer icons", () => {
    const content = read("features/regional-program/components/RegionalProgramPageContent.tsx");
    const constants = read("features/regional-program/regional-program.constants.ts");
    assert.doesNotMatch(content, /card-number/);
    assert.match(content, /size=\{42\}/);
    assert.match(constants, /unite-people\.svg/);
    assert.match(constants, /soc-education\.svg/);
    assert.match(constants, /support-civic\.svg/);
    assert.match(constants, /build-partner\.svg/);
  });

  it("banners use full-bleed LTR/RTL images without darkening overlays", () => {
    const content = read("features/regional-program/components/RegionalProgramPageContent.tsx");
    const css = read("features/regional-program/regional-program-page.css");
    assert.match(content, /banner-image--ltr/);
    assert.match(content, /banner-image--rtl/);
    assert.match(content, /fit="cover"/);
    assert.match(content, /fit="fill"/);
    assert.match(css, /\[dir=["']rtl["']\]\s*\.regional-program-page__banner-image--rtl/);
    assert.match(css, /\[dir=["']rtl["']\]\s*\.regional-program-page__hero-copy/);
    assert.match(css, /\[dir=["']rtl["']\]\s*\.regional-program-page__final-cta-copy/);
    assert.match(css, /object-fit:\s*cover/);
    assert.match(css, /object-fit:\s*fill/);
    assert.match(css, /\.regional-program-page__hero-copy\s*\{[^}]*background:\s*transparent/s);
    assert.match(css, /\.regional-program-page__final-cta-copy\s*\{[^}]*background:\s*transparent/s);
    assert.doesNotMatch(
      css,
      /\.regional-program-page__(?:hero|final-cta|banner)-copy[^}]*linear-gradient\([^)]*#061828/,
    );
    assert.doesNotMatch(css, /["']ar["']|["']he["']|locale\s*===\s*["']ar["']/);
  });

  it("platform tools render as an eight-card grid", () => {
    const content = read("features/regional-program/components/RegionalProgramPageContent.tsx");
    const css = read("features/regional-program/regional-program-page.css");
    assert.match(content, /tool-card-grid/);
    assert.match(content, /tool-card-title/);
    assert.match(content, /size=\{40\}/);
    assert.match(css, /\.regional-program-page__tool-card-grid/);
    assert.match(css, /repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    assert.doesNotMatch(content, /tool-list/);
  });

  it("benefits use a strip and development uses a distinct timeline", () => {
    const content = read("features/regional-program/components/RegionalProgramPageContent.tsx");
    assert.match(content, /benefit-strip/);
    assert.match(content, /timeline/);
    assert.doesNotMatch(content, /benefit-list/);
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

  it("generateMetadata uses regionalProgramPublic title/subtitle with siteName", () => {
    const page = read("app/regional-program/page.tsx");
    assert.match(page, /getTranslations\(["']regionalProgramPublic["']\)/);
    assert.match(page, /resolveBrandForMetadata/);
    assert.match(page, /t\("title",\s*siteName\)/);
    assert.match(page, /canonicalPath:\s*"\/regional-program"/);
    assert.match(page, /localeFreeCanonicalPath:\s*"\/regional-program"/);
    assert.match(page, /buildPublicPageMetadataForRequest/);
  });
});

describe("Regional Program i18n foundation", () => {
  it("regionalProgramPublic interpolates {siteName} and preserves Society legal name", () => {
    const messages = JSON.parse(
      readFileSync(path.join(webSrc, "features/i18n/messages/en.json"), "utf8"),
    ) as {
      regionalProgramPublic: {
        title: string;
        subtitle: string;
        principles: { legal: string };
        development: { steps: { team: { body: string } } };
        presence: { notice: string };
      };
      navigation: { siteMapRegionalProgram: string };
    };
    assert.equal(messages.regionalProgramPublic.title, "Bring {siteName} to Your Community");
    assert.match(messages.regionalProgramPublic.principles.legal, /\{siteName\}/);
    assert.match(
      messages.regionalProgramPublic.principles.legal,
      /Humanity Union Society/,
    );
    assert.doesNotMatch(
      messages.regionalProgramPublic.principles.legal.replaceAll(
        "Humanity Union Society",
        "",
      ),
      /Humanity Union/,
    );
    assert.match(
      messages.regionalProgramPublic.development.steps.team.body,
      /Humanity Union Society/,
    );
    assert.doesNotMatch(
      messages.regionalProgramPublic.development.steps.team.body,
      /\{siteName\}/,
    );
    assert.match(messages.regionalProgramPublic.presence.notice, /Humanity Union Society/);
    assert.equal(typeof messages.regionalProgramPublic.subtitle, "string");
    assert.equal(messages.navigation.siteMapRegionalProgram, "Regional Development Program");

    const packagedUk = JSON.parse(
      readFileSync(
        path.join(webRoot, "../api/assets/packaged-web-ui-catalogs/uk.json"),
        "utf8",
      ),
    ) as { regionalProgramPublic: { title: string } };
    assert.equal(
      packagedUk.regionalProgramPublic.title,
      "Принесіть {siteName} у свою спільноту",
    );
    const displayed = packagedUk.regionalProgramPublic.title.replaceAll(
      "{siteName}",
      "Союз Людяності",
    );
    assert.match(displayed, /Союз Людяності/);
    assert.doesNotMatch(displayed, /Humanity Union/);
  });
});
