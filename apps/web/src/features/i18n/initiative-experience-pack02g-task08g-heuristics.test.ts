/**
 * Pack 02G Task 08G — BLOCKED_LEGACY_HEURISTIC documentation + Select-One quarantine.
 *
 * judgmentWords English regex stays derive-owned. Do not expand into multilingual
 * keyword lists. Tracking stage comparisons must use domain helpers.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Pack 02G Task 08G — BLOCKED_LEGACY_HEURISTIC", () => {
  it("judgmentWords regex remains derive-owned (no multilingual keyword expansion)", () => {
    const archiveDerive = readWeb(
      "features/initiative-civic-archive-lifecycle/derive-civic-archive-ai-assistant-insights.ts",
    );
    const impactDerive = readWeb(
      "features/initiative-public-impact-lifecycle/derive-public-impact-ai-assistant-insights.ts",
    );

    assert.match(
      archiveDerive,
      /judgmentWords\s*=\s*\/\\b\(success\|failure\|failed\|succeeded\|triumph\|disaster\|victory\)\\b\/i/,
    );
    assert.match(
      impactDerive,
      /judgmentWords\s*=\s*\/\\b\(success\|failure\|failed\|succeeded\|triumph\|disaster\)\\b\/i/,
    );

    // BLOCKED_LEGACY_HEURISTIC: no locale maps / keyword lists for judgment words.
    assert.doesNotMatch(archiveDerive, /JUDGMENT_WORDS_(UK|AR|ZH|LOCALES)/);
    assert.doesNotMatch(impactDerive, /JUDGMENT_WORDS_(UK|AR|ZH|LOCALES)/);
    assert.doesNotMatch(archiveDerive, /успіх|فشل|成功/);
    assert.doesNotMatch(impactDerive, /успіх|فشل|成功/);

    const resolver = readWeb(
      "features/initiative-lifecycle-stage-workspace/resolve-sidebar-advisory-display.ts",
    );
    assert.doesNotMatch(resolver, /judgmentWords/);
  });

  it("tracking predicates use helpers instead of raw Preparation/Completed compares", () => {
    const derive = readWeb(
      "features/initiative-implementation-tracking-lifecycle/derive-implementation-tracking-ai-assistant-insights.ts",
    );
    assert.match(derive, /isImplementationTrackingCandidatePreparation/);
    assert.match(derive, /isImplementationTrackingCandidateCompleted/);
    assert.doesNotMatch(derive, /===\s*"Preparation"/);
    assert.doesNotMatch(derive, /!==\s*"Completed"/);
  });

  it("PublicChoiceSelectOneVotingBoard remains INTERNAL_UNUSED / unimported quarantine", () => {
    const board = readWeb(
      "features/public-choice-candidate/components/PublicChoiceSelectOneVotingBoard.tsx",
    );
    assert.match(board, /INTERNAL_UNUSED/);
    assert.match(board, /describeCollectiveDecisionVotingUnavailable/);
    assert.doesNotMatch(board, /unavailableReasons/);
    assert.doesNotMatch(board, /useTranslations/);

    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    const page = readWeb(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    const votePanel = readWeb(
      "features/public-initiative-experience/components/PublicChoiceDiscussionVotePanel.tsx",
    );
    assert.doesNotMatch(center, /PublicChoiceSelectOneVotingBoard/);
    assert.doesNotMatch(page, /PublicChoiceSelectOneVotingBoard/);
    assert.doesNotMatch(votePanel, /PublicChoiceSelectOneVotingBoard/);
  });
});
