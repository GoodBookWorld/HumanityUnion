/**
 * Media Responsive UX Pack 09B —
 * Trusted Media tab rail + news card hierarchy + mobile statistics.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("Media Responsive UX Pack 09B", () => {
  it("Trusted Media category tabs are a nowrap horizontal scroll rail", () => {
    const css = readWeb(
      "features/civic-media-center/media-rail/civic-media-section-shell.css",
    );
    const tabs = readWeb(
      "features/civic-media-center/components/TrustedMediaCategoryTabs.tsx",
    );

    assert.match(css, /\.trusted-media-category-tabs__list\s*\{[^}]*flex-wrap:\s*nowrap/s);
    assert.match(css, /\.trusted-media-category-tabs__list\s*\{[^}]*overflow-x:\s*auto/s);
    assert.match(css, /\.trusted-media-category-tabs__list\s*\{[^}]*white-space:\s*nowrap|scrollbar-width:\s*thin/s);
    assert.match(css, /\.trusted-media-category-tabs__tab\s*\{[^}]*white-space:\s*nowrap/s);
    assert.match(css, /\.trusted-media-category-tabs__tab\s*\{[^}]*min-width:\s*max-content/s);
    assert.match(css, /@media \(max-width:\s*1024px\)/);
    assert.match(tabs, /scrollIntoView/);
    assert.match(tabs, /role="tablist"/);
    assert.match(tabs, /aria-selected/);
    assert.match(tabs, /ArrowRight|ArrowLeft/);
  });

  it("public-news-card places badge above provider-copy with full-width provider row", () => {
    const card = readWeb("features/public-news/components/PublicNewsCard.tsx");
    const css = readWeb("features/public-news/public-news-discovery.css");

    const badgeIdx = card.indexOf('className="public-news-card__badge"');
    const providerIdx = card.indexOf('className="public-news-card__provider"');
    const copyIdx = card.indexOf('className="public-news-card__provider-copy"');
    assert.ok(badgeIdx > 0 && providerIdx > badgeIdx && copyIdx > providerIdx);

    assert.match(css, /\.public-news-card__header\s*\{[^}]*flex-direction:\s*column/s);
    assert.match(css, /\.public-news-card__provider\s*\{[^}]*width:\s*100%/s);
    assert.match(css, /\.public-news-card__provider-copy\s*\{[^}]*flex:\s*1/s);
    assert.match(css, /\.public-news-card__provider-name\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(css, /\.public-news-card__badge\s*\{[^}]*align-self:\s*flex-start/s);
  });

  it("mobile platform statistics center icon/title/value and disable hover reveal", () => {
    const css = readWeb("features/platform-statistics/platform-statistics.css");
    const grid = readWeb("features/platform-statistics/components/PublicStatisticsGrid.tsx");

    assert.match(css, /@media \(max-width:\s*768px\)/);
    const mobileBlock = css.slice(css.lastIndexOf("@media (max-width: 768px)"));
    assert.match(mobileBlock, /align-items:\s*center/);
    assert.match(mobileBlock, /text-align:\s*center/);
    assert.doesNotMatch(mobileBlock, /align-items:\s*flex-start/);
    assert.match(
      mobileBlock,
      /\.platform-statistics__card:hover \.platform-statistics__description[\s\S]*display:\s*none/,
    );
    assert.match(
      mobileBlock,
      /\.platform-statistics__info-trigger\[aria-expanded="true"\] \+ \.platform-statistics__description[\s\S]*display:\s*block/,
    );

    assert.match(
      css,
      /@media \(hover:\s*hover\) and \(pointer:\s*fine\)[\s\S]*\.platform-statistics__card:hover \.platform-statistics__description/,
    );
    assert.match(
      css,
      /@media \(hover:\s*hover\) and \(pointer:\s*fine\)[\s\S]*\.platform-statistics__card:focus-within \.platform-statistics__description/,
    );

    assert.match(grid, /aria-hidden="true"/);
    assert.match(grid, /About this metric/);
    assert.match(grid, /platform-statistics__description/);
  });

  it("Pack 09A candidate primary button CSS guard remains intact", () => {
    const css = readWeb(
      "features/public-initiative-experience/public-initiative-experience.css",
    );
    assert.doesNotMatch(
      css,
      /\.pie-election-candidate-submit button\s*\{[^}]*background:\s*var\(--hu-color-surface\)/,
    );
  });
});
