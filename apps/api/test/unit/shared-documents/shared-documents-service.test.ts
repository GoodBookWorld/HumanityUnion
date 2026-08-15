import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SharedDocumentContextRef, SharedDocumentUploaderIdentity } from "@hu/types";

import {
  SharedDocumentAccessDeniedError,
  SharedDocumentManagerOnlyError,
  SharedDocumentMalwareDetectedError,
  SharedDocumentNotFoundError,
  SharedDocumentValidationError,
} from "../../../src/modules/shared-documents/shared-documents.errors.js";
import type { SharedDocumentContextAccess } from "../../../src/modules/shared-documents/shared-documents-access.js";
import type { MediaModerationSignal } from "../../../src/modules/shared-documents/shared-documents-moderation.js";
import type { SharedDocumentRecord } from "../../../src/modules/shared-documents/persistence/shared-documents.mongo-document.js";
import {
  listSharedDocuments,
  removeSharedDocument,
  replaceSharedDocument,
  resolveSharedDocumentDownload,
  uploadSharedDocument,
  type SharedDocumentServiceDependencies,
} from "../../../src/modules/shared-documents/shared-documents.service.js";

/**
 * Communication UX Pack 03.7 — the Shared Documents service, exercised
 * fully MongoDB-free through the module's injectable dependencies (mirrors
 * the Collaboration Channel/Sessions test convention).
 */

const INITIATIVE_ID = "initiative-1";
const AUTHOR_ID = "participant-author";
const ALLY_ID = "participant-ally-1";
const OUTSIDER_ID = "participant-outsider";

const CHANNEL_CONTEXT: SharedDocumentContextRef = { contextType: "collaboration_channel", initiativeId: INITIATIVE_ID };

function pngFile(overrides: Partial<{ originalName: unknown; buffer: Buffer; mimeType: string; size: number }> = {}) {
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
  return {
    originalName: "photo.png",
    buffer,
    mimeType: "image/png",
    size: buffer.length,
    ...overrides,
  };
}

function txtFile(overrides: Partial<{ originalName: unknown; buffer: Buffer; mimeType: string; size: number }> = {}) {
  const buffer = Buffer.from("Meeting notes.");
  return {
    originalName: "notes.txt",
    buffer,
    mimeType: "text/plain",
    size: buffer.length,
    ...overrides,
  };
}

interface FakeState {
  documents: SharedDocumentRecord[];
  storage: Map<string, Buffer>;
  notifications: Array<{ kind: string; recipientParticipantId: string; uploaderParticipantId: string }>;
  deletedStorageKeys: string[];
  currentTime: Date;
}

function buildFakeState(): FakeState {
  return { documents: [], storage: new Map(), notifications: [], deletedStorageKeys: [], currentTime: new Date("2090-01-01T00:00:00.000Z") };
}

function buildDeps(
  state: FakeState,
  overrides: Partial<SharedDocumentServiceDependencies & { moderationSignal: MediaModerationSignal; malwareClean: boolean }> = {},
): SharedDocumentServiceDependencies {
  const moderationSignal = overrides.moderationSignal ?? "uncertain";
  const malwareClean = overrides.malwareClean ?? true;

  return {
    resolveAccess: async (context, participantId): Promise<SharedDocumentContextAccess> => {
      if (context.contextType !== "collaboration_channel" || context.initiativeId !== INITIATIVE_ID) {
        throw new SharedDocumentAccessDeniedError();
      }

      if (participantId !== AUTHOR_ID && participantId !== ALLY_ID) {
        throw new SharedDocumentAccessDeniedError();
      }

      const otherParticipantIds = [AUTHOR_ID, ALLY_ID].filter((id) => id !== participantId);

      return {
        relatedEntityType: "initiative",
        relatedEntityId: INITIATIVE_ID,
        relatedUrl: `/initiatives/public/${INITIATIVE_ID}#collaboration-channel`,
        otherParticipantIds,
      };
    },
    insertDocument: async (record) => {
      state.documents.push(record);
    },
    findDocumentById: async (documentId) => state.documents.find((doc) => doc.documentId === documentId) ?? null,
    listLatestDocumentsByContext: async (context) =>
      state.documents
        .filter(
          (doc) =>
            doc.context.contextType === context.contextType &&
            "initiativeId" in doc.context &&
            "initiativeId" in context &&
            doc.context.initiativeId === context.initiativeId &&
            doc.isLatestVersion &&
            !doc.removedAt,
        )
        // Part 11 — mirrors the production repository's `uploadedAt: -1` sort (newest first).
        .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : a.uploadedAt > b.uploadedAt ? -1 : 0)),
    markSuperseded: async (documentId, supersededAt) => {
      const doc = state.documents.find((entry) => entry.documentId === documentId);
      if (doc) {
        doc.isLatestVersion = false;
        doc.supersededAt = supersededAt;
      }
    },
    markRemoved: async (documentId, removedAt) => {
      const doc = state.documents.find((entry) => entry.documentId === documentId);
      if (doc) {
        doc.removedAt = removedAt;
      }
    },
    resolveIdentities: async (participantIds) => {
      const map = new Map<string, SharedDocumentUploaderIdentity>();
      for (const id of participantIds) {
        map.set(id, { displayName: `Name ${id}` });
      }
      return map;
    },
    storageProvider: {
      saveFile: async ({ buffer, extension }) => {
        const storageKey = `fake-${state.storage.size}${extension}`;
        state.storage.set(storageKey, buffer);
        return { storageKey, absolutePath: `/fake/${storageKey}` };
      },
      deleteFile: async (storageKey) => {
        state.storage.delete(storageKey);
        state.deletedStorageKeys.push(storageKey);
      },
      openReadStream: async (storageKey) => {
        const buffer = state.storage.get(storageKey);
        if (!buffer) {
          throw new Error("missing");
        }
        const { Readable } = await import("node:stream");
        return Readable.from(buffer);
      },
    },
    moderationProvider: {
      moderate: async () => ({ signal: moderationSignal }),
    },
    malwareScanProvider: {
      scan: async () => ({ clean: malwareClean }),
    },
    notifyUploaded: (input) => {
      state.notifications.push({ kind: "uploaded", recipientParticipantId: input.recipientParticipantId, uploaderParticipantId: input.uploaderParticipantId });
    },
    notifyReplaced: (input) => {
      state.notifications.push({ kind: "replaced", recipientParticipantId: input.recipientParticipantId, uploaderParticipantId: input.uploaderParticipantId });
    },
    notifyRemoved: (input) => {
      state.notifications.push({ kind: "removed", recipientParticipantId: input.recipientParticipantId, uploaderParticipantId: input.uploaderParticipantId });
    },
    now: () => state.currentTime.toISOString(),
  };
}

