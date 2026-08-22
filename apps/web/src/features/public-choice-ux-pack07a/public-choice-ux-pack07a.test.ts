/**
 * Public Choice Fix 07A — Overview Select/Recall state machine + Abstain removal.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("Public Choice Fix 07A — Select / Recall UI contracts", () => {
  it("Abstain row is not rendered in live Overview candidate UI", () => {
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.doesNotMatch(overview, />Abstain</);
    assert.doesNotMatch(overview, /choice:\s*"abstain"/);
    assert.doesNotMatch(overview, /selectedAbstain/);
    assert.match(overview, /hasSelection = Boolean\(selectedCandidateId\)/);
  });

  it("Select → Saving… → Recall; Recall → Recalling… → Select", () => {
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(overview, /Saving…/);
    assert.match(overview, /Recalling…/);
    assert.match(overview, /\bSelect\b/);
    assert.match(overview, /\bRecall\b/);
    assert.match(overview, /aria-busy=\{pendingId === candidate\.candidateId\}/);
    assert.match(overview, /aria-busy=\{pendingId === "recall"\}/);
    assert.match(overview, /aria-pressed="true"/);
    assert.match(overview, /pc-overview-vote-row__recall/);
  });

  it("non-selected dim/blur; selected stays unblurred; failure restores pending", () => {
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const css = read("features/public-initiative-experience/public-initiative-experience.css");
    assert.match(overview, /const dimmed = rosterLocked && !selected/);
    assert.match(overview, /pc-overview-vote-row--dimmed/);
    assert.match(overview, /pc-overview-vote-row--selected/);
    assert.match(overview, /disabled=\{busy \|\| dimmed \|\| !decisionId\}/);
    assert.match(overview, /role="alert"/);
    assert.match(overview, /Could not record selection/);
    assert.match(overview, /finally \{\s*setBusy\(false\);\s*setPendingId\(null\);/);
    assert.match(css, /\.pc-overview-vote-row--dimmed/);
    assert.match(css, /filter:.*blur/);
    assert.match(css, /\.pc-overview-vote-row--selected[\s\S]*filter:\s*none/);
    assert.match(css, /\.pc-overview-vote-row__recall/);
  });

  it("canonical election refresh fires after Select and Recall", () => {
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const refresh = read("features/public-choice-candidate/public-choice-election-refresh.ts");
    const sidebar = read(
      "features/public-initiative-experience/components/PublicChoiceElectionSidebarWidget.tsx",
    );
    const election = read(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    const cd = read(
      "features/public-choice-candidate/components/PublicChoiceCollectiveDecisionStage.tsx",
    );
    assert.match(overview, /notifyPublicChoiceElectionRefresh\(initiativeId\)/);
    assert.match(refresh, /PUBLIC_CHOICE_ELECTION_REFRESH_EVENT/);
    assert.match(sidebar, /usePublicChoiceElectionRefresh/);
    assert.match(election, /usePublicChoiceElectionRefresh/);
    assert.match(cd, /usePublicChoiceElectionRefresh/);
  });

  it("Add candidate button has overflow-safe sizing", () => {
    const css = read("features/public-initiative-experience/public-initiative-experience.css");
    assert.match(css, /\.pie-overview-candidates__add \{[\s\S]*min-height:\s*2\.75rem/);
    assert.match(css, /\.pie-overview-candidates__add \{[\s\S]*min-width:\s*12rem/);
    assert.match(css, /\.pie-overview-candidates__add \{[\s\S]*overflow:\s*hidden/);
    assert.match(css, /\.pie-overview-candidates__add \{[\s\S]*white-space:\s*nowrap/);
  });
});
