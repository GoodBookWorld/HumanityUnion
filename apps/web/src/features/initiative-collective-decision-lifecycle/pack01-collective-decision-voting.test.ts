import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  describeCollectiveDecisionVotingUnavailable,
  isCollectiveDecisionVotingWindowOpen,
  labelInitiativeDecisionVoteChoice,
} from "./collective-decision-voting";

const featureRoot = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.join(featureRoot, relativePath), "utf8");
}

describe("Lifecycle UX Pack 01 — Collective Decision voting helpers", () => {
  const openProjection = {
    status: "opened" as const,
    openedAt: "2026-01-01T00:00:00.000Z",
    closesAt: "2099-01-01T00:00:00.000Z",
  };

  it("opens ballot only while status is opened and window includes now", () => {
    const now = Date.parse("2026-06-01T00:00:00.000Z");
    assert.equal(isCollectiveDecisionVotingWindowOpen(openProjection, now), true);
    assert.equal(
      isCollectiveDecisionVotingWindowOpen({ ...openProjection, status: "closed" }, now),
      false,
    );
    assert.equal(
      isCollectiveDecisionVotingWindowOpen(
        { ...openProjection, closesAt: "2026-01-02T00:00:00.000Z" },
        now,
      ),
      false,
    );
    assert.equal(
      isCollectiveDecisionVotingWindowOpen(
        { ...openProjection, openedAt: "2026-12-01T00:00:00.000Z" },
        now,
      ),
      false,
    );
  });

  it("describes unavailable voting states for closed/cancelled windows", () => {
    assert.match(
      describeCollectiveDecisionVotingUnavailable({
        status: "closed",
        closesAt: "2026-01-02T00:00:00.000Z",
        closedAt: "2026-01-02T00:00:00.000Z",
      }) ?? "",
      /closed/i,
    );
    assert.match(
      describeCollectiveDecisionVotingUnavailable({
        status: "cancelled",
        closesAt: "2026-01-02T00:00:00.000Z",
        cancelledAt: "2026-01-02T00:00:00.000Z",
      }) ?? "",
      /cancelled/i,
    );
    assert.equal(describeCollectiveDecisionVotingUnavailable(openProjection), null);
  });

  it("labels canonical vote choices without inventing values", () => {
    assert.equal(labelInitiativeDecisionVoteChoice("support"), "Support");
    assert.equal(labelInitiativeDecisionVoteChoice("do_not_support"), "Do not support");
    assert.equal(labelInitiativeDecisionVoteChoice("abstain"), "Abstain");
  });
});

describe("Lifecycle UX Pack 01 — shell ballot integration contract", () => {
  it("PublicResult hosts ballot and refreshes after vote", () => {
    const publicResult = read("components/InitiativeCollectiveDecisionPublicResult.tsx");
    assert.match(publicResult, /InitiativeCollectiveDecisionBallotWidget/);
    assert.match(publicResult, /onVoteSucceeded/);
    assert.match(publicResult, /getPublicInitiativeCollectiveDecisionOrThrow/);
    assert.match(publicResult, /supportCount/);
  });

  it("ballot reuses castOrUpdate + my-vote APIs and auth gate", () => {
    const ballot = read("components/InitiativeCollectiveDecisionBallotWidget.tsx");
    assert.match(ballot, /castOrUpdateInitiativeDecisionVote/);
    assert.match(ballot, /getMyInitiativeDecisionVote/);
    assert.match(ballot, /useClientAuthStatus/);
    assert.match(ballot, /collaboration\.vote\.signInToVote/);
    assert.match(ballot, /INITIATIVE_DECISION_VOTE_CHOICES/);
    assert.match(ballot, /aria-pressed/);
    assert.match(ballot, /disabled=\{busy\}/);
    assert.doesNotMatch(ballot, /participantId/);
  });

  it("client API posts canonical choice to existing vote endpoint", () => {
    const api = read("../initiative-collective-decision/api.ts");
    assert.match(api, /castOrUpdateInitiativeDecisionVote/);
    assert.match(api, /\/vote/);
    assert.match(api, /method: "POST"/);
    assert.match(api, /JSON\.stringify\(body\)/);
  });

  it("does not introduce Stage or Activity voting paths in this feature", () => {
    const ballot = read("components/InitiativeCollectiveDecisionBallotWidget.tsx");
    const publicResult = read("components/InitiativeCollectiveDecisionPublicResult.tsx");
    const combined = `${ballot}\n${publicResult}`;
    assert.doesNotMatch(combined, /\/api\/v1\/decisions\//);
    assert.doesNotMatch(combined, /activity.*vote/i);
    assert.doesNotMatch(combined, /collective-decisions\/\[/);
  });
});