describe("Shared Documents authorization (Part 7)", () => {
  it("denies a guest/outsider from uploading or listing", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await assert.rejects(() => uploadSharedDocument(CHANNEL_CONTEXT, OUTSIDER_ID, txtFile(), deps), SharedDocumentAccessDeniedError);
    await assert.rejects(() => listSharedDocuments(CHANNEL_CONTEXT, OUTSIDER_ID, deps), SharedDocumentAccessDeniedError);
  });

  it("allows the Author and an Active Ally to upload", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    const authorUpload = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile(), deps);
    assert.equal(authorUpload.uploadedByParticipantId, AUTHOR_ID);

    const allyUpload = await uploadSharedDocument(CHANNEL_CONTEXT, ALLY_ID, txtFile({ originalName: "ally.txt" }), deps);
    assert.equal(allyUpload.uploadedByParticipantId, ALLY_ID);
  });
});

describe("Shared Documents upload pipeline (Part 3/4/5)", () => {
  it("rejects an invalid file before ever storing or moderating it (Part 3 — never stored as active documents)", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await assert.rejects(
      () => uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile({ originalName: "bad.exe", mimeType: "application/x-msdownload" }), deps),
      SharedDocumentValidationError,
    );

    assert.equal(state.documents.length, 0);
    assert.equal(state.storage.size, 0);
  });

  it("rejects a file flagged by malware scanning before ever storing it", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state, { malwareClean: false });

    await assert.rejects(() => uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile(), deps), SharedDocumentMalwareDetectedError);
    assert.equal(state.documents.length, 0);
  });

  it("stores a non-image document as approved without ever invoking AI moderation (Part 4 — metadata validation only)", async () => {
    const state = buildFakeState();
    let moderationCalls = 0;
    const deps = buildDeps(state);
    deps.moderationProvider.moderate = async () => {
      moderationCalls += 1;
      return { signal: "safe" };
    };

    const view = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile(), deps);

    assert.equal(view.verificationStatus, "approved");
    assert.equal(moderationCalls, 0);
  });

  it("marks an image review_required when the moderation provider cannot confidently classify it (Part 4)", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state, { moderationSignal: "uncertain" });

    const view = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, pngFile(), deps);

    assert.equal(view.verificationStatus, "review_required");
    assert.equal(view.canDownload, true, "review_required documents remain visible/downloadable to the already-authorized audience");
  });

  it("approves an image the moderation provider confidently marks safe", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state, { moderationSignal: "safe" });

    const view = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, pngFile(), deps);
    assert.equal(view.verificationStatus, "approved");
  });

  it("rejects (never stores) an image the moderation provider confidently marks unsafe", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state, { moderationSignal: "unsafe" });

    await assert.rejects(() => uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, pngFile(), deps));
    assert.equal(state.documents.length, 0);
  });
});

describe("Shared Documents notifications (Part 10)", () => {
  it("notifies every other context member but never the uploader", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile(), deps);

    const uploadedNotifications = state.notifications.filter((n) => n.kind === "uploaded");
    assert.deepEqual(uploadedNotifications.map((n) => n.recipientParticipantId), [ALLY_ID]);
    assert.ok(uploadedNotifications.every((n) => n.recipientParticipantId !== AUTHOR_ID));
  });
});

