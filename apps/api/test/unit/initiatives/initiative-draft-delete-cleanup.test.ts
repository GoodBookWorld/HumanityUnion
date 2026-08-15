import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { deleteInitiativeDraft } from "../../../src/modules/initiatives/initiative.service.js";
import { createInitiative, getInitiativeById } from "../../../src/modules/initiatives/initiative.store.js";
import {
  resetInitiativeAlliesStoreForTests,
  upsertAlly,
} from "../../../src/modules/initiative-discussion-collaboration/initiative-ally.store.js";
import {
  deleteCollaborationChannelDataByInitiativeIdForTests,
  insertCollaborationChannelMessageDocument,
  upsertCollaborationChannelReadState,
} from "../../../src/modules/initiative-collaboration-channel/persistence/initiative-collaboration-channel.repository.js";
import {
  deleteCollaborationSessionDataByInitiativeIdForTests,
  insertCollaborationSessionDocument,
} from "../../../src/modules/initiative-collaboration-sessions/persistence/initiative-collaboration-sessions.repository.js";
import { insertSharedDocument } from "../../../src/modules/shared-documents/persistence/shared-documents.repository.js";
import { LocalSecureDocumentStorageProvider } from "../../../src/modules/shared-documents/secure-document-storage.provider.js";

/**
 * Initiative UX Pack 01.1 Part 1/5/6/10 — proves the important, easy-to-miss
 * discovery finding this pack made: Collaboration Channel messages,
 * Collaboration Sessions, Active Allies, and Shared Documents are NOT
 * lifecycle-gated (`resolveInitiativeCollaborationChannelAccess` allows an
 * Author on a still-"draft" Initiative via Initiative Group Chat — see
 * `listMyInitiativeGroups`, which includes non-archived Drafts). So a real
 * Draft can already have every one of these attached, and deleting it must
 * leave zero orphan records ("no orphan records") and zero orphan files on
 * disk ("Draft media" / Shared Document bytes). Exercised against a real
 * (test-isolated) MongoDB, matching `shared-documents-access.test.ts`'s
 * conventions.
 */

process.env.INITIATIVE_PERSISTENCE = "memory";

