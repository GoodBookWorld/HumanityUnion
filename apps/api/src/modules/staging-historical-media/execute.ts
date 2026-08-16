import path from "node:path";

import type { Db, Document, MongoClient } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { MediaUploadService } from "../media-upload/media-upload.service.js";
import type { MediaObjectStorage } from "../media-upload/media-object-storage.js";
import {
  listAllMediaUploadRecords,
} from "../media-upload/persistence/media-upload.repository.js";
import { STAGING_ADMIN_MEMBER_ID, STAGING_ADMIN_USER_ID } from "./constants.js";
import { StagingHistoricalMediaError } from "./guards.js";
import type { MediaMigrationPlan } from "./plan.js";
import { buildMediaMigrationPlan } from "./plan.js";
import {
  loadAndValidatePortableMediaSource,
  readBundleFile,
  type LoadedPortableMediaSource,
} from "./portable-media-bundle.js";

function extensionFromFilename(filename: string): string {
  const ext = path.extname(filename);
  return ext || ".bin";
}

export async function loadTargetMediaContext(input: {
  client: MongoClient;
  targetDatabase: string;
  portable: LoadedPortableMediaSource;
  storage: MediaObjectStorage;
}): Promise<MediaMigrationPlan> {
  const db = input.client.db(input.targetDatabase);

  const initiativeDocs = await db.collection(MONGO_COLLECTIONS.initiatives).find({}).toArray();
  const initiativesById = new Map<
    string,
    {
      metadata?: {
        imageUrl?: string;
        coverMedia?: { url?: string; type?: string; verificationStatus?: string; createdAt?: string };
        imageAltText?: string;
      };
    }
  >();
  for (const doc of initiativeDocs) {
    const id = String(doc._id ?? doc.initiativeId ?? "");
    if (!id) continue;
    initiativesById.set(id, {
      metadata: (doc.metadata as {
        imageUrl?: string;
        coverMedia?: { url?: string; type?: string; verificationStatus?: string; createdAt?: string };
        imageAltText?: string;
      }) ?? {},
    });
  }

  const authDocs = await db
    .collection(MONGO_COLLECTIONS.authUsers)
    .find({}, { projection: { userId: 1, memberId: 1, role: 1 } })
    .toArray();
  const authByMemberId = new Map<string, { userId: string; memberId: string; role?: string }>();
  for (const doc of authDocs) {
    const memberId = String(doc.memberId ?? "");
    const userId = String(doc.userId ?? "");
    if (!memberId || !userId) continue;
    authByMemberId.set(memberId, {
      userId,
      memberId,
      role: doc.role ? String(doc.role) : undefined,
    });
  }

  const profileDocs = await db
    .collection(MONGO_COLLECTIONS.memberProfiles)
    .find({}, { projection: { userId: 1, avatarUrl: 1 } })
    .toArray();
  const profilesByUserId = new Map<string, { avatarUrl?: string; userId: string }>();
  for (const doc of profileDocs) {
    const userId = String(doc.userId ?? "");
    if (!userId) continue;
    profilesByUserId.set(userId, {
      userId,
      avatarUrl: typeof doc.avatarUrl === "string" ? doc.avatarUrl : undefined,
    });
  }

  const existingMediaByStorageKey = new Map<string, { mediaUrl: string; storageKey: string }>();
  try {
    const records = await listAllMediaUploadRecords();
    for (const record of records) {
      existingMediaByStorageKey.set(record.storageKey, {
        mediaUrl: record.mediaUrl,
        storageKey: record.storageKey,
      });
    }
  } catch {
    // Mongo media metadata optional during dry-run planning if repository not ready.
  }

  // Also scan target media_upload_records directly (script may not have hydrated memory store).
  const mediaDocs = await db.collection(MONGO_COLLECTIONS.mediaUploadRecords).find({}).toArray();
  for (const doc of mediaDocs) {
    const storageKey = String(doc.storageKey ?? "");
    const mediaUrl = String(doc.mediaUrl ?? "");
    if (storageKey && mediaUrl) {
      existingMediaByStorageKey.set(storageKey, { storageKey, mediaUrl });
    }
  }

  return buildMediaMigrationPlan({
    targetDatabase: input.targetDatabase,
    portable: input.portable,
    buildPublicUrl: (key) => input.storage.buildPublicUrl(key),
    initiativesById,
    profilesByUserId,
    authByMemberId,
    existingMediaByStorageKey,
  });
}