describe("Shared Documents list (Part 11)", () => {
  it("lists latest, non-removed documents newest first", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    state.currentTime = new Date("2090-01-01T00:00:00.000Z");
    await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile({ originalName: "first.txt" }), deps);
    state.currentTime = new Date("2090-01-02T00:00:00.000Z");
    await uploadSharedDocument(CHANNEL_CONTEXT, ALLY_ID, txtFile({ originalName: "second.txt" }), deps);

    const result = await listSharedDocuments(CHANNEL_CONTEXT, AUTHOR_ID, deps);
    const names = result.documents.map((doc) => doc.fileName);

    assert.deepEqual(names, ["second.txt", "first.txt"], "newest upload first");
  });
});

describe("Shared Documents versioning — replace (Part 9)", () => {
  it("creates a new version, marks the prior version superseded, and preserves its family id", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    const original = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile({ originalName: "v1.txt" }), deps);
    state.currentTime = new Date("2090-01-05T00:00:00.000Z");
    const replaced = await replaceSharedDocument(CHANNEL_CONTEXT, original.documentId, AUTHOR_ID, txtFile({ originalName: "v2.txt" }), deps);

    assert.equal(replaced.documentFamilyId, original.documentFamilyId);
    assert.equal(replaced.version, 2);
    assert.equal(replaced.isLatestVersion, true);

    const priorRecord = state.documents.find((doc) => doc.documentId === original.documentId)!;
    assert.equal(priorRecord.isLatestVersion, false);
    assert.ok(priorRecord.supersededAt);
    assert.ok(state.storage.has(priorRecord.storageKey), "replace never deletes the prior version's bytes (Part 9 — never overwrite)");
  });

  it("only the uploader may replace their own document", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const original = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile(), deps);

    await assert.rejects(
      () => replaceSharedDocument(CHANNEL_CONTEXT, original.documentId, ALLY_ID, txtFile({ originalName: "hijack.txt" }), deps),
      SharedDocumentManagerOnlyError,
    );
  });

  it("notifies other context members of a replace", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const original = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile(), deps);

    await replaceSharedDocument(CHANNEL_CONTEXT, original.documentId, AUTHOR_ID, txtFile({ originalName: "v2.txt" }), deps);

    const replacedNotifications = state.notifications.filter((n) => n.kind === "replaced");
    assert.deepEqual(replacedNotifications.map((n) => n.recipientParticipantId), [ALLY_ID]);
  });

  it("excludes the superseded version from the active list, showing only the latest", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const original = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile({ originalName: "v1.txt" }), deps);
    await replaceSharedDocument(CHANNEL_CONTEXT, original.documentId, AUTHOR_ID, txtFile({ originalName: "v2.txt" }), deps);

    const result = await listSharedDocuments(CHANNEL_CONTEXT, AUTHOR_ID, deps);
    assert.equal(result.documents.length, 1);
    assert.equal(result.documents[0]!.fileName, "v2.txt");
  });
});

describe("Shared Documents removal (Part 9/10)", () => {
  it("deletes the file's bytes from storage and excludes it from the active list", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const original = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile(), deps);
    const storageKey = state.documents[0]!.storageKey;

    await removeSharedDocument(CHANNEL_CONTEXT, original.documentId, AUTHOR_ID, deps);

    assert.ok(state.deletedStorageKeys.includes(storageKey));
    const result = await listSharedDocuments(CHANNEL_CONTEXT, AUTHOR_ID, deps);
    assert.equal(result.documents.length, 0);
  });

  it("only the uploader may remove their own document", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const original = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile(), deps);

    await assert.rejects(() => removeSharedDocument(CHANNEL_CONTEXT, original.documentId, ALLY_ID, deps), SharedDocumentManagerOnlyError);
  });

  it("notifies other context members of a removal, and a removed document can never be downloaded again", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const original = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile(), deps);

    await removeSharedDocument(CHANNEL_CONTEXT, original.documentId, AUTHOR_ID, deps);

    const removedNotifications = state.notifications.filter((n) => n.kind === "removed");
    assert.deepEqual(removedNotifications.map((n) => n.recipientParticipantId), [ALLY_ID]);

    await assert.rejects(() => resolveSharedDocumentDownload(CHANNEL_CONTEXT, original.documentId, AUTHOR_ID, deps), SharedDocumentNotFoundError);
  });
});

describe("Shared Documents downloads (Part 8)", () => {
  it("re-verifies context authorization on every download and denies an outsider", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const original = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile(), deps);

    await assert.rejects(
      () => resolveSharedDocumentDownload(CHANNEL_CONTEXT, original.documentId, OUTSIDER_ID, deps),
      SharedDocumentAccessDeniedError,
    );

    const target = await resolveSharedDocumentDownload(CHANNEL_CONTEXT, original.documentId, ALLY_ID, deps);
    assert.equal(target.fileName, "notes.txt");
  });

  it("throws not-found for a document that does not belong to the given context", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const original = await uploadSharedDocument(CHANNEL_CONTEXT, AUTHOR_ID, txtFile(), deps);

    const otherInitiativeContext: SharedDocumentContextRef = { contextType: "collaboration_channel", initiativeId: "other-initiative" };

    await assert.rejects(
      () => resolveSharedDocumentDownload(otherInitiativeContext, original.documentId, AUTHOR_ID, deps),
      SharedDocumentAccessDeniedError,
    );
  });
});
