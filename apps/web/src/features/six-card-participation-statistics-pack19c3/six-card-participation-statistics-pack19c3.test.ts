/**
 * Pack 19C.3 — Six Participation Statistics Cards UX.
 *
 * apps/web has no React component harness; exercises shared config, privacy
 * UI wiring, CSS equal-height, and Public Profile presentation helpers via
 * Node's built-in test runner (same convention as Pack 18C / presentation tests).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PERSONAL_STATISTICS_CARDS } from "../personal-statistics/personal-statistics-cards.config.js";
import { buildVisibleStatisticCards } from "../member-profile/participant-profile-surface-presentation.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

const SIX_CARD_ORDER = [
  "initiativesCount",
  "collectiveDecisionsCount",
  "alliesCount",
  "proposalsCount",
  "petitionsCount",
  "commitmentsFulfilledCount",
] as const;

describe("Pack 19C.3 — shared PERSONAL_STATISTICS_CARDS config", () => {
  it("defines exactly six cards in Workspace / Public Profile order", () => {
    assert.equal(PERSONAL_STATISTICS_CARDS.length, 6);
    assert.deepEqual(
      PERSONAL_STATISTICS_CARDS.map((card) => card.key),
      [...SIX_CARD_ORDER],
    );
    assert.deepEqual(
      PERSONAL_STATISTICS_CARDS.map((card) => card.label),
      [
        "Initiatives",
        "Collective Decisions",
        "Allies",
        "Proposals",
        "Petitions",
        "Implementation Commitments",
      ],
    );
  });

  it("maps Proposals / Petitions / Implementation Commitments to the correct fields and icons", () => {
    const byKey = Object.fromEntries(
      PERSONAL_STATISTICS_CARDS.map((card) => [card.key, card]),
    );

    assert.equal(byKey.proposalsCount?.iconSrc, "/icons/workspace/proposals.png");
    assert.equal(byKey.petitionsCount?.iconSrc, "/icons/workspace/petition.png");
    assert.equal(byKey.commitmentsFulfilledCount?.iconSrc, "/icons/workspace/commitment.png");
    assert.equal(byKey.commitmentsFulfilledCount?.label, "Implementation Commitments");

    assert.equal(byKey.initiativesCount?.iconSrc, "/icons/workspace/initiatives.svg");
    assert.equal(
      byKey.collectiveDecisionsCount?.iconSrc,
      "/icons/workspace/collective-decisions.svg",
    );
    assert.equal(byKey.alliesCount?.iconSrc, "/icons/workspace/allies.svg");
  });

  it("PNG icon assets exist under public/icons/workspace", () => {
    for (const file of ["proposals.png", "petition.png", "commitment.png"]) {
      assert.ok(
        existsSync(path.join(webRoot, "public/icons/workspace", file)),
        `missing icon ${file}`,
      );
    }
  });
});

describe("Pack 19C.3 — Workspace PersonalStatisticsCards wiring", () => {
  it("renders all six cards from PERSONAL_STATISTICS_CARDS with private ParticipantStatistics", () => {
    const component = readWeb(
      "features/personal-statistics/components/PersonalStatisticsCards.tsx",
    );
    const dashboard = readWeb("features/workspace-home/components/WorkspaceHomeDashboard.tsx");

    assert.match(component, /PERSONAL_STATISTICS_CARDS\.map/);
    assert.match(component, /personal-statistics__grid/);
    assert.match(component, /statistics\[card\.key\]/);
    assert.match(dashboard, /PersonalStatisticsCards/);
    assert.doesNotMatch(component, /commitmentsAcceptedCount|commitmentsActiveCount/);
  });
});

describe("Pack 19C.3 — Public Profile six-card presentation + privacy", () => {
  it("shows six cards when all statistics are present, in config order", () => {
    const cards = buildVisibleStatisticCards({
      initiativesCount: 1,
      collectiveDecisionsCount: 2,
      alliesCount: 3,
      proposalsCount: 4,
      petitionsCount: 5,
      commitmentsFulfilledCount: 6,
      commitmentsAcceptedCount: 99,
      commitmentsActiveCount: 98,
    });

    assert.equal(cards.length, 6);
    assert.deepEqual(
      cards.map((card) => card.key),
      [...SIX_CARD_ORDER],
    );
    assert.equal(cards.find((c) => c.key === "proposalsCount")?.value, 4);
    assert.equal(cards.find((c) => c.key === "petitionsCount")?.value, 5);
    assert.equal(cards.find((c) => c.key === "commitmentsFulfilledCount")?.value, 6);
  });

  it("hides Proposals / Petitions / Commitments independently without dropping other cards", () => {
    const withoutProposals = buildVisibleStatisticCards({
      initiativesCount: 1,
      collectiveDecisionsCount: 2,
      alliesCount: 3,
      petitionsCount: 5,
      commitmentsFulfilledCount: 6,
    });
    assert.equal(
      withoutProposals.some((card) => card.key === "proposalsCount"),
      false,
    );
    assert.equal(withoutProposals.length, 5);

    const withoutPetitions = buildVisibleStatisticCards({
      initiativesCount: 1,
      collectiveDecisionsCount: 2,
      alliesCount: 3,
      proposalsCount: 4,
      commitmentsFulfilledCount: 6,
    });
    assert.equal(
      withoutPetitions.some((card) => card.key === "petitionsCount"),
      false,
    );

    const withoutCommitments = buildVisibleStatisticCards({
      initiativesCount: 1,
      collectiveDecisionsCount: 2,
      alliesCount: 3,
      proposalsCount: 4,
      petitionsCount: 5,
    });
    assert.equal(
      withoutCommitments.some((card) => card.key === "commitmentsFulfilledCount"),
      false,
    );
    assert.equal(withoutCommitments.length, 5);
  });

  it("Public Profile surface still uses privacy-filtered buildVisibleStatisticCards", () => {
    const surface = readWeb("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /buildVisibleStatisticCards\(profile\.statistics\)/);
    assert.match(surface, /public-member-page__statistics/);
    assert.match(surface, /personal-statistics__grid/);
  });
});

describe("Pack 19C.3 — privacy controls UI", () => {
  it("MemberProfileWorkspace exposes Proposals, Petitions, and Commitments toggles", () => {
    const workspace = readWeb("features/member-profile/components/MemberProfileWorkspace.tsx");

    assert.match(workspace, /showProposalsStatistics/);
    assert.match(workspace, /showPetitionsStatistics/);
    assert.match(workspace, /showCommitmentsStatistics/);
    assert.match(workspace, /Show Proposals statistics publicly/);
    assert.match(workspace, /Show Petitions statistics publicly/);
    assert.match(workspace, /Show Implementation Commitments statistics publicly/);
    assert.match(workspace, /Show Initiatives statistics publicly/);
    assert.match(workspace, /Show Collective Decisions statistics publicly/);
    assert.match(workspace, /Show Allies statistics publicly/);
  });
});

describe("Pack 19C.3 — equal-height desktop CSS", () => {
  it("body-row stretches info and statistics panels (no fixed pixel height)", () => {
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");

    assert.match(
      css,
      /\.public-member-page__body-row\s*\{[^}]*align-items:\s*stretch/s,
    );
    assert.doesNotMatch(
      css,
      /\.public-member-page__body-row\s*\{[^}]*align-items:\s*start/s,
    );
    assert.match(css, /\.public-member-page__statistics\s*\{[^}]*height:\s*100%/s);
    assert.doesNotMatch(
      css,
      /\.public-member-page__statistics\s*\{[^}]*height:\s*\d+px/s,
    );
  });

  it("shared grid stays three columns for two visual rows", () => {
    const css = readWeb("features/personal-statistics/personal-statistics.css");
    assert.match(css, /\.personal-statistics__grid[\s\S]*grid-template-columns:\s*repeat\(3/s);
    assert.match(css, /overflow-wrap:\s*normal/);
    assert.match(css, /container-type:\s*inline-size/);
    assert.doesNotMatch(css, /word-break:\s*break-all/);
    assert.doesNotMatch(css, /overflow-wrap:\s*break-word/);
  });
});
