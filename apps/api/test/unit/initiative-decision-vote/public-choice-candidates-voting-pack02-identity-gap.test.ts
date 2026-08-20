/**
 * Public Choice Candidates & Voting Pack 02A/02B — Decision Vote identity contracts.
 *
 * Pack 02B: durable Mongo Decision Vote is the sole production authority;
 * pack02a memory remains test-only for pure aggregate unit fixtures.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(dir, "../../../src");

function read(relativePath: string): string {
  return readFileSync(path.join(apiRoot, relativePath), "utf8");
}

describe("Public Choice Candidates & Voting — Decision Vote identity", () => {
  it("vote cast path supports optional auth and visitor cookie", () => {
    const routes = read(
      "modules/initiative-collective-decision/initiative-collective-decision-vote.routes.ts",
    );
    assert.match(routes, /optionalAuthenticationMiddleware/);
    assert.match(routes, /castOrUpdateInitiativeDecisionVote/);
    assert.match(routes, /castOrUpdateVisitorInitiativeDecisionVote/);
    assert.match(routes, /hu_initiative_visitor/);
  });

  it("durable Decision Vote store supports XOR participant/visitor identity", () => {
    const store = read("modules/initiative-decision-vote/initiative-decision-vote.store.ts");
    const document = read(
      "modules/initiative-decision-vote/persistence/initiative-decision-vote.mongo-document.ts",
    );
    assert.match(store, /visitorKey/);
    assert.match(store, /participantId/);
    assert.match(store, /assertDecisionVoteVoterIdentity/);
    assert.match(document, /visitorKey/);
    assert.match(document, /buildInitiativeDecisionVoteIdForVisitor/);
  });

  it("effective vote list has no production pack02a memory merge", () => {
    const effective = read("modules/initiative-decision-vote/list-effective-decision-votes.ts");
    assert.match(effective, /listVotesForDecision/);
    assert.doesNotMatch(effective, /listPack02aVotesForDecision/);
  });

  it("Support visitor cookie contract remains available", () => {
    const support = read("modules/initiative-support/initiative-support.routes.ts");
    assert.match(support, /const VISITOR_COOKIE = "hu_initiative_visitor"/);
    assert.match(support, /httpOnly:\s*true/);
    assert.match(support, /sameSite:\s*"lax"/);
  });
});
