/**
 * Public Choice Results & Retention Pack 02C — API/web source contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Public Choice Pack 02C — presentation + retention contracts", () => {
  it("election page is results-only with download, expired state, and disclaimer", () => {
    const page = read(
      "apps/web/src/features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    assert.doesNotMatch(page, /buildPublicChoiceCandidatePresentationSlotPlan/);
    assert.doesNotMatch(page, /\+ Add candidate|buildPublicChoiceCandidateSubmitHref/);
    assert.doesNotMatch(page, /PublicChoiceCandidateSubmitPanel/);
    assert.match(page, /Download results/);
    assert.match(page, /Results no longer available/);
    assert.match(page, /Community voting results|PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER/);
    assert.match(page, /CURRENT RESULTS/);
    assert.match(page, /FINAL RESULTS/);
    assert.match(page, /tally\.percentage/);
    assert.doesNotMatch(page, /visitorKey/);
  });

  it("candidate intake lives on Overview, not election results placeholders", () => {
    const overview = read(
      "apps/web/src/features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const routes = read(
      "apps/web/src/features/initiative-owner-studio/initiative-experience-routes.ts",
    );
    assert.match(overview, /Add candidate/);
    assert.match(overview, /PublicChoiceCandidateSubmitPanel/);
    assert.match(routes, /buildPublicChoiceCandidateSubmitHref/);
    assert.match(routes, /#add-candidate/);
    assert.doesNotMatch(routes, /\/election#add-candidate/);
  });

  it("candidate create is authenticated-Participant (Pack 02D closes steward-only gap)", () => {
    const service = read(
      "apps/api/src/modules/public-choice-candidate/public-choice-candidate.service.ts",
    );
    assert.doesNotMatch(service, /assertInitiativeOwnership/);
    assert.match(service, /assertAuthenticatedParticipant/);
    assert.match(service, /submittedByParticipantId/);
  });

  it("download route enforces retention policy and uses pdfkit snapshot", () => {
    const routes = read(
      "apps/api/src/modules/public-choice-results-retention/public-choice-results-retention.routes.ts",
    );
    const pdf = read(
      "apps/api/src/modules/public-choice-results-retention/public-choice-results-pdf-export.service.ts",
    );
    assert.match(routes, /isPublicChoiceResultsDownloadAvailable/);
    assert.match(routes, /410/);
    assert.match(routes, /Results retention period ended/);
    assert.match(pdf, /PDFDocument/);
    assert.match(pdf, /FINAL RESULTS/);
    assert.match(pdf, /disclaimer/);
  });

  it("retention cleanup purges votes/candidates/snapshot and sets tombstone only", () => {
    const service = read(
      "apps/api/src/modules/public-choice-results-retention/public-choice-results-retention.service.ts",
    );
    assert.match(service, /deleteInitiativeDecisionVotesAndHistoryForDecision/);
    assert.match(service, /deletePublicChoiceCandidatesByInitiativeForTests/);
    assert.match(service, /deletePublicChoiceVoteParticipantActionsForInitiative/);
    assert.match(service, /deleteInitiativeDecisionVoteOutboxForDecision/);
    assert.match(service, /publicChoiceResultsExpiredAt/);
    assert.match(service, /never delete shared media/);
    assert.doesNotMatch(service, /deleteMedia|unlinkSync|rmSync/);
  });

  it("scheduler starts on API boot and is not page-visit dependent", () => {
    const index = read("apps/api/src/index.ts");
    assert.match(index, /startPublicChoiceResultsRetentionScheduler/);
  });

  it("Civic Archive does not permanently store detailed PUBLIC_CHOICE rankings", () => {
    const archiveIntel = read(
      "apps/api/src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-intelligence.service.ts",
    );
    assert.doesNotMatch(archiveIntel, /ballotAggregates|candidateId.*rank|SELECT_ONE_CANDIDATE/);
    const lifecycle = read(
      "apps/api/src/modules/initiative-collective-decision-lifecycle/initiative-collective-decision-lifecycle.service.ts",
    );
    assert.match(lifecycle, /votingOutcomeSummary:\s*null/);
  });

  it("projection suppresses aggregates after results_expired", () => {
    const projection = read(
      "apps/api/src/modules/initiative-collective-decision/public-initiative-collective-decision.projection.ts",
    );
    assert.match(projection, /results_expired/);
    assert.match(projection, /resultsRetention/);
  });
});
