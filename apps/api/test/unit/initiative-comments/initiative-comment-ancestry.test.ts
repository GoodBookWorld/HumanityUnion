import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";

import {
  InitiativeAncestryMissingError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
  type InitiativeExistenceChecker,
} from "../../../src/shared/initiative-ancestry/index.js";
import {
  createInitiativeComment,
  createInitiativeCommentWithNotifications,
  listApprovedInitiativeComments,
  resetInitiativeCommentsForTests,
  type InitiativeCommentAncestryDependencies,
} from "../../../src/modules/initiative-comments/initiative-comment.service.js";
import { isMongoAvailableForTests } from "../../helpers/test-env.js";

const KNOWN_INITIATIVE_ID = "initiative-ancestry-fixture-1";
const AUTHOR_USER_ID = "test-author-initiative-ancestry";

function createExistenceCheckerSpy(knownInitiativeIds: readonly string[]): {
  dependencies: InitiativeCommentAncestryDependencies;
  calls: string[];
} {
  const calls: string[] = [];
  const initiativeExistenceChecker: InitiativeExistenceChecker = {
    initiativeExists(initiativeId) {
      calls.push(initiativeId);
      return knownInitiativeIds.includes(initiativeId);
    },
  };

  return { dependencies: { initiativeExistenceChecker }, calls };
}

