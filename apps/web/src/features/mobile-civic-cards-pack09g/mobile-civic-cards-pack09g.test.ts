/**
 * Mobile Civic Cards Pack 09G — compact preview presentation.
 * Presentation-only: hide excerpts on compact screens; keep actions/Share/voting.
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

describe("Mobile Civic Cards Pack 09G — Standard Initiative mini card", () => {
  it("hides PublicInitiativeMiniCard summary on mobile; keeps Share outside Link", () => {
    const css = readWeb("features/public-initiative-mini-card/public-initiative-mini-card.css");
    const card = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    assert.match(css, /Pack 09G/);
    assert.match(css, /@media \(max-width:\s*767px\)/);
    assert.match(
      css,
      /@media \(max-width:\s*767px\)[\s\S]*\.public-initiative-mini-card__summary\s*\{\s*display:\s*none/,
    );
    assert.match(card, /public-initiative-mini-card__summary/);
    assert.match(card, /CivicShareButton/);
    assert.match(card, /public-initiative-mini-card__share/);
    const shareIdx = card.indexOf("public-initiative-mini-card__share");
    const linkIdx = card.indexOf("public-initiative-mini-card__link");
    assert.ok(shareIdx > 0 && linkIdx > shareIdx);
  });

  it("keeps desktop summary rule and does not remove summary from markup", () => {
    const css = readWeb("features/public-initiative-mini-card/public-initiative-mini-card.css");
    const card = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    assert.match(css, /\.public-initiative-mini-card__summary\s*\{[^}]*-webkit-line-clamp:\s*2/);
    assert.match(card, /initiative\.summary/);
    assert.match(card, /public-initiative-mini-card__summary/);
  });
});

describe("Mobile Civic Cards Pack 09G — Country rails", () => {
  it("hides Country Initiative rail summary on tablet/mobile", () => {
    const css = readWeb(
      "features/civic-media-center/components/civic-media-resource-cards.css",
    );
    assert.match(css, /Pack 09G/);
    assert.match(
      css,
      /@media \(max-width:\s*1024px\)[\s\S]*\.country-initiative-rail-card__summary\s*\{\s*display:\s*none/,
    );
    assert.match(css, /object-fit:\s*cover/);
    assert.match(css, /-webkit-line-clamp:\s*2/);
  });

  it("Election rail keeps status/candidates markup; no long description field", () => {
    const election = readWeb(
      "features/country-experience/components/CountryElectionRailCard.tsx",
    );
    const initiative = readWeb(
      "features/country-experience/components/CountryInitiativeRailCard.tsx",
    );
    assert.match(election, /electionVotingStatusLabel|statusLabel/);
    assert.match(election, /candidateCount/);
    assert.match(election, /administrativelyBlocked/);
    assert.match(election, /View Election/);
    assert.doesNotMatch(election, /initiative\.summary/);
    assert.match(initiative, /initiative\.summary/);
    assert.match(initiative, /country-initiative-rail-card__summary/);
  });
});

describe("Mobile Civic Cards Pack 09G — Related + archive + legacy latest", () => {
  it("Related Initiatives hides why/diff on phone", () => {
    const css = readWeb(
      "features/community-intelligence/components/related-initiatives-widget.css",
    );
    assert.match(
      css,
      /@media \(max-width:\s*767px\)[\s\S]*\.ci-related__why[\s\S]*display:\s*none/,
    );
    assert.match(css, /\.ci-related__diff/);
  });

  it("Archive mini-card hides summary on compact; full record card untouched", () => {
    const css = readWeb(
      "features/public-civic-archive/components/civic-archive-results.css",
    );
    assert.match(css, /@media \(max-width:\s*1024px\)/);
    assert.match(
      css,
      /\.civic-archive-mini-card__summary[\s\S]{0,80}display:\s*none/,
    );
    assert.doesNotMatch(
      css,
      /@media[\s\S]{0,200}\.civic-archive-record-card__summary[\s\S]{0,40}display:\s*none/,
    );
  });

  it("legacy LatestInitiativeCard summary hidden on phone", () => {
    const css = readWeb("features/public-experience/public-experience.css");
    assert.match(
      css,
      /@media \(max-width:\s*767px\)[\s\S]*\.latest-initiative-card__summary\s*\{\s*display:\s*none/,
    );
  });
});

describe("Mobile Civic Cards Pack 09G — voting / Share regression guards", () => {
  it("does not hide Select/Recall/Vote on Overview or vote cards via Pack 09G rules", () => {
    const pie = readWeb(
      "features/public-initiative-experience/public-initiative-experience.css",
    );
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.doesNotMatch(pie, /Pack 09G[\s\S]*pie-overview-candidates/);
    assert.doesNotMatch(pie, /Pack 09G[\s\S]*pc-vote-card/);
    assert.match(overview, /Select|Recall|Saving/);
  });

  it("Share Fix 01 mini-card contract remains", () => {
    const shareTest = readWeb("features/civic-share/civic-share-fix01-mini-card.test.ts");
    assert.match(shareTest, /CivicShareButton/);
    assert.match(shareTest, /PublicInitiativeMiniCard/);
  });
});
