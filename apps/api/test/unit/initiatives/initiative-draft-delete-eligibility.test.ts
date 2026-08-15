import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import { deleteInitiativeDraft } from "../../../src/modules/initiatives/initiative.service.js";
import { createInitiative, getInitiativeById } from "../../../src/modules/initiatives/initiative.store.js";
import {
  getMediaRecordById,
  saveMediaRecord,
} from "../../../src/modules/media-upload/media-upload.service.js";
import { createNotification, listMyNotifications } from "../../../src/modules/notifications/notification.service.js";

/**
 * Initiative UX Pack 01.1 Part 2/5/7/8/10 — delete eligibility, the
 * concurrent/already-deleted race, and in-memory media cleanup, exercised
 * fully MongoDB-free (`INITIATIVE_PERSISTENCE=memory`, matching
 * `initiative-my-groups-service.test.ts`/`shared-documents-access.test.ts`
 * conventions). Collaboration Channel/Sessions/Ally/Shared-Document
 * cleanup — which requires a real MongoDB — is covered separately in
 * `initiative-draft-delete-cleanup.test.ts`.
 */

process.env.INITIATIVE_PERSISTENCE = "memory";

const AUTHOR_ID = "participant-author-draft-delete";
const OUTSIDER_ID = "participant-outsider-draft-delete";
let counter = 0;

function buildDraftInitiative(overrides: Partial<Initiative> = {}): Initiative {
  counter += 1;
  const now = new Date().toISOString();

  return {
    initiativeId: `draft-delete-fixture-${Date.now()}-${counter}`,
    stewardId: AUTHOR_ID,
    createdAt: now,
    updatedAt: now,
    title: "Fixture Draft Initiative",
    description: "Fixture description.",
    status: "proposal",
    lifecyclePhase: "draft",
    visibility: { policy: "steward_only" },
    metadata: {
      category: "environment",
      tags: [],
      region: "",
      language: "en",
      communitySlug: "",
      activityArea: "environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
    ...overrides,
  };
}

describe("deleteInitiativeDraft eligibility (Initiative UX Pack 01.1)", () => {
  it("Author can permanently delete their own Draft Initiative", async () => {
    const initiative = buildDraftInitiative();
    createInitiative(initiative);

    await deleteInitiativeDraft({ participantId: AUTHOR_ID }, initiative.initiativeId);

    assert.equal(getInitiativeById(initiative.initiativeId), null);
  });

  it("Non-author cannot delete another Participant's Draft Initiative", async () => {
    const initiative = buildDraftInitiative();
    createInitiative(initiative);

    await assert.rejects(
      () => deleteInitiativeDraft({ participantId: OUTSIDER_ID }, initiative.initiativeId),
      /do not have access/i,
    );

    // Data safety: the rejected attempt must leave the Initiative fully intact.
    assert.ok(getInitiativeById(initiative.initiativeId));
  });

  it("A published Initiative cannot be deleted through this action", async () => {
    const initiative = buildDraftInitiative({ lifecyclePhase: "published", status: "proposal" });
    createInitiative(initiative);

    await assert.rejects(
      () => deleteInitiativeDraft({ participantId: AUTHOR_ID }, initiative.initiativeId),
      /Only draft initiatives can be deleted/i,
    );

    assert.ok(getInitiativeById(initiative.initiativeId));
  });

  it("A projected (publicly live) Initiative cannot be deleted through this action", async () => {
    const initiative = buildDraftInitiative({
      lifecyclePhase: "projected",
      visibility: { policy: "public" },
    });
    createInitiative(initiative);

    await assert.rejects(
      () => deleteInitiativeDraft({ participantId: AUTHOR_ID }, initiative.initiativeId),
      /Only draft initiatives can be deleted/i,
    );

    assert.ok(getInitiativeById(initiative.initiativeId));
  });

  it("An archived Initiative cannot be deleted through this action", async () => {
    const initiative = buildDraftInitiative({ lifecyclePhase: "archived", status: "archived" });
    createInitiative(initiative);

    await assert.rejects(
      () => deleteInitiativeDraft({ participantId: AUTHOR_ID }, initiative.initiativeId),
      /already been archived/i,
    );

    assert.ok(getInitiativeById(initiative.initiativeId));
  });

  it("Deleting an unknown initiativeId fails with a not-found error", async () => {
    await assert.rejects(
      () => deleteInitiativeDraft({ participantId: AUTHOR_ID }, "initiative-does-not-exist"),
      /not found/i,
    );
  });

  it("Concurrent/repeat delete — the second call fails with a clear 'already deleted' style error, the first succeeds", async () => {
    const initiative = buildDraftInitiative();
    createInitiative(initiative);

    await deleteInitiativeDraft({ participantId: AUTHOR_ID }, initiative.initiativeId);

    await assert.rejects(
      () => deleteInitiativeDraft({ participantId: AUTHOR_ID }, initiative.initiativeId),
      /not found/i,
    );
  });

  it("Refresh-after-delete — the Initiative can never be read again once deleted", async () => {
    const initiative = buildDraftInitiative();
    createInitiative(initiative);

    await deleteInitiativeDraft({ participantId: AUTHOR_ID }, initiative.initiativeId);

    assert.equal(getInitiativeById(initiative.initiativeId), null);
    assert.equal(getInitiativeById(initiative.initiativeId), null, "a second read ('refresh') must not resurrect it");
  });

  it("Media cleanup — the Draft's uploaded cover media record is removed alongside the Initiative", async () => {
    const initiative = buildDraftInitiative();
    createInitiative(initiative);

    const mediaRecord = saveMediaRecord({
      mediaId: `media-${initiative.initiativeId}`,
      mediaUrl: "/api/v1/media/files/initiatives/fixture.webp",
      mediaType: "image/webp",
      size: 1024,
      createdAt: new Date().toISOString(),
      ownerUserId: "user-author",
      ownerParticipantId: AUTHOR_ID,
      purpose: "initiative-image",
      initiativeId: initiative.initiativeId,
      storageKey: "initiatives/does-not-exist-on-disk.webp",
    });
    assert.ok(getMediaRecordById(mediaRecord.mediaId));

    await deleteInitiativeDraft({ participantId: AUTHOR_ID }, initiative.initiativeId);

    assert.equal(getInitiativeById(initiative.initiativeId), null);
    assert.equal(
      getMediaRecordById(mediaRecord.mediaId),
      undefined,
      "no orphaned media record should remain after the Draft is deleted",
    );
  });

  it("Notification cleanup — Draft-related notifications (e.g. Ally interest) are removed alongside the Initiative", async () => {
    const initiative = buildDraftInitiative();
    createInitiative(initiative);

    const recipientUserId = "user-ally-notification-recipient";
    await createNotification({
      recipientUserId,
      recipientProfileId: "profile-ally-notification-recipient",
      eventType: "initiative_published",
      title: "Fixture Draft-related notification",
      message: "An Ally expressed interest in this still-Draft Initiative.",
      relatedEntityType: "initiative",
      relatedEntityId: initiative.initiativeId,
      relatedUrl: `/initiatives/${initiative.initiativeId}`,
      priority: "normal",
    });

    const before = await listMyNotifications({ userId: recipientUserId });
    assert.equal(before.notifications.length, 1);

    await deleteInitiativeDraft({ participantId: AUTHOR_ID }, initiative.initiativeId);

    const after = await listMyNotifications({ userId: recipientUserId });
    assert.equal(
      after.notifications.length,
      0,
      "no orphaned notification pointing at a deleted Draft should remain",
    );
  });
});
