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
    assert.match(content, /<h1[^>]*>Support Humanity Union<\/h1>/);
    assert.match(content, /Help build better conditions for thoughtful collective action/);
    assert.match(content, /Support the Project/);
    assert.match(content, /Volunteer/);
    assert.match(content, /Build a Regional Representation/);
    assert.match(content, /Why Support Matters/);
    assert.match(content, /Every form of support matters differently/);
    assert.match(content, /Resources/);
    assert.match(content, /Participation/);
    assert.match(content, /Regional Communities/);
    assert.match(content, /id="support-ways"/);
  });

  it("Donate uses existing Stripe link with safe external attributes", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.equal(SUPPORT_DONATE_URL, "https://buy.stripe.com/6oE03n4bc9Vm9A45kl");
    assert.match(content, /SUPPORT_DONATE_URL/);
    assert.match(content, /target="_blank"/);
    assert.match(content, /rel="noopener noreferrer"/);
    assert.match(content, />Donate</);
  });

  it("Volunteer is a disabled Design System placeholder without a subsystem", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /Volunteer with Humanity Union/);
    assert.match(content, /disabled/);
    assert.doesNotMatch(content, /VolunteerSubsystem|volunteer\.routes|createVolunteer/);
  });

  it("Regional Program uses temporary external URL with TODO for internal replacement", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    const constants = read("features/support/support.constants.ts");
    assert.equal(SUPPORT_REGIONAL_PROGRAM_URL, "https://huws.org/regional-program/");
    assert.match(content, /SUPPORT_REGIONAL_PROGRAM_URL/);
    assert.match(content, /TODO:\s*Replace with internal Humanity Union Regional Program/);
    assert.match(constants, /TODO:\s*Replace with internal Humanity Union Regional Program/);
  });

  it("closing CTA scrolls to support cards; no payment or volunteer APIs", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /href="#support-ways"/);
    assert.match(content, /Choose how you want to contribute/);
    assert.doesNotMatch(content, /apiRequest|fetch\(|\/api\/v1\//);
  });

  it("illustration assets exist at replaceable project paths", () => {
    for (const assetPath of Object.values(SUPPORT_ILLUSTRATIONS)) {
      const absolute = path.join(webRoot, "public", assetPath.replace(/^\//, ""));
      assert.ok(existsSync(absolute), `missing ${assetPath}`);
    }
  });

  it("responsive CSS uses three columns on desktop and one column on mobile", () => {
    const css = read("features/support/support-page.css");
    assert.match(css, /@media \(min-width:\s*768px\)/);
    assert.match(css, /grid-template-columns:\s*repeat\(3/);
    assert.match(css, /\.support-page__cards[\s\S]*grid-template-columns:\s*1fr/);
  });
});