export interface MediaMigrationWriteSummary {
  mode: "execute";
  uploaded: { initiatives: number; avatars: number };
  updated: { initiatives: number; avatars: number };
  skipped: { initiatives: number; avatars: number };
  stagingAdminUntouched: boolean;
  confirmation: string;
}

export async function executeStagingHistoricalMediaMigration(input: {
  client: MongoClient;
  targetDatabase: string;
  portable: LoadedPortableMediaSource;
  storage: MediaObjectStorage;
  plan: MediaMigrationPlan;
}): Promise<MediaMigrationWriteSummary> {
  if (input.plan.conflicts.length > 0) {
    throw new StagingHistoricalMediaError(
      `Refusing execute: plan has conflicts: ${input.plan.conflicts.join("; ")}`,
    );
  }

  const db = input.client.db(input.targetDatabase);
  const adminBefore = await db.collection(MONGO_COLLECTIONS.authUsers).findOne({
    userId: STAGING_ADMIN_USER_ID,
  });
  const adminProfileBefore = await db.collection(MONGO_COLLECTIONS.memberProfiles).findOne({
    userId: STAGING_ADMIN_USER_ID,
  });

  const uploader = new MediaUploadService(input.storage);
  const summary: MediaMigrationWriteSummary = {
    mode: "execute",
    uploaded: { initiatives: 0, avatars: 0 },
    updated: { initiatives: 0, avatars: 0 },
    skipped: { initiatives: 0, avatars: 0 },
    stagingAdminUntouched: false,
    confirmation: "",
  };

  for (const item of input.plan.initiatives) {
    if (item.action === "skip_already_canonical") {
      summary.skipped.initiatives += 1;
      continue;
    }
    if (item.action === "missing_target" || item.action === "conflict") {
      throw new StagingHistoricalMediaError(`Cannot execute Initiative plan item ${item.initiativeId}`);
    }

    const cover = input.portable.manifest.initiativeCovers.find(
      (entry) => entry.initiativeId === item.initiativeId,
    );
    if (!cover) {
      throw new StagingHistoricalMediaError(`Missing cover entry ${item.initiativeId}`);
    }

    let mediaUrl = item.plannedPublicUrl;
    if (item.action === "upload_and_update") {
      const buffer = readBundleFile(input.portable.bundleDir, cover.bundleRelativePath);
      const record = await uploader.uploadMedia({
        purpose: "initiative-image",
        file: {
          buffer,
          mimeType: cover.contentType,
          extension: extensionFromFilename(cover.sourceFilename),
          size: buffer.length,
          width: 1,
          height: 1,
        },
        ownerUserId: "system-media-recovery",
        ownerParticipantId: "system-media-recovery",
        initiativeId: cover.initiativeId,
        storageKey: cover.destinationObjectKey,
      });
      mediaUrl = record.mediaUrl;
      summary.uploaded.initiatives += 1;
    }

    await updateInitiativeMediaFields(db, cover.initiativeId, mediaUrl);
    summary.updated.initiatives += 1;
  }

  for (const item of input.plan.avatars) {
    if (item.action === "skip_already_canonical") {
      summary.skipped.avatars += 1;
      continue;
    }
    if (item.action === "unresolved") {
      continue;
    }
    if (
      item.memberId === STAGING_ADMIN_MEMBER_ID ||
      item.userId === STAGING_ADMIN_USER_ID ||
      item.action === "conflict" ||
      item.action === "missing_target"
    ) {
      throw new StagingHistoricalMediaError(`Cannot execute avatar plan item ${item.key}`);
    }

    const avatar = input.portable.manifest.participantAvatars.find((entry) => entry.key === item.key);
    if (!avatar || !item.plannedPublicUrl || !item.destinationObjectKey) {
      throw new StagingHistoricalMediaError(`Missing avatar entry ${item.key}`);
    }

    let mediaUrl = item.plannedPublicUrl;
    if (item.action === "upload_and_update") {
      const buffer = readBundleFile(input.portable.bundleDir, avatar.bundleRelativePath);
      const record = await uploader.uploadMedia({
        purpose: "avatar",
        file: {
          buffer,
          mimeType: avatar.contentType,
          extension: extensionFromFilename(avatar.sourceFilename),
          size: buffer.length,
          width: 1,
          height: 1,
        },
        ownerUserId: avatar.userId,
        ownerParticipantId: avatar.memberId,
        storageKey: avatar.destinationObjectKey,
      });
      mediaUrl = record.mediaUrl;
      summary.uploaded.avatars += 1;
    }

    await db.collection(MONGO_COLLECTIONS.memberProfiles).updateOne(
      { userId: avatar.userId },
      {
        $set: {
          avatarUrl: mediaUrl,
          updatedAt: new Date().toISOString(),
        },
      },
    );
    summary.updated.avatars += 1;
  }

  const adminAfter = await db.collection(MONGO_COLLECTIONS.authUsers).findOne({
    userId: STAGING_ADMIN_USER_ID,
  });
  const adminProfileAfter = await db.collection(MONGO_COLLECTIONS.memberProfiles).findOne({
    userId: STAGING_ADMIN_USER_ID,
  });

  summary.stagingAdminUntouched =
    String(adminBefore?.userId ?? "") === String(adminAfter?.userId ?? "") &&
    String(adminBefore?.memberId ?? "") === String(adminAfter?.memberId ?? "") &&
    String(adminBefore?.email ?? "") === String(adminAfter?.email ?? "") &&
    String(adminBefore?.role ?? "") === "admin" &&
    String(adminProfileBefore?.avatarUrl ?? "") === String(adminProfileAfter?.avatarUrl ?? "");

  if (!summary.stagingAdminUntouched) {
    throw new StagingHistoricalMediaError(
      "Post-migration assertion failed: staging administrator media/identity changed.",
    );
  }

  // Pack 04: Mongo writes alone do not refresh the in-memory Initiative adapter.
  // Request hydrate so public projections stop serving stale localhost URLs
  // without requiring an operator to guess that an API restart is needed.
  try {
    const { hydrateInitiativeMongoPersistence } = await import(
      "../initiatives/persistence/initiative-mongo.persistence.js"
    );
    await hydrateInitiativeMongoPersistence();
  } catch {
    // Hydrate is best-effort in migration scripts; operator may still restart API.
  }

  summary.confirmation =
    "STAGING MEDIA WRITE COMPLETE for approved Initiative covers + historical Participant avatars only.";
  return summary;
}

