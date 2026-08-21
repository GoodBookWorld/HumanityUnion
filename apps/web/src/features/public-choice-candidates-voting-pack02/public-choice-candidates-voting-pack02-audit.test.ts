/**
 * Public Choice Candidates & Voting Pack 02A — web architecture contracts.
 *
 * Replaces Pack 02 gap audit once Candidate domain, ballot modes, and
 * visitor Decision Vote are implemented.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  getInitiativeLifecycleProfilePresentation,
  PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE,
} from "@hu/types";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../../..");
const repoRoot = path.resolve(webRoot, "../..");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function pathExists(relativePath: string): boolean {
  return existsSync(path.join(repoRoot, relativePath));
}

describe("Public Choice Candidates & Voting Pack 02A — contracts", () => {
  it("Candidate domain exists (types + API + web client)", () => {
    assert.equal(pathExists("packages/types/src/domain/public-choice-candidate.ts"), true);
    assert.equal(pathExists("apps/api/src/modules/public-choice-candidate"), true);
    assert.equal(pathExists("apps/web/src/features/public-choice-candidate/api.ts"), true);

    const voteType = readRepo("packages/types/src/domain/initiative-decision-vote.ts");
    assert.match(voteType, /candidateId/);
    assert.match(voteType, /visitorKey/);
  });

  it("Decision Vote route supports optional auth + visitor cookie", () => {
    const voteRoutes = readRepo(
      "apps/api/src/modules/initiative-collective-decision/initiative-collective-decision-vote.routes.ts",
    );
    assert.match(voteRoutes, /optionalAuthenticationMiddleware/);
    assert.match(voteRoutes, /hu_initiative_visitor/);
    assert.match(voteRoutes, /castOrUpdateVisitorInitiativeDecisionVote/);
  });

  it("form creates Public Choice election without ballot-mode selector", () => {
    const form = readRepo("apps/web/src/features/initiatives/components/InitiativeFormFields.tsx");
    assert.doesNotMatch(form, /Ballot type/);
    assert.doesNotMatch(form, /Choose one candidate/);
    assert.match(form, /presentation\.isPublicChoice/);
    assert.doesNotMatch(form, /PublicChoiceCandidateManager/);
    assert.match(form, /Create the election first|PUBLIC_CHOICE_ELECTION_CREATE_HELPER/);
  });

  it("Discussion vote panel is legacy-compat only; SELECT_ONE points to Overview", () => {
    const votePanel = readRepo(
      "apps/web/src/features/public-initiative-experience/components/PublicChoiceDiscussionVotePanel.tsx",
    );
    assert.match(votePanel, /SELECT_ONE_CANDIDATE/);
    assert.match(votePanel, /SUPPORT_OPPOSE/);
    assert.match(votePanel, /Overview|castOrUpdateInitiativeDecisionVote/);
  });

  it("sidebar mounts Candidates widget and hides Initiative Support for PUBLIC_CHOICE", () => {
    const sidebar = readRepo(
      "apps/web/src/features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
    );
    assert.match(sidebar, /PublicChoiceElectionSidebarWidget/);
    assert.match(sidebar, /PublicInitiativeSupportStatistics/);
    assert.match(sidebar, /hideInitiativeSupport/);
  });

  it("election detail route exists under public initiative", () => {
    assert.equal(
      pathExists("apps/web/src/app/initiatives/public/[initiativeId]/election/page.tsx"),
      true,
    );
  });

  it("election results present CURRENT/FINAL, participation breakdown, and community disclaimer", () => {
    const page = readRepo(
      "apps/web/src/features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    const board = readRepo(
      "apps/web/src/features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    assert.match(page, /CURRENT RESULTS/);
    assert.match(page, /FINAL RESULTS/);
    assert.match(board, /Participation breakdown/);
    assert.match(page, /PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER/);
    assert.match(board, /pie-election-results__bar/);
    assert.doesNotMatch(page, /official election results/i);
  });

  it("Pack 01 PUBLIC_CHOICE presentation remains intact", () => {
    const standard = getInitiativeLifecycleProfilePresentation("STANDARD");
    const publicChoice = getInitiativeLifecycleProfilePresentation("PUBLIC_CHOICE");
    assert.equal(standard.communityAssociationLabel, "Community association");
    assert.equal(publicChoice.communityAssociationLabel, "Election name");
    assert.equal(publicChoice.requireCountry, true);
    assert.equal(publicChoice.showActivityArea, false);
    assert.deepEqual([...PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE], [
      "initiative",
      "discussion",
      "collective_decision",
      "archive",
    ]);
  });
});
