/**
 * Public Choice Fix 08B — web blocked-candidate UI contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isPublicChoiceCandidateAdministrativelyBlocked,
  isPublicChoiceCandidateAvailableForNewSelect,
  toPublicChoiceCandidatePublicProjection,
} from "@hu/types";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("Public Choice Fix 08B — blocked candidate UI", () => {
  it("projection helpers expose isBlocked only", () => {
    assert.equal(
      isPublicChoiceCandidateAdministrativelyBlocked({ administrativelyBlocked: undefined }),
      false,
    );
    assert.equal(
      isPublicChoiceCandidateAvailableForNewSelect(
        { administrativelyBlocked: true },
        { parentElectionAcceptsVotes: true },
      ),
      false,
    );
    const projection = toPublicChoiceCandidatePublicProjection({
      candidateId: "c1",
      initiativeId: "i1",
      name: "N",
      sortOrder: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      administrativelyBlocked: true,
      administrativelyBlockedByParticipantId: "admin",
      administrativeBlockReason: "secret",
    });
    assert.equal(projection.isBlocked, true);
    assert.equal("administrativeBlockReason" in projection, false);
  });

  it("Overview disables Select on blocked rows but keeps Recall for selected", () => {
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(overview, /candidate\.isBlocked/);
    assert.match(overview, /pc-overview-vote-row--blocked/);
    assert.match(overview, /pc-overview-vote-row__blocked/);
    assert.match(overview, /Boolean\(candidate\.isBlocked\)/);
    assert.match(overview, /pc-overview-vote-row__recall/);
  });

  it("results and sidebar mark Blocked while preserving tallies", () => {
    const results = readWeb(
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    const sidebar = readWeb(
      "features/public-initiative-experience/components/PublicChoiceElectionSidebarWidget.tsx",
    );
    assert.match(results, /candidate\?\.isBlocked/);
    assert.match(results, /Blocked/);
    assert.match(sidebar, /candidate\.isBlocked/);
    assert.match(sidebar, /\(Blocked\)/);
  });
});
