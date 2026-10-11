/**
 * HU-INIT-07D — administrator view stays read-only and uses protected data.
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

describe("HU-INIT-07D read-only administrator initiative view", () => {
  it("renders lifecycle stage content without the public stage workspace", () => {
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(center, /experience\.stageContent\.find/);
    assert.match(
      center,
      /showLifecycleWorkspaceShell && !readOnly && onNavigateStage/,
    );
    assert.match(center, /readOnly \|\| !showLifecycleWorkspaceShell/);
    assert.match(center, /suppressPublicLinks=\{readOnly\}/);
    assert.match(center, /InitiativeLifecycleStageWorkspace/);
    assert.match(center, /readOnly=\{readOnly\}/);
    assert.match(center, /stageStatusLabel=\{facingStage\?\.stateLabel\}/);
  });

  it("does not fetch the public stage projection from the read-only banner", () => {
    const banner = readWeb(
      "features/public-initiative-experience/components/CurrentLifecycleStageBanner.tsx",
    );
    assert.match(banner, /if \(readOnly\)/);
    assert.match(banner, /function CurrentLifecycleStageBannerLive/);
    assert.match(banner, /getInitiativeLifecycleStageProjection\(initiativeId, stageId\)/);
    const readOnlyBranch = banner.slice(banner.indexOf("if (readOnly)"));
    assert.doesNotMatch(readOnlyBranch, /getInitiativeLifecycleStageProjection/);
  });

  it("shows supplied comments without reactions, collaboration mutations, or public pagination", () => {
    const discussion = readWeb(
      "features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
    );
    assert.match(discussion, /actionsEnabled=\{!readOnly\}/);
    assert.match(discussion, /actionsEnabled \? \(/);
    assert.match(discussion, /mutationsEnabled=\{!readOnly\}/);
    assert.match(discussion, /mutationsEnabled && invitationAcceptState\.visible/);
    assert.match(discussion, /mutationsEnabled && reviewState\.visible/);
    assert.match(discussion, /if \(readOnly\) \{\s*return;\s*\}/);
    assert.match(discussion, /readOnly && hasMore/);
    assert.match(
      discussion,
      /Additional comments exist and are not loaded in this administrator view\./,
    );
    assert.match(discussion, /fetchInitiativeComments\(initiativeId, comments\.length, 40\)/);
    assert.match(discussion, /updateInitiativeCommentReaction/);
    assert.match(discussion, /postInitiativeComment/);
  });

  it("keeps revision summaries visible and does not navigate in read-only mode", () => {
    const history = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeRevisionHistory.tsx",
    );
    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(history, /canonicalSummary=\{revision\.revisionSummary\}/);
    assert.match(history, /readOnly \? \(/);
    assert.match(history, /onClick=\{\(\) => onRevisionSelect\(revision\.version\)\}/);
    assert.match(page, /if \(readOnly\) \{\s*return;\s*\}/);
    assert.match(page, /window\.location\.assign\(href\)/);
  });

  it("hides ally messaging in read-only mode and keeps the public message action", () => {
    const allies = readWeb(
      "features/initiative-active-allies/components/InitiativeActiveAlliesWidget.tsx",
    );
    const sidebar = readWeb(
      "features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
    );
    assert.match(allies, /messagingEnabled && entry\.canMessage/);
    assert.match(allies, /ActiveAllyMessageButton/);
    assert.match(allies, /openConversation/);
    assert.match(sidebar, /messagingEnabled=\{!readOnly\}/);
    assert.match(sidebar, /readOnly=\{readOnly\}/);
  });

  it("displays protected support, opposition, and abstain totals without public election reads", () => {
    const ballot = readWeb(
      "features/public-initiative-experience/components/AdminReadOnlyElectionBallot.tsx",
    );
    const section = readWeb(
      "features/administration/components/AdminInitiativeExperienceSection.tsx",
    );
    const votePanel = readWeb(
      "features/public-initiative-experience/components/PublicChoiceDiscussionVotePanel.tsx",
    );
    assert.match(ballot, /sidebar\.election\.support/);
    assert.match(ballot, /sidebar\.election\.doNotSupport/);
    assert.match(ballot, /sidebar\.election\.abstain/);
    assert.match(ballot, /ballot\.supportCount !== null/);
    assert.match(ballot, /candidate\.voteCount/);
    assert.doesNotMatch(ballot, /percentage|listPublicChoiceCandidates|loadPublicChoiceElectionResultSurface/);
    assert.match(section, /supportCount: detail\.resultSummary\.supportCount/);
    assert.match(section, /oppositionCount: detail\.resultSummary\.oppositionCount/);
    assert.match(section, /abstainCount: detail\.resultSummary\.abstainCount/);
    assert.match(section, /getAdminPublicChoiceDetail/);
    assert.doesNotMatch(
      section,
      /listPublicChoiceCandidates|loadPublicChoiceElectionResultSurface|getPublicInitiative\(/,
    );
    assert.match(votePanel, /if \(readOnlyBallot\)/);
    assert.match(votePanel, /listPublicChoiceCandidates\(initiativeId\)/);
  });

  it("keeps Inspect, View, Manage, and Publishing separate", () => {
    const directory = readWeb("features/administration/components/AdminInitiativesSection.tsx");
    const publicChoice = readWeb("features/administration/components/AdminPublicChoiceSection.tsx");
    const publishing = readWeb("features/administration/components/AdminPublishingSection.tsx");
    assert.match(
      directory,
      /href=\{`\/admin\/initiatives\/\$\{encodeURIComponent\(row\.initiativeId\)\}`\}/,
    );
    assert.match(
      directory,
      /href=\{`\/admin\/initiatives\/\$\{encodeURIComponent\(row\.initiativeId\)\}\/view`\}/,
    );
    assert.match(publicChoice, /\/admin\/initiatives\/\$\{encodeURIComponent\(initiativeId\)\}\/view/);
    assert.match(
      publicChoice,
      /\/admin\/public-choice\/\$\{encodeURIComponent\(row\.initiativeId\)\}/,
    );
    assert.doesNotMatch(publishing, /getAdminInitiativeExperience/);
    assert.doesNotMatch(publishing, /\/admin\/initiatives\//);
  });
});
