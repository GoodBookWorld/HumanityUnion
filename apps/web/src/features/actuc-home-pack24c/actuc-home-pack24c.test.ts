/**
 * Pack 24C — ACTUC Home presentation section contracts.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const webRoot = path.resolve(webSrc, "..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 24C — ACTUC Home presentation section", () => {
  it("1 — ACTUC appears after Civic Archive", () => {
    const page = read("features/public-home-v2/components/PublicHomeV2Page.tsx");
    const archive = page.indexOf("<PublicHomeCivicArchiveSection");
    const actuc = page.indexOf("<PublicHomeActucSection");
    const ecosystem = page.indexOf("<PublicHomeEcosystemStatementSection");
    assert.ok(archive > 0 && actuc > archive);
    assert.ok(ecosystem > actuc);
  });

  it("2–3 — section matches resource geometry; background #0b0f19", () => {
    const section = read("features/public-home-v2/components/PublicHomeActucSection.tsx");
    assert.match(section, /public-home-v2__section--resource/);
    assert.match(section, /public-home-v2__section--actuc/);
    const css = read("features/public-home-v2/components/actuc-home.css");
    assert.match(css, /--actuc-bg:\s*#0b0f19/);
    assert.match(css, /background:\s*var\(--actuc-bg\)/);
  });

  it("4–6 — logo, name asset, exact slogan", () => {
    const section = read("features/public-home-v2/components/PublicHomeActucSection.tsx");
    assert.match(section, /\/illustrations\/logo-actuc\.webp/);
    assert.match(section, /\/illustrations\/actuc\.webp/);
    assert.match(section, /Action Unity Center/);
    assert.ok(existsSync(path.join(webRoot, "public/illustrations/logo-actuc.webp")));
    assert.ok(existsSync(path.join(webRoot, "public/illustrations/actuc.webp")));
  });

  it("7–8 — Audiowide scoped via next/font; slogan color #38bdf8", () => {
    const font = read("features/public-home-v2/actuc-audiowide.ts");
    assert.match(font, /from "next\/font\/google"/);
    assert.match(font, /Audiowide/);
    assert.doesNotMatch(font, /fonts\.googleapis\.com/);
    const section = read("features/public-home-v2/components/PublicHomeActucSection.tsx");
    assert.match(section, /actucAudiowide/);
    const css = read("features/public-home-v2/components/actuc-home.css");
    assert.match(css, /--actuc-accent-cyan:\s*#38bdf8/);
    assert.match(css, /\.actuc-home__slogan[\s\S]*color:\s*var\(--actuc-accent-cyan\)/);
  });

  it("9–11 — desktop identity row; division button opens modal", () => {
    const section = read("features/public-home-v2/components/PublicHomeActucSection.tsx");
    assert.match(section, /actuc-home__row/);
    assert.match(section, /actuc-home__identity/);
    assert.match(section, /Humanity Union \/\/ Intellectual Defense Division/);
    assert.match(section, /<button[\s\S]*actuc-home__badge/);
    assert.match(section, /ActucPresentationModal/);
    assert.match(section, /setModalOpen\(true\)/);
    const css = read("features/public-home-v2/components/actuc-home.css");
    assert.match(css, /\.actuc-home__row\s*\{[^}]*display:\s*flex/s);
  });

  it("12–16 — modal content, pillars, CTA exact URL (not /register/)", () => {
    const modal = read("features/public-home-v2/components/ActucPresentationModal.tsx");
    assert.match(modal, /ACTUC: The Intellectual Army/);
    assert.match(modal, /Fighting Ignorance/);
    assert.match(modal, /Action Unity Center/);
    assert.match(modal, /Observation & Truth/);
    assert.match(modal, /Strategy & Counter-Action/);
    assert.match(modal, /Hostage to Sentinel/);
    assert.match(modal, /\[ Join The Vanguard \]/);
    assert.match(modal, /https:\/\/actuc\.com\//);
    assert.doesNotMatch(modal, /actuc\.com\/register/);
    assert.match(modal, /target="_blank"/);
    assert.match(modal, /rel="noopener noreferrer"/);
  });

  it("17–19 — accessible modal close/focus; responsive stacking; no runtime Google Fonts link", () => {
    const modal = read("features/public-home-v2/components/ActucPresentationModal.tsx");
    assert.match(modal, /role="dialog"/);
    assert.match(modal, /aria-modal="true"/);
    assert.match(modal, /trapTabKey/);
    assert.match(modal, /Escape/);
    assert.match(modal, /previouslyFocused[\s\S]*focus/);
    assert.match(modal, /Close ACTUC presentation|aria-label="Close"/);

    const css = read("features/public-home-v2/components/actuc-home.css");
    assert.match(css, /@media \(max-width: 720px\)[\s\S]*flex-direction:\s*column/);
    assert.match(css, /@media \(max-width: 900px\)[\s\S]*grid-template-columns:\s*1fr/);

    const font = read("features/public-home-v2/actuc-audiowide.ts");
    assert.doesNotMatch(font, /fonts\.googleapis\.com|fonts\.gstatic\.com|<link rel=/);
    const section = read("features/public-home-v2/components/PublicHomeActucSection.tsx");
    assert.doesNotMatch(section, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });

  it("20 — Civic Media / Archive / Home wiring preserved", () => {
    const page = read("features/public-home-v2/components/PublicHomeV2Page.tsx");
    assert.match(page, /PublicHomeHeroSection/);
    assert.match(page, /PublicHomeHumanityAiPrinciple/);
    assert.match(page, /PublicHomeCivicMediaSection/);
    assert.match(page, /PublicHomeCivicArchiveSection/);
    assert.match(page, /PublicHomeActucSection/);
  });
});
