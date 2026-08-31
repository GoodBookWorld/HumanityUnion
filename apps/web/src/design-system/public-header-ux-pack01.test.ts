import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DESKTOP_CAPSULE_NAVIGATION,
  PRIMARY_NAVIGATION,
} from "../features/public-experience/constants.js";
import { resolveCurrentDestination } from "./components/resolve-current-destination.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

describe("Public Header UX Pack 01 / Refinement 02 — floating navigation header", () => {
  it("keeps full primary navigation routes available for mobile / deep links", () => {
    const labels = PRIMARY_NAVIGATION.map((item) => item.label);
    assert.deepEqual(labels, [
      "Home",
      "Institutions",
      "Initiatives",
      "Civic Media",
      "Knowledge",
      "Membership",
      "Search",
    ]);
    assert.ok(PRIMARY_NAVIGATION.every((item) => item.href && item.status === "active"));
  });

  it("limits the desktop capsule to exactly five primary links", () => {
    const labels = DESKTOP_CAPSULE_NAVIGATION.map((item) => item.label);
    assert.deepEqual(labels, [
      "Home",
      "Institutions",
      "Initiatives",
      "Knowledge",
      "Search",
    ]);
    assert.equal(DESKTOP_CAPSULE_NAVIGATION.length, 5);

    const header = read("components/HumanityHeader.tsx");
    assert.match(header, /DESKTOP_CAPSULE_NAVIGATION/);
    assert.doesNotMatch(
      header,
      /humanity-header__nav--desktop[\s\S]*PRIMARY_NAVIGATION\.map/,
    );

    const mobile = read("components/HumanityHeaderMobileMenu.tsx");
    assert.match(mobile, /PRIMARY_NAVIGATION\.map/);
  });

  it("keeps brand, capsule nav, and auth as separate zones in markup", () => {
    const header = read("components/HumanityHeader.tsx");
    assert.match(header, /humanity-header__brand/);
    assert.match(header, /humanity-header__nav--desktop/);
    assert.match(header, /humanity-header__utility--desktop/);
    assert.match(header, /HeaderAuthUtility/);
    assert.match(header, /HumanityHeaderMobileMenu/);
    assert.match(header, /aria-label="Primary navigation"/);
  });

  it("guest Log in uses the workspace login icon above the Log in label", () => {
    const auth = read("components/HeaderAuthUtility.tsx");
    assert.match(auth, /\/icons\/workspace\/login\.png/);
    assert.match(auth, /humanity-header__login-link/);
    assert.match(auth, /useTranslations\("auth"\)/);
    assert.match(auth, /tAuth\("logIn"\)/);
    assert.match(auth, /href="\/login"/);
    assert.match(auth, /aria-hidden="true"/);
    assert.match(auth, /AuthenticatedHeaderTools/);
  });

  it("balances WORLD SOLIDARITY width via subtitle letter-spacing only", () => {
    const css = read("layout.css");
    assert.match(css, /\.humanity-header__tagline\s*\{[^}]*letter-spacing:\s*0\.10em/s);
    assert.match(css, /\.humanity-header__brand-name\s*\{[^}]*font-size:\s*var\(--hu-font-size-lg\)/s);
    assert.match(css, /\.humanity-header__tagline\s*\{[^}]*font-size:\s*0\.6875rem/s);
  });

  it("removes the full-bleed bordered header shell", () => {
    const css = read("layout.css");
    assert.match(css, /\.humanity-header\s*\{[^}]*border-bottom:\s*none/s);
    assert.match(css, /\.humanity-header\s*\{[^}]*background:\s*var\(--hu-color-bg-muted\)/s);
    assert.match(css, /\.humanity-header\s*\{[^}]*box-shadow:\s*none/s);
    assert.doesNotMatch(
      css,
      /\.humanity-header\s*\{[^}]*border-bottom:\s*1px solid var\(--hu-color-border\)/s,
    );
  });

  it("styles desktop navigation as a floating capsule outside brand/auth", () => {
    const css = read("layout.css");
    const tokens = read("tokens.css");
    assert.match(tokens, /--hu-radius-capsule:\s*2rem/);
    assert.match(tokens, /--hu-shadow-capsule:/);
    assert.match(css, /\.humanity-header__nav--desktop\s*\{[^}]*border-radius:\s*var\(--hu-radius-capsule\)/s);
    assert.match(css, /\.humanity-header__nav--desktop\s*\{[^}]*box-shadow:\s*var\(--hu-shadow-capsule\)/s);
    assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto\s*minmax\(0,\s*1fr\)/);
  });

  it("preserves sticky behavior and mobile breakpoint behavior", () => {
    const css = read("layout.css");
    assert.match(css, /\.humanity-header\s*\{[^}]*position:\s*sticky/s);
    assert.match(css, /@media \(max-width: 768px\)/);
    assert.match(css, /\.humanity-header__nav--desktop,\s*\n\s*\.humanity-header__utility--desktop\s*\{[^}]*display:\s*none/s);
    assert.match(css, /prefers-reduced-motion:\s*no-preference/);
  });

  it("Launch Readiness Pack 02 — primary nav active state does not default unmatched routes to Home", () => {
    assert.equal(resolveCurrentDestination("/"), "Home");
    assert.equal(resolveCurrentDestination("/initiatives"), "Initiatives");
    assert.equal(resolveCurrentDestination("/knowledge"), "Knowledge");
    assert.equal(resolveCurrentDestination("/blog"), null);
    assert.equal(resolveCurrentDestination("/workspace"), null);
    assert.equal(resolveCurrentDestination("/member/jane"), null);
    assert.equal(resolveCurrentDestination("/login"), null);
  });

  it("Launch Readiness Pack 04 — nested public Initiative routes activate Initiatives", () => {
    assert.equal(
      resolveCurrentDestination("/initiatives/public/init_1#collaborative-analysis"),
      "Initiatives",
    );
    assert.equal(
      resolveCurrentDestination("/collaborative-analysis/public/analysis_1"),
      "Initiatives",
    );
    assert.equal(resolveCurrentDestination("/civic-archive"), null);
  });
});
