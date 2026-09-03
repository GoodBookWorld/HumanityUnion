import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  SUPPORT_DONATE_URL,
  SUPPORT_ILLUSTRATIONS,
  SUPPORT_REGIONAL_PROGRAM_URL,
} from "./support.constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Support Page UX Pack 01", () => {
  it("keeps canonical /support route and Launch-ready content module", () => {
    const page = read("app/support/page.tsx");
    assert.match(page, /features\/support\/components\/SupportPageContent/);
    assert.match(page, /hu-page-container/);
  });

  it("renders required sections, single H1, and three support cards", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /useTranslations\("supportPublic"\)/);
    assert.match(content, /useLocalizedBrand/);
    assert.match(content, /t\("title",\s*siteName\)/);
    assert.match(content, /support-page__title/);
    assert.match(content, /t\("subtitle"\)/);
    assert.match(content, /t\("donate\.title"\)/);
    assert.match(content, /t\("volunteer\.title"\)/);
    assert.match(content, /t\("regional\.title"\)/);
    assert.match(content, /t\("why\.heading"\)/);
    assert.match(content, /t\("forms\.heading"\)/);
    assert.match(content, /t\("forms\.resourcesTitle"\)/);
    assert.match(content, /t\("forms\.participationTitle"\)/);
    assert.match(content, /t\("forms\.regionalTitle"\)/);
    assert.match(content, /id="support-ways"/);
  });

  it("Donate uses Admin-configured Support link with historical Stripe fallback", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.equal(SUPPORT_DONATE_URL, "https://buy.stripe.com/6oE03n4bc9Vm9A45kl");
    assert.match(content, /donationUrl|SUPPORT_LINK_FALLBACKS/);
    assert.match(content, /target="_blank"/);
    assert.match(content, /rel="noopener noreferrer"/);
    assert.match(content, /t\("donate\.cta"\)/);
  });

  it("Volunteer gracefully handles empty optional link without a volunteer subsystem", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /t\("volunteer\.cta",\s*siteName\)/);
    assert.match(content, /disabledLabel|disabled/);
    assert.doesNotMatch(content, /VolunteerSubsystem|volunteer\.routes|createVolunteer/);
  });

  it("Regional Program defaults to temporary WordPress URL until Admin overrides", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    const constants = read("features/support/support.constants.ts");
    assert.equal(SUPPORT_REGIONAL_PROGRAM_URL, "https://huws.org/regional-program/");
    assert.match(content, /regionalProgramUrl|SUPPORT_LINK_FALLBACKS/);
    assert.match(constants, /WordPress/);
    assert.match(constants, /WORDPRESS_REDIRECT_INVENTORY/);
    assert.match(constants, /NEEDS_MAPPING|KEEP_TEMPORARILY/);
  });

  it("closing CTA scrolls to support cards; Support links use public platform API", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /href="#support-ways"/);
    assert.match(content, /t\("forms\.chooseCta"\)/);
    assert.match(content, /fetchPublicSupportOperationalLinks/);
    assert.doesNotMatch(content, /VolunteerSubsystem|createVolunteer|paymentIntent/);
  });

  it("illustration assets exist at replaceable project paths", () => {
    for (const assetPath of Object.values(SUPPORT_ILLUSTRATIONS)) {
      const absolute = path.join(webRoot, "public", assetPath.replace(/^\//, ""));
      assert.ok(existsSync(absolute), `missing ${assetPath}`);
    }
    assert.equal(SUPPORT_ILLUSTRATIONS.why, "/illustrations/fruit-tree.webp");
  });

  it("Why Support Matters uses fruit-tree illustration in a 60/40 layout", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    const css = read("features/support/support-page.css");
    assert.match(content, /SUPPORT_ILLUSTRATIONS\.why/);
    assert.match(content, /className="support-page__why-illustration"/);
    assert.doesNotMatch(content, /support-page__why-media|SUPPORT_ILLUSTRATIONS\.cooperation/);
    assert.match(content, /t\("why\.imageAlt",\s*siteName\)/);
    assert.match(css, /\.support-page__why[\s\S]*grid-template-columns:\s*minmax\(0,\s*3fr\)\s+minmax\(0,\s*2fr\)/);
    assert.match(
      css,
      /@media \(max-width:\s*767px\)[\s\S]*\.support-page__why[\s\S]*grid-template-columns:\s*1fr/,
    );
  });

  it("responsive CSS uses three columns on desktop and one column on mobile", () => {
    const css = read("features/support/support-page.css");
    assert.match(css, /@media \(min-width:\s*768px\)/);
    assert.match(css, /grid-template-columns:\s*repeat\(3/);
    assert.match(css, /\.support-page__cards[\s\S]*grid-template-columns:\s*1fr/);
  });
});