describe("Initiative Comment ancestry enforcement (Recovery Task 05)", () => {
  let previousPersistenceMode: string | undefined;

  before(() => {
    previousPersistenceMode = process.env.INITIATIVE_COMMENT_PERSISTENCE;
    // Force the in-memory comment store for these tests. The ancestry check
    // itself never touches persistence directly — it is exercised entirely
    // through the injected fake InitiativeExistenceChecker below.
    process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";
  });

  after(() => {
    if (previousPersistenceMode === undefined) {
      delete process.env.INITIATIVE_COMMENT_PERSISTENCE;
    } else {
      process.env.INITIATIVE_COMMENT_PERSISTENCE = previousPersistenceMode;
    }
  });

  afterEach(() => {
    resetInitiativeCommentsForTests();
  });

  describe("ancestry failure paths (no MongoDB required)", () => {
    it("rejects an empty initiativeId even when called directly", async () => {
      const { dependencies, calls } = createExistenceCheckerSpy([KNOWN_INITIATIVE_ID]);

      await assert.rejects(
        () =>
          createInitiativeComment(
            { initiativeId: "", authorUserId: AUTHOR_USER_ID, body: "Hello" },
            dependencies,
          ),
        InitiativeAncestryMissingError,
      );
      assert.equal(calls.length, 0, "existence checker must not be called for a missing id");
    });

    it("rejects a whitespace-only initiativeId", async () => {
      const { dependencies, calls } = createExistenceCheckerSpy([KNOWN_INITIATIVE_ID]);

      await assert.rejects(
        () =>
          createInitiativeComment(
            { initiativeId: "   ", authorUserId: AUTHOR_USER_ID, body: "Hello" },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );
      assert.equal(calls.length, 0, "existence checker must not be called for a malformed id");
    });

    it("rejects a malformed identifier according to the current shared identifier convention", async () => {
      const { dependencies } = createExistenceCheckerSpy([KNOWN_INITIATIVE_ID]);

      await assert.rejects(
        () =>
          createInitiativeComment(
            { initiativeId: " padded-id ", authorUserId: AUTHOR_USER_ID, body: "Hello" },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );
    });

    it("rejects a nonexistent Initiative", async () => {
      const { dependencies, calls } = createExistenceCheckerSpy([KNOWN_INITIATIVE_ID]);

      await assert.rejects(
        () =>
          createInitiativeComment(
            { initiativeId: "does-not-exist", authorUserId: AUTHOR_USER_ID, body: "Hello" },
            dependencies,
          ),
        InitiativeNotFoundError,
      );
      assert.deepEqual(calls, ["does-not-exist"]);
    });

    it("persists no comment when ancestry validation fails", async () => {
      const { dependencies } = createExistenceCheckerSpy([KNOWN_INITIATIVE_ID]);

      await assert.rejects(() =>
        createInitiativeComment(
          { initiativeId: "does-not-exist", authorUserId: AUTHOR_USER_ID, body: "Hello" },
          dependencies,
        ),
      );

      const listing = await listApprovedInitiativeComments({ initiativeId: "does-not-exist" });
      assert.equal(listing.total, 0);
    });

    it("publishes no notification event when ancestry validation fails", async () => {
      // createInitiativeCommentWithNotifications only calls
      // emitInitiativeCommentNotifications after createInitiativeComment
      // resolves with a persisted comment. A rejection here proves no such
      // comment — and therefore no notification call — was ever produced.
      const { dependencies } = createExistenceCheckerSpy([KNOWN_INITIATIVE_ID]);

      await assert.rejects(() =>
        createInitiativeCommentWithNotifications(
          {
            initiativeId: "does-not-exist",
            authorUserId: AUTHOR_USER_ID,
            body: "Hello",
            actorMemberId: null,
          },
          dependencies,
        ),
      );
    });
  });

  describe("ancestry success path (transitively requires MongoDB reachability)", () => {
    // createInitiativeComment resolves the author's display name via
    // findMemberProfileByUserId / findAuthUserById (member-profile and auth
    // modules), which unconditionally require MongoDB regardless of the
    // INITIATIVE_COMMENT_PERSISTENCE mode used for comment storage itself.
    // This dependency pre-dates Recovery Task 05 and is out of scope to
    // change here. These assertions are skipped when MongoDB is
    // unavailable, matching the repository's existing test convention (see
    // apps/api/test/helpers/test-env.ts: isMongoAvailableForTests).
    const runIfMongoAvailable = isMongoAvailableForTests() ? it : it.skip;

    runIfMongoAvailable(
      "creates a valid comment for an existing Initiative using the validated initiativeId, checking existence exactly once",
      async () => {
        const { dependencies, calls } = createExistenceCheckerSpy([KNOWN_INITIATIVE_ID]);

        const comment = await createInitiativeComment(
          {
            initiativeId: KNOWN_INITIATIVE_ID,
            authorUserId: AUTHOR_USER_ID,
            body: "A thoughtful comment about this Initiative.",
          },
          dependencies,
        );

        assert.equal(comment.initiativeId, KNOWN_INITIATIVE_ID);
        assert.equal(comment.authorUserId, AUTHOR_USER_ID);
        assert.equal(comment.body, "A thoughtful comment about this Initiative.");
        assert.ok(comment.authorDisplayName, "author display name should still be resolved");
        assert.deepEqual(
          calls,
          [KNOWN_INITIATIVE_ID],
          "Initiative existence must be checked exactly once for a successful creation",
        );
      },
    );

    runIfMongoAvailable("still enforces existing comment-content validation unchanged", async () => {
      const { dependencies } = createExistenceCheckerSpy([KNOWN_INITIATIVE_ID]);

      await assert.rejects(
        () =>
          createInitiativeComment(
            { initiativeId: KNOWN_INITIATIVE_ID, authorUserId: AUTHOR_USER_ID, body: "" },
            dependencies,
          ),
        /empty/i,
      );
    });

    runIfMongoAvailable(
      "completes createInitiativeCommentWithNotifications for a valid creation without disruption",
      async () => {
        const { dependencies } = createExistenceCheckerSpy([KNOWN_INITIATIVE_ID]);

        const comment = await createInitiativeCommentWithNotifications(
          {
            initiativeId: KNOWN_INITIATIVE_ID,
            authorUserId: AUTHOR_USER_ID,
            body: "Another thoughtful comment.",
            actorMemberId: null,
          },
          dependencies,
        );

        assert.equal(comment.initiativeId, KNOWN_INITIATIVE_ID);
      },
    );
  });
});