const TEST_PREFIX = `draft-delete-cleanup-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const AUTHOR_ID = `${TEST_PREFIX}-author`;
const ALLY_ID = `${TEST_PREFIX}-ally`;

function buildDraftInitiative(initiativeId: string): Initiative {
  const now = new Date().toISOString();

  return {
    initiativeId,
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
  };
}

describe("deleteInitiativeDraft cleanup + fail-safe backstop (Initiative UX Pack 01.1)", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await resetInitiativeAlliesStoreForTests(`${TEST_PREFIX}-full`);
    await deleteCollaborationChannelDataByInitiativeIdForTests(`${TEST_PREFIX}-full`);
    await deleteCollaborationSessionDataByInitiativeIdForTests(`${TEST_PREFIX}-full`);
    await disconnectMongoClient();
  });

  it("removes Collaboration Channel messages/reads, Sessions, Allies, and Shared Documents (files included) with zero orphans", async () => {
    const initiativeId = `${TEST_PREFIX}-full`;
    const sessionId = `${TEST_PREFIX}-full-session`;
    createInitiative(buildDraftInitiative(initiativeId));

    const now = new Date().toISOString();

    await insertCollaborationChannelMessageDocument({
      messageId: `${TEST_PREFIX}-message`,
      initiativeId,
      type: "participant_message",
      senderParticipantId: AUTHOR_ID,
      text: "Hello from a still-Draft Initiative Group Chat.",
      createdAt: now,
    });
    await upsertCollaborationChannelReadState({
      initiativeId,
      participantId: AUTHOR_ID,
      lastReadAt: now,
      lastReadMessageId: `${TEST_PREFIX}-message`,
    });

    await insertCollaborationSessionDocument({
      sessionId,
      initiativeId,
      title: "Fixture session",
      meetingDate: "2099-01-01",
      meetingTime: "10:00",
      timezone: "UTC",
      estimatedDurationMinutes: 30,
      scheduledAtUtc: "2099-01-01T10:00:00.000Z",
      createdByParticipantId: AUTHOR_ID,
      createdAt: now,
      updatedAt: now,
    });

    await upsertAlly({
      initiativeId,
      participantId: ALLY_ID,
      status: "active",
      requestedByParticipantId: ALLY_ID,
      createdAt: now,
      updatedAt: now,
    });

    const storageProvider = new LocalSecureDocumentStorageProvider();
    const { storageKey, absolutePath } = await storageProvider.saveFile({
      buffer: Buffer.from("fixture shared document bytes"),
      extension: ".txt",
    });
    const { existsSync } = await import("node:fs");
    assert.ok(absolutePath && existsSync(absolutePath), "fixture file must exist on disk before delete");

    await insertSharedDocument({
      documentId: `${TEST_PREFIX}-document`,
      documentFamilyId: `${TEST_PREFIX}-document`,
      version: 1,
      isLatestVersion: true,
      context: { contextType: "collaboration_channel", initiativeId },
      fileName: "fixture.txt",
      mimeType: "text/plain",
      extension: ".txt",
      size: 30,
      storageKey,
      verificationStatus: "approved",
      uploadedByParticipantId: AUTHOR_ID,
      uploadedAt: now,
    });

    await deleteInitiativeDraft({ participantId: AUTHOR_ID }, initiativeId);

    assert.equal(getInitiativeById(initiativeId), null);

    const remainingMessages = await getMongoCollection(
      MONGO_COLLECTIONS.initiativeCollaborationChannelMessages,
    ).countDocuments({ initiativeId });
    const remainingReads = await getMongoCollection(
      MONGO_COLLECTIONS.initiativeCollaborationChannelReads,
    ).countDocuments({ initiativeId });
    const remainingSessions = await getMongoCollection(
      MONGO_COLLECTIONS.initiativeCollaborationSessions,
    ).countDocuments({ initiativeId });
    const remainingAllies = await getMongoCollection(MONGO_COLLECTIONS.initiativeAllies).countDocuments({
      initiativeId,
    });
    const remainingDocuments = await getMongoCollection(MONGO_COLLECTIONS.sharedDocuments).countDocuments({
      initiativeId,
    });

    assert.equal(remainingMessages, 0, "no orphan Collaboration Channel messages");
    assert.equal(remainingReads, 0, "no orphan Collaboration Channel read markers");
    assert.equal(remainingSessions, 0, "no orphan Collaboration Sessions");
    assert.equal(remainingAllies, 0, "no orphan Ally rows");
    assert.equal(remainingDocuments, 0, "no orphan Shared Document rows");
    assert.equal(existsSync(absolutePath), false, "the Shared Document's bytes must be deleted, not just the row");
  });

  it("fails safely and deletes nothing when an unexpected protected downstream record exists for the initiativeId", async () => {
    const initiativeId = `${TEST_PREFIX}-protected`;
    createInitiative(buildDraftInitiative(initiativeId));

    // Simulate an invariant violation (this should be structurally
    // impossible via real product flows — see module doc on
    // `assertNoProtectedDownstreamArtifacts`) to prove the backstop trips
    // instead of silently deleting alongside it.
    await getMongoCollection(MONGO_COLLECTIONS.petitions).insertOne({
      petitionId: `${TEST_PREFIX}-petition`,
      initiativeId,
    });

    try {
      await assert.rejects(
        () => deleteInitiativeDraft({ participantId: AUTHOR_ID }, initiativeId),
        /not allowed because it has associated civic records/i,
      );

      assert.ok(getInitiativeById(initiativeId), "the Initiative must remain fully intact after a failed-safe abort");
    } finally {
      await getMongoCollection(MONGO_COLLECTIONS.petitions).deleteMany({ initiativeId });
    }
  });
});
