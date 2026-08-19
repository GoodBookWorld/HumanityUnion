/**
 * Lifecycle Staging Fix 02 — Collaboration invitation UX.
 *
 * Proves notification deep-link target, viewerParticipantId on the working
 * list, and that Accept uses respondToAlliesInvitation (same Ally store —
 * no second collaboration model). List-row Accept visibility is covered in
 * discussion-comment-presentation.test.ts.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { InitiativeAlly } from "@hu/types";

import {
  buildInitiativeCollaborationDeepLink,
  listCollaborationParticipantsForInitiative,
  respondToAlliesInvitation,
  type AllyStore,
  type InitiativeDiscussionCollaborationDependencies,
} from "../../../src/modules/initiative-discussion-collaboration/index.js";

const INITIATIVE_ID = "fix02-collab-init-1";
const STEWARD_ID = "fix02-steward";
const INVITED_ID = "fix02-invited";
const OTHER_ID = "fix02-other";

function createFakeAllyStore(): AllyStore {
  const allies = new Map<string, InitiativeAlly>();
  const key = (initiativeId: string, participantId: string) => `${initiativeId}::${participantId}`;

  return {
    async findAlly(initiativeId, participantId) {
      const ally = allies.get(key(initiativeId, participantId));
      return ally ? structuredClone(ally) : null;
    },
    async upsertAlly(ally) {
      allies.set(key(ally.initiativeId, ally.participantId), structuredClone(ally));
      return structuredClone(ally);
    },
    async listAlliesByInitiative(initiativeId) {
      return Array.from(allies.values())
        .filter((ally) => ally.initiativeId === initiativeId)
        .map((ally) => structuredClone(ally));
    },
    async listActiveAlliesByInitiative(initiativeId) {
      return Array.from(allies.values())
        .filter((ally) => ally.initiativeId === initiativeId && ally.status === "active")
        .map((ally) => structuredClone(ally));
    },
    async transitionAllyStatus({ initiativeId, participantId, fromStatus, toStatus, updatedAt }) {
      const existingKey = key(initiativeId, participantId);
      const existing = allies.get(existingKey);

      if (!existing) {
        throw new Error(
          `No Initiative Ally row found for "${initiativeId}:${participantId}" to transition.`,
        );
      }

      if (existing.status !== fromStatus) {
        return { ally: structuredClone(existing), transitioned: false };
      }

      const updated: InitiativeAlly = { ...existing, status: toStatus, updatedAt };
      allies.set(existingKey, structuredClone(updated));
      return { ally: structuredClone(updated), transitioned: true };
    },
  };
}

describe("Lifecycle Staging Fix 02 — collaboration invitation UX", () => {
  it("notification deep-link opens canonical Initiative Discussion Collaboration filter", () => {
    const href = buildInitiativeCollaborationDeepLink(INITIATIVE_ID);
    assert.equal(
      href,
      `/initiatives/public/${INITIATIVE_ID}?filter=collaboration#discussion`,
    );
    assert.match(href, /filter=collaboration/);
    assert.match(href, /#discussion$/);
    assert.doesNotMatch(href, /\/collaboration\//);
    assert.doesNotMatch(href, /[?&]participant=/);
  });

  it("participant-specific notification deep-link targets the Ally-row participant", () => {
    const href = buildInitiativeCollaborationDeepLink(INITIATIVE_ID, INVITED_ID);
    assert.equal(
      href,
      `/initiatives/public/${INITIATIVE_ID}?filter=collaboration&participant=${INVITED_ID}#discussion`,
    );
    assert.match(href, /participant=fix02-invited/);
    assert.match(href, /#discussion$/);
  });

  describe("working list + canonical Accept", () => {
    let deps: InitiativeDiscussionCollaborationDependencies;
    const invitedIdentity = { participantId: INVITED_ID };

    beforeEach(() => {
      deps = {
        authorIdentityResolver: {
          async resolveParticipantIdForAuthUser() {
            return null;
          },
        },
        initiativeAccessResolver: {
          getInitiative(initiativeId) {
            if (initiativeId !== INITIATIVE_ID) {
              return null;
            }
            return { initiativeId: INITIATIVE_ID, stewardId: STEWARD_ID };
          },
        },
        allyStore: createFakeAllyStore(),
        proposalCandidateStore: {
          async findProposalCandidateByCommentId() {
            return null;
          },
          async createProposalCandidate(candidate) {
            return candidate;
          },
          async listProposalCandidatesByCommentIds() {
            return new Map();
          },
        },
        participantIdentityResolver: {
          async resolveAuthorsForParticipantIds(participantIds) {
            return new Map(
              participantIds.map((participantId) => [
                participantId,
                { displayName: `Participant ${participantId}` },
              ]),
            );
          },
        },
        notifier: () => {},
      };
    });

    async function seedInvitation(participantId: string): Promise<void> {
      const now = "2026-08-18T00:00:00.000Z";
      await deps.allyStore.upsertAlly({
        initiativeId: INITIATIVE_ID,
        participantId,
        status: "invitation_pending",
        requestedByParticipantId: STEWARD_ID,
        createdAt: now,
        updatedAt: now,
      });
    }

    it("returns viewerParticipantId so the invited viewer can identify their own row", async () => {
      await seedInvitation(INVITED_ID);

      const asInvited = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        INVITED_ID,
        deps,
      );
      const asSteward = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        STEWARD_ID,
        deps,
      );
      const asGuest = await listCollaborationParticipantsForInitiative(INITIATIVE_ID, null, deps);

      assert.equal(asInvited.viewerParticipantId, INVITED_ID);
      assert.equal(asInvited.isViewerInitiativeSteward, false);
      assert.equal(asSteward.viewerParticipantId, STEWARD_ID);
      assert.equal(asSteward.isViewerInitiativeSteward, true);
      assert.equal(asGuest.viewerParticipantId, null);
    });

    it("Accept via respondToAlliesInvitation changes own row to Ally; other pending stays Invitation Sent", async () => {
      await seedInvitation(INVITED_ID);
      await seedInvitation(OTHER_ID);

      const before = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        INVITED_ID,
        deps,
      );
      assert.equal(
        before.participants.find((row) => row.participantId === INVITED_ID)?.status,
        "invitation_pending",
      );
      assert.equal(
        before.participants.find((row) => row.participantId === OTHER_ID)?.status,
        "invitation_pending",
      );

      const accepted = await respondToAlliesInvitation(
        invitedIdentity,
        INITIATIVE_ID,
        "accept",
        deps,
      );
      assert.equal(accepted.status, "active");

      const after = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        INVITED_ID,
        deps,
      );
      assert.equal(
        after.participants.find((row) => row.participantId === INVITED_ID)?.status,
        "active",
      );
      assert.equal(
        after.participants.find((row) => row.participantId === OTHER_ID)?.status,
        "invitation_pending",
      );

      const reload = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        INVITED_ID,
        deps,
      );
      assert.equal(
        reload.participants.find((row) => row.participantId === INVITED_ID)?.status,
        "active",
      );
    });

    it("Author/steward viewer is never the invitee row identity for Accept-on-list", async () => {
      await seedInvitation(INVITED_ID);

      const asSteward = await listCollaborationParticipantsForInitiative(
        INITIATIVE_ID,
        STEWARD_ID,
        deps,
      );
      assert.equal(asSteward.isViewerInitiativeSteward, true);
      assert.notEqual(asSteward.viewerParticipantId, asSteward.participants[0]?.participantId);
      assert.equal(asSteward.participants[0]?.status, "invitation_pending");
    });
  });
});
