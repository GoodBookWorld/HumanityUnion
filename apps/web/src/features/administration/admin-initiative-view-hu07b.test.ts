/**
 * HU-INIT-07B — Inspect stays the admin record. View is the protected experience page.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("HU-INIT-07B admin Initiative page view", () => {
  it("keeps Inspect and View as separate directory actions", () => {
    const directory = readWeb("features/administration/components/AdminInitiativesSection.tsx");
    assert.match(directory, />\s*Inspect\s*</);
    assert.match(directory, />\s*View\s*</);
    assert.match(
      directory,
      /href=\{`\/admin\/initiatives\/\$\{encodeURIComponent\(row\.initiativeId\)\}`\}/,
    );
    assert.match(
      directory,
      /href=\{`\/admin\/initiatives\/\$\{encodeURIComponent\(row\.initiativeId\)\}\/view`\}/,
    );
  });

  it("renders the existing experience page from the protected admin route", () => {
    const page = readWeb("app/admin/initiatives/[initiativeId]/view/page.tsx");
    const section = readWeb(
      "features/administration/components/AdminInitiativeExperienceSection.tsx",
    );
    assert.match(page, /AdminAccessGate/);
    assert.match(section, /getAdminInitiativeExperience/);
    assert.match(section, /PublicInitiativeExperiencePage/);
    assert.match(section, /readOnly/);
    assert.doesNotMatch(section, /onManageInitiativeUpdated/);
    assert.doesNotMatch(section, /hideAdminInitiativeFromPublic/);
    assert.doesNotMatch(section, /restoreAdminInitiativePublicVisibility/);
    assert.match(section, /Administrative block reason/);
    assert.match(section, /No reason was recorded\./);
    assert.match(section, /view\.administrativeBlockReason/);
  });

  it("loads blocked election candidates from the admin detail read", () => {
    const section = readWeb(
      "features/administration/components/AdminInitiativeExperienceSection.tsx",
    );
    const overview = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    const sidebar = readWeb(
      "features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
    );
    const vote = readWeb(
      "features/public-initiative-experience/components/PublicChoiceDiscussionVotePanel.tsx",
    );
    const ballot = readWeb(
      "features/public-initiative-experience/components/AdminReadOnlyElectionBallot.tsx",
    );

    assert.match(section, /getAdminPublicChoiceDetail/);
    assert.doesNotMatch(section, /listPublicChoiceCandidates|loadPublicChoiceElectionResultSurface|getPublicInitiative\(/);
    assert.match(overview, /readOnlyElection \?/);
    assert.match(overview, /AdminReadOnlyElectionBallotView/);
    assert.match(overview, /PublicChoiceOverviewCandidateIntake/);
    assert.match(sidebar, /readOnlyElection \?/);
    assert.match(sidebar, /PublicChoiceElectionSidebarWidget/);
    assert.match(vote, /if \(readOnlyBallot\)/);
    assert.match(vote, /listPublicChoiceCandidates\(initiativeId\)/);
    assert.match(ballot, /No buttons|voteCount/);
    assert.doesNotMatch(ballot, /castOrUpdateInitiativeDecisionVote|listPublicChoiceCandidates|loadPublicChoiceElectionResultSurface/);
  });

  it("leaves Public Choice Manage and Admin Publishing unchanged", () => {
    const section = readWeb("features/administration/components/AdminPublicChoiceSection.tsx");
    const publishing = readWeb("features/administration/components/AdminPublishingSection.tsx");
    assert.match(
      section,
      /href=\{`\/admin\/public-choice\/\$\{encodeURIComponent\(row\.initiativeId\)\}`\}/,
    );
    assert.match(section, />\s*Manage\s*</);
    assert.match(section, /\/admin\/initiatives\/\$\{encodeURIComponent\(initiativeId\)\}\/view/);
    assert.doesNotMatch(publishing, /getAdminInitiativeExperience/);
    assert.doesNotMatch(publishing, /\/admin\/initiatives\//);
  });

  it("keeps the ordinary public election loader for the public page", () => {
    const intake = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(intake, /loadPublicChoiceElectionResultSurface\(initiativeId\)/);
    assert.match(page, /readOnly = false/);
    assert.match(page, /getPublicInitiativeExperience/);
  });
});
