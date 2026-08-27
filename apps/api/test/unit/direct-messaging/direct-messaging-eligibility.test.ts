import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicCommentAuthor } from "@hu/types";

import {
  areParticipantsActiveAllies,
  isNewDirectConversationAllowed,
  isSendIntoExistingConversationAllowed,
  type DirectMessagingEligibilityDependencies,
} from "../../../src/modules/direct-messaging/direct-messaging-eligibility.js";
import type { WorkspaceAllyEntry } from "../../../src/modules/initiative-discussion-collaboration/workspace-allies.service.js";

/**
 * Profile UX Pack 03 Part 5/6/21 — pure, MongoDB-free eligibility unit
 * tests. `isNewDirectConversationAllowed` is the single source of truth
 * shared by the Public Profile Message-button projection AND the
 * authoritative open-conversation write path (Part 5: "frontend state is
 * not authority"), so exercising it here directly covers both surfaces.
 */

function buildAllyEntry(participantId: string): WorkspaceAllyEntry {
  const author: PublicCommentAuthor = { displayName: `Participant ${participantId}` };

  return {
    participantId,
    sharedInitiativeCount: 1,
    author,
  };
}

function buildDeps(alliesByParticipant: Record<string, string[]>): DirectMessagingEligibilityDependencies {
  return {
    async listWorkspaceAlliesForParticipant(participantId: string) {
      const allyIds = alliesByParticipant[participantId] ?? [];
      return allyIds.map(buildAllyEntry);
    },
  };
}

const VIEWER = "participant-viewer";
const OWNER = "participant-owner";

describe("Direct Messaging eligibility (Profile UX Pack 03 Part 5/6)", () => {
  describe("areParticipantsActiveAllies", () => {
    it("test 4 — true when the owner's Ally list already contains the viewer", async () => {
      const deps = buildDeps({ [OWNER]: [VIEWER] });
      assert.equal(await areParticipantsActiveAllies(VIEWER, OWNER, deps), true);
    });

    it("checks both directions (viewer stewards, owner is the Ally)", async () => {
      const deps = buildDeps({ [VIEWER]: [OWNER] });
      assert.equal(await areParticipantsActiveAllies(VIEWER, OWNER, deps), true);
    });

    it("test 5 — false for an unrelated pair", async () => {
      const deps = buildDeps({});
      assert.equal(await areParticipantsActiveAllies(VIEWER, OWNER, deps), false);
    });

    it("is false for a participant compared with themselves (no self-Ally)", async () => {
      const deps = buildDeps({ [VIEWER]: [VIEWER] });
      assert.equal(await areParticipantsActiveAllies(VIEWER, VIEWER, deps), false);
    });
  });

  describe("isNewDirectConversationAllowed", () => {
    it("test 7 — Nobody blocks every viewer, even an Active Ally", async () => {
      const deps = buildDeps({ [OWNER]: [VIEWER] });
      assert.equal(await isNewDirectConversationAllowed(VIEWER, OWNER, "nobody", deps), false);
    });

    it("Pack 26B — Admin still cannot bypass nobody", async () => {
      const deps = buildDeps({});
      assert.equal(
        await isNewDirectConversationAllowed(VIEWER, OWNER, "nobody", deps, { viewerIsAdmin: true }),
        false,
      );
    });

    it("Pack 26B — Admin bypasses active_allies without Ally relationship", async () => {
      const deps = buildDeps({});
      assert.equal(
        await isNewDirectConversationAllowed(VIEWER, OWNER, "active_allies", deps, {
          viewerIsAdmin: true,
        }),
        true,
      );
    });

    it("Pack 26B — normal Participant does not bypass active_allies", async () => {
      const deps = buildDeps({});
      assert.equal(
        await isNewDirectConversationAllowed(VIEWER, OWNER, "active_allies", deps, {
          viewerIsAdmin: false,
        }),
        false,
      );
    });

    it("test 6 — Registered Participants allows any authenticated, non-owner viewer", async () => {
      const deps = buildDeps({});
      assert.equal(
        await isNewDirectConversationAllowed(VIEWER, OWNER, "registered_participants", deps),
        true,
      );
    });

    it("test 4 — Active Allies allows a verified active Ally", async () => {
      const deps = buildDeps({ [OWNER]: [VIEWER] });
      assert.equal(await isNewDirectConversationAllowed(VIEWER, OWNER, "active_allies", deps), true);
    });

    it("test 5 — Active Allies rejects a non-Ally", async () => {
      const deps = buildDeps({});
      assert.equal(await isNewDirectConversationAllowed(VIEWER, OWNER, "active_allies", deps), false);
    });

    it("hidden case: an unauthenticated viewer (undefined) is never allowed, regardless of policy", async () => {
      const deps = buildDeps({});
      assert.equal(
        await isNewDirectConversationAllowed(undefined, OWNER, "registered_participants", deps),
        false,
      );
    });

    it("hidden case: the profile owner viewing themselves is never allowed, regardless of policy", async () => {
      const deps = buildDeps({});
      assert.equal(
        await isNewDirectConversationAllowed(OWNER, OWNER, "registered_participants", deps),
        false,
      );
    });
  });

  describe("isSendIntoExistingConversationAllowed (Part 6 — existing-conversation policy)", () => {
    it("blocks sending once the recipient has switched to Nobody", () => {
      assert.equal(isSendIntoExistingConversationAllowed("nobody"), false);
    });

    it("still allows sending under Active Allies or Registered Participants (history/thread already exists)", () => {
      assert.equal(isSendIntoExistingConversationAllowed("active_allies"), true);
      assert.equal(isSendIntoExistingConversationAllowed("registered_participants"), true);
    });
  });
});
