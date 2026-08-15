import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  buildInitiativeDiscussionSummary,
  resetInitiativeCommentsMongoForTests,
} from "../../../src/modules/initiative-comments/initiative-comment.service.js";
import {
  createInitiativeComment as createMemoryComment,
  resetInitiativeCommentStoreForTests,
} from "../../../src/modules/initiative-comments/initiative-comment.memory.store.js";

/**
 * UX Evolution Pack 02.3 Part 1 diagnosis — `buildInitiativeDiscussionSummary`
 * is the server-rendered (SSR) entry point for a public Initiative page's
 * initial Discussion comments. Before this pack, it never attached
 * collaboration state (`attachCollaborationStateToComments`), so every
 * server-rendered comment permanently lacked `collaboration`, and the
 * Proposal / Ready to Collaborate / Invite to Allies controls could never
 * appear on first page load.
 *
 * The fix (in `buildPublicInitiativeExperienceProjection`) needs the raw,
 * un-projected comments to attach collaboration state onto the already
 * publicly-projected ones — this suite locks in the `rawComments` field
 * this function now exposes for exactly that purpose.
 *
 * `mapCommentsToPublicDiscussionComments` (used internally) resolves author
 * profiles and reaction summaries through MongoDB regardless of comment
 * persistence mode (see initiative-comment-ancestry.test.ts and
 * initiative-discussion-collaboration.test.ts for the same constraint), so
 * this suite requires MongoDB and is skipped when unavailable.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const INITIATIVE_ID = "discussion-summary-fixture-1";
const AUTHOR_USER_ID = "discussion-summary-author-1";
const SECOND_AUTHOR_USER_ID = "discussion-summary-author-2";

describe("buildInitiativeDiscussionSummary (UX Evolution Pack 02.3 Part 1)", () => {
  let previousPersistenceMode: string | undefined;

  before(() => {
    previousPersistenceMode = process.env.INITIATIVE_COMMENT_PERSISTENCE;
    process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";
  });

  after(async () => {
    if (previousPersistenceMode === undefined) {
      delete process.env.INITIATIVE_COMMENT_PERSISTENCE;
    } else {
      process.env.INITIATIVE_COMMENT_PERSISTENCE = previousPersistenceMode;
    }

    await resetInitiativeCommentsMongoForTests(INITIATIVE_ID);
  });

  afterEach(() => {
    resetInitiativeCommentStoreForTests();
  });

  it("exposes rawComments matching the underlying (un-projected) comments", async () => {
    const created = createMemoryComment({
      initiativeId: INITIATIVE_ID,
      authorUserId: AUTHOR_USER_ID,
      authorDisplayName: "Fixture Participant",
      body: "A comment used to verify the SSR discussion summary wiring.",
    });

    const summary = await buildInitiativeDiscussionSummary({
      initiativeId: INITIATIVE_ID,
      userId: null,
    });

    assert.equal(summary.rawComments.length, 1);
    assert.equal(summary.rawComments[0]?.commentId, created.commentId);
    assert.equal(summary.rawComments[0]?.authorUserId, AUTHOR_USER_ID);
  });

  it("keeps rawComments and initialComments aligned one-to-one by commentId", async () => {
    createMemoryComment({
      initiativeId: INITIATIVE_ID,
      authorUserId: AUTHOR_USER_ID,
      authorDisplayName: "Fixture Participant",
      body: "First comment.",
    });
    // A different author id avoids the in-memory per-author rate limit
    // (`assertRateLimit` in initiative-comment.memory.store.ts), which is
    // unrelated to what this test is verifying.
    createMemoryComment({
      initiativeId: INITIATIVE_ID,
      authorUserId: SECOND_AUTHOR_USER_ID,
      authorDisplayName: "Second Fixture Participant",
      body: "Second comment.",
    });

    const summary = await buildInitiativeDiscussionSummary({
      initiativeId: INITIATIVE_ID,
      userId: null,
    });

    assert.equal(summary.rawComments.length, 2);
    assert.equal(summary.initialComments.length, 2);
    const rawIds = new Set(summary.rawComments.map((comment) => comment.commentId));
    const projectedIds = new Set(summary.initialComments.map((comment) => comment.commentId));
    assert.deepEqual(rawIds, projectedIds);
  });

  it("returns an empty rawComments array (not undefined) when there are no comments", async () => {
    const summary = await buildInitiativeDiscussionSummary({
      initiativeId: "discussion-summary-fixture-empty",
      userId: null,
    });

    assert.deepEqual(summary.rawComments, []);
    assert.deepEqual(summary.initialComments, []);
  });
});
