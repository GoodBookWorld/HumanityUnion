import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 05 Initiative public layout + mini-cards + media", () => {
  it("hero uses 50/50 top block with two metadata columns and full-width description", () => {
    const hero = read("features/public-initiative-experience/components/PublicExperienceHero.tsx");
    const css = read("features/public-initiative-experience/public-initiative-experience.css");
    assert.match(hero, /pie-hero__top/);
    assert.match(hero, /pie-hero__description/);
    assert.match(hero, /column: "a"/);
    assert.match(hero, /Activity Area/);
    assert.match(hero, /Current Stage/);
    assert.match(css, /grid-template-columns: 1fr 1fr/);
    assert.match(css, /\.pie-hero__description/);
  });

  it("mini-card keeps one navigation Link for media+body; Share stays outside that Link", () => {
    const card = read("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    assert.match(card, /resolvePublicInitiativeHref/);
    assert.match(card, /View Initiative →/);
    assert.match(card, /aria-label=\{buildAccessibleName/);
    assert.match(card, /public-initiative-mini-card__link/);
    assert.match(card, /CivicShareButton/);
    assert.doesNotMatch(card, /<Link[^>]*>[\s\S]*<Link/);
    assert.doesNotMatch(
      card.slice(card.indexOf('className="public-initiative-mini-card__link"')),
      /CivicShareButton/,
    );
  });

  it("world initiative cards navigate via single Link wrapping media and body", () => {
    const world = read("features/initiatives/components/WorldInitiativesPageContent.tsx");
    assert.match(world, /className="world-initiative-card"/);
    assert.match(world, /View Initiative →/);
    assert.match(world, /aria-label=\{`View initiative:/);
  });

  it("media empty state explains RSS refresh requirement instead of fake cards", () => {
    const placeholder = read("features/public-news/components/PublicNewsPlaceholder.tsx");
    assert.match(placeholder, /NEWS_PROVIDER_ENABLED/);
    assert.match(placeholder, /public-news-discovery__placeholder/);
  });
});