async function updateInitiativeMediaFields(
  db: Db,
  initiativeId: string,
  mediaUrl: string,
): Promise<void> {
  const existing = await db
    .collection(MONGO_COLLECTIONS.initiatives)
    .findOne({ _id: initiativeId } as Document);
  if (!existing) {
    throw new StagingHistoricalMediaError(`Initiative ${initiativeId} disappeared during execute.`);
  }

  const metadata = (existing.metadata as Record<string, unknown> | undefined) ?? {};
  const priorCover =
    metadata.coverMedia && typeof metadata.coverMedia === "object"
      ? (metadata.coverMedia as Record<string, unknown>)
      : {};

  const coverMedia = {
    type: "image",
    url: mediaUrl,
    verificationStatus:
      typeof priorCover.verificationStatus === "string"
        ? priorCover.verificationStatus
        : "approved",
    createdAt:
      typeof priorCover.createdAt === "string" ? priorCover.createdAt : new Date().toISOString(),
  };

  await db.collection(MONGO_COLLECTIONS.initiatives).updateOne(
    { _id: initiativeId } as Document,
    {
      $set: {
        "metadata.imageUrl": mediaUrl,
        "metadata.coverMedia": coverMedia,
        updatedAt: new Date().toISOString(),
      },
    },
  );
}

export function loadPortableMediaOrThrow(bundleDir: string): LoadedPortableMediaSource {
  return loadAndValidatePortableMediaSource(bundleDir);
}
