/**
 * Pack 10D — /media opening + Public Choice results tie-label cleanup.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 10D — Civic Media opening", () => {
  it("Trusted Media tabs do not use document scrollIntoView (no vertical page jump)", () => {
    const tabs = readWeb(
      "features/civic-media-center/components/TrustedMediaCategoryTabs.tsx",
    );
    assert.doesNotMatch(tabs, /\.scrollIntoView\s*\(/);
    assert.match(tabs, /tabList\.scrollTo\s*\(/);
    assert.match(tabs, /offsetLeft/);
    assert.match(tabs, /category-tablist/);
    assert.match(tabs, /role="tablist"/);
    assert.match(tabs, /aria-selected/);
    assert.match(tabs, /ArrowRight|ArrowLeft/);
  });

  it("hash/section targets respect sticky header via scroll-padding / scroll-margin tokens", () => {
    const polish = readWeb("design-system/workspace-polish.css");
    const shell = readWeb(
      "features/civic-media-center/media-rail/civic-media-section-shell.css",
    );
    const pageCss = readWeb("features/civic-media-center/civic-media-center.css");
    const routes = readWeb("features/civic-media-center/routes.ts");

    assert.match(polish, /scroll-padding-top:\s*var\(--hu-scroll-margin-top/);
    assert.match(shell, /scroll-margin-top:\s*var\(--hu-scroll-margin-top/);
    assert.match(pageCss, /scroll-margin-top:\s*var\(--hu-scroll-margin-top/);
    assert.match(routes, /CIVIC_MEDIA_ROUTE.*#/);
  });

  it("Civic Media route remains /media without forced mid-page hash on nav label", () => {
    const constants = readWeb("features/public-experience/constants.ts");
    const routes = readWeb("features/civic-media-center/routes.ts");
    const page = readWeb("app/media/page.tsx");
    assert.match(page, /CivicMedia|media/i);
    assert.match(constants, /Civic Media/);
    assert.match(constants, /href:\s*CIVIC_MEDIA_ROUTE/);
    assert.match(routes, /export const CIVIC_MEDIA_ROUTE = "\/media"/);
    assert.doesNotMatch(constants, /CIVIC_MEDIA_ROUTE\s*\+\s*["']#/);
  });
});

describe("Pack 10D — Public Choice tie label presentation", () => {
  it("does not render pie-election-results__tie while keeping isTie in aggregates", () => {
    const board = readWeb(
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    const surface = readWeb(
      "features/public-choice-candidate/public-choice-election-result-surface.ts",
    );
    const css = readWeb(
      "features/public-initiative-experience/public-initiative-experience.css",
    );

    assert.doesNotMatch(board, /pie-election-results__tie/);
    assert.doesNotMatch(board, />Tie</);
    assert.match(board, /tally\.rank/);
    assert.match(board, /tally\.percentage/);
    assert.match(board, /resultsLabel/);
    assert.match(board, /aggregates/);
    assert.match(surface, /isTie/);
    assert.doesNotMatch(css, /\.pie-election-results__tie\s*\{/);
  });
});
