/**
 * Improvement Proposal warm discovery must page Part D collections and must
 * not load the full Initiative corpus for --kinds=improvement_proposal.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { IMPROVEMENT_PROPOSAL_WARM_COLLECTION_PAGE_SIZE } from "../../../src/modules/initiative-improvement-proposals-stage/extract-public-improvement-proposal-ids.js";
import { resolveContentTranslationOperatorHydrateScopes } from "../../../src/modules/language/content-translation-staging-warm-operator-scope.js";
import { discoverStagingInitiativePathWarmSources } from "../../../src/modules/language/content-translation-staging-warm-backfill.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../..");

function read(relative: string): string {
  return readFileSync(path.join(apiRoot, relative), "utf8");
}

describe("Improvement Proposal warm discovery data bounds", () => {
  it("page size is bounded and hydrate skips Initiative for IP-only kinds", () => {
    assert.equal(IMPROVEMENT_PROPOSAL_WARM_COLLECTION_PAGE_SIZE, 50);
    assert.deepEqual(resolveContentTranslationOperatorHydrateScopes(["improvement_proposal"]), {
      initiative: false,
      collaborativeAnalysis: false,
      collectiveDecision: false,
    });
    const scope = read(
      "src/modules/language/content-translation-staging-warm-operator-scope.ts",
    );
    assert.doesNotMatch(
      scope.match(/STAGING_WARM_INITIATIVE_SCOPED_KINDS = \[[\s\S]*?\];/)?.[0] ?? "",
      /"improvement_proposal"/,
    );
  });

  it("discovery pages proposal IDs and never calls listInitiatives for IP-only", async () => {
    let listInitiativesCalls = 0;
    let pageCalls = 0;
    const result = await discoverStagingInitiativePathWarmSources({
      kinds: ["improvement_proposal"],
      deps: {
        listInitiatives: () => {
          listInitiativesCalls += 1;
          return [
            {
              initiativeId: "should-not-load",
            } as never,
          ];
        },
        listPublishedImprovementProposalIdsPage: async ({ offset }) => {
          pageCalls += 1;
          if (offset === 0) {
            return {
              proposalIds: ["ip-1", "ip-2"],
              collectionsReturned: 50,
              hasMore: true,
            };
          }
          return {
            proposalIds: ["ip-3"],
            collectionsReturned: 1,
            hasMore: false,
          };
        },
      },
    });

    assert.equal(listInitiativesCalls, 0);
    assert.equal(pageCalls, 2);
    assert.deepEqual(
      result.candidates.map((row) => row.sourceRecordId),
      ["ip-1", "ip-2", "ip-3"],
    );
    assert.equal(
      result.candidates.every((row) => row.sourceKind === "improvement_proposal"),
      true,
    );
  });

  it("mongo page query uses lean proposalId/status projection", () => {
    const mongo = read(
      "src/modules/initiative-improvement-proposals-stage/persistence/initiative-improvement-proposals-stage-mongo.persistence.ts",
    );
    assert.match(mongo, /listPublishedProposalIdsPage/);
    assert.match(mongo, /"proposals\.proposalId":\s*1/);
    assert.match(mongo, /"proposals\.status":\s*1/);
    assert.match(mongo, /\.skip\(offset\)/);
    assert.match(mongo, /\.limit\(limit \+ 1\)/);
  });
});
