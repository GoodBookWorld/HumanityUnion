import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { fetchPublicSupportOperationalLinks } from "./support-operational-links-api.js";
import {
  SUPPORT_DONATE_URL,
  SUPPORT_ILLUSTRATIONS,
  SUPPORT_LINK_FALLBACKS,
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

  it("Volunteer CTA defaults to /volunteer while preserving Admin override architecture", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    const constants = read("features/support/support.constants.ts");
    assert.match(content, /t\("volunteer\.cta",\s*siteName\)/);
    assert.match(content, /href=\{links\.volunteerUrl\}/);
    assert.match(constants, /volunteer:\s*"\/volunteer"/);
    assert.match(content, /disabledLabel|disabled/);
    assert.doesNotMatch(content, /VolunteerSubsystem|volunteer\.routes|createVolunteer/);
  });

  it("Regional Program defaults to a same-page '#' placeholder, never the retired WordPress page", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    const constants = read("features/support/support.constants.ts");
    assert.equal(SUPPORT_REGIONAL_PROGRAM_URL, "#");
    assert.equal(SUPPORT_LINK_FALLBACKS.regional_program, "#");
    assert.doesNotMatch(constants, /huws\.org\/regional-program/);
    assert.match(content, /href=\{links\.regionalProgramUrl\}/);
  });

  describe("Regional Program ignores stored legacy Support link values", () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    function stubSupportLinksResponse(links: readonly { linkId: string; url: string }[]) {
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { links: links.map((link) => ({ ...link, label: link.linkId })) },
            meta: {},
            links: {},
            message: "Platform support links loaded.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )) as typeof fetch;
    }

    it("uses '#' even when the API returns the retired WordPress URL", async () => {
      stubSupportLinksResponse([
        { linkId: "donation", url: "https://example.org/donate" },
        { linkId: "volunteer", url: "/volunteer-override" },
        { linkId: "regional_program", url: "https://huws.org/regional-program/" },
      ]);
      const resolved = await fetchPublicSupportOperationalLinks();
      assert.equal(resolved.regionalProgramUrl, "#");
      assert.equal(resolved.donationUrl, "https://example.org/donate");
      assert.equal(resolved.volunteerUrl, "/volunteer-override");
    });

    it("keeps '#' and the other fallbacks when the API omits links or is unavailable", async () => {
      stubSupportLinksResponse([]);
      assert.deepEqual(await fetchPublicSupportOperationalLinks(), {
        donationUrl: SUPPORT_DONATE_URL,
        volunteerUrl: "/volunteer",
        regionalProgramUrl: "#",
      });

      globalThis.fetch = (async () => {
        throw new TypeError("network down");
      }) as typeof fetch;
      assert.equal((await fetchPublicSupportOperationalLinks()).regionalProgramUrl, "#");
    });
  });

  it("treats '#' links as same-page actions, not external new-tab links", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    const supportAction = content.slice(content.indexOf("function SupportAction"));
    const internalBranch = supportAction.match(
      /if \(href\.startsWith\("\/"\) \|\| href\.startsWith\("#"\)\) \{\s*return \(\s*<Button href=\{href\}/,
    );
    assert.ok(internalBranch, "'#' must render the internal Button branch");
    assert.ok(
      supportAction.indexOf('href.startsWith("#")') < supportAction.indexOf("<ExternalButtonLink"),
      "'#' must be handled before the external new-tab fallback",
    );
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
