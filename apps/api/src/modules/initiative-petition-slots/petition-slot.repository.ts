import type { ClientSession, Filter } from "mongodb";

import { isExplicitIsolatedMongoTest } from "../../infrastructure/mongodb/explicit-isolated-mongo-test.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import type { PetitionSlot } from "./petition-slot.types.js";

/** Petition persistence is MongoDB-only; tests use an explicitly isolated hu_test_ database. */
export async function ensurePetitionSlotStorageReady(): Promise<void> {
  if (process.env.NODE_TEST_ENV === "true" && !isExplicitIsolatedMongoTest()) {
    throw new Error("Petition slot storage is unavailable: MongoDB skipped in NODE_TEST_ENV.");
  }

  if (!isMongoConfigured()) {
    throw new Error("Petition slot storage is unavailable: MongoDB is not configured.");
  }

  await connectMongoClient();
}

function collection() {
  return getMongoCollection<PetitionSlot>(MONGO_COLLECTIONS.initiativePetitionSlots);
}

const WITHOUT_MONGO_ID = { projection: { _id: 0 } } as const;

// Lease checks always use MongoDB server time ($$NOW), never an API instance clock.
const LEASE_ACTIVE = { $expr: { $gt: ["$leaseExpiresAt", "$$NOW"] } };
const LEASE_EXPIRED = { $expr: { $lte: ["$leaseExpiresAt", "$$NOW"] } };

const leaseFromNow = (leaseMs: number) => ({ $add: ["$$NOW", leaseMs] });

function ownedReservation(petitionId: string, attemptId: string): Filter<PetitionSlot> {
  return { petitionId, attemptId, state: "reserved" };
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

export async function listPetitionSlots(
  initiativeId: string,
  session?: ClientSession,
): Promise<PetitionSlot[]> {
  return collection()
    .find({ initiativeId }, { ...WITHOUT_MONGO_ID, session })
    .sort({ slotNumber: 1 })
    .toArray();
}

export async function findPetitionSlotByPetitionId(
  petitionId: string,
  session?: ClientSession,
): Promise<PetitionSlot | null> {
  return collection().findOne({ petitionId }, { ...WITHOUT_MONGO_ID, session });
}

/** Raw insert: a duplicate-key error means the slot (or occupant) was taken concurrently. */
export async function insertPetitionSlot(
  slot: PetitionSlot,
  session?: ClientSession,
): Promise<void> {
  await collection().insertOne({ ...slot }, { session });
}

/**
 * Inserts a `reserved` slot owned by `attemptId` with a server-time lease. The
 * filter never matches an existing document (attemptId is new), so this always
 * inserts; a duplicate-key error means the slot or the Petition is already taken.
 */
export async function insertReservedPetitionSlot(
  reservation: { initiativeId: string; slotNumber: number; petitionId: string; attemptId: string },
  leaseMs: number,
): Promise<void> {
  await collection().updateOne(
    { ...reservation },
    [
      {
        $set: {
          state: "reserved",
          draftId: null,
          leaseExpiresAt: leaseFromNow(leaseMs),
          createdAt: { $dateToString: { date: "$$NOW", format: "%Y-%m-%dT%H:%M:%S.%LZ" } },
        },
      },
    ],
    { upsert: true },
  );
}

/** Transfers an expired reservation to a new attempt; false when it is still active or changed. */
export async function takeOverExpiredReservation(
  petitionId: string,
  previousAttemptId: string | null,
  attemptId: string,
  leaseMs: number,
  session?: ClientSession,
): Promise<boolean> {
  const result = await collection().updateOne(
    { petitionId, attemptId: previousAttemptId, state: "reserved", ...LEASE_EXPIRED },
    [{ $set: { attemptId, leaseExpiresAt: leaseFromNow(leaseMs) } }],
    { session },
  );
  return result.matchedCount === 1;
}

export async function findPetitionSlotByDraftId(
  initiativeId: string,
  draftId: string,
  session?: ClientSession,
): Promise<PetitionSlot | null> {
  return collection().findOne({ initiativeId, draftId }, { ...WITHOUT_MONGO_ID, session });
}

/**
 * HU-LC-05C.4C — converts a working draft's own slot into a reservation for the
 * draft's Petition (draft → reserved). The slot number and draftId are kept, so
 * publication never allocates another slot.
 */
export async function convertDraftSlotToReservation(
  input: { initiativeId: string; draftId: string; petitionId: string; attemptId: string },
  leaseMs: number,
  session: ClientSession,
): Promise<boolean> {
  const result = await collection().updateOne(
    { initiativeId: input.initiativeId, draftId: input.draftId, state: "draft" },
    [
      {
        $set: {
          state: "reserved",
          petitionId: input.petitionId,
          attemptId: input.attemptId,
          leaseExpiresAt: leaseFromNow(leaseMs),
        },
      },
    ],
    { session },
  );
  return result.matchedCount === 1;
}

/** Returns a converted reservation to its working draft (reserved → draft); never a published slot. */
export async function revertReservationToDraft(
  petitionId: string,
  attemptId: string | null,
  options: { expiredOnly: boolean },
  session: ClientSession,
): Promise<boolean> {
  const result = await collection().updateOne(
    {
      petitionId,
      attemptId,
      state: "reserved",
      draftId: { $type: "string" },
      ...(options.expiredOnly ? LEASE_EXPIRED : {}),
    },
    { $set: { state: "draft", petitionId: null, attemptId: null, leaseExpiresAt: null } },
    { session },
  );
  return result.matchedCount === 1;
}

/** Highest publication version stored for the Initiative (0 when none). */
export async function findMaxPublicationVersion(
  initiativeId: string,
  session: ClientSession,
): Promise<number> {
  const latest = await collection().findOne(
    { initiativeId, publicationVersion: { $gte: 1 } },
    { projection: { _id: 0, publicationVersion: 1 }, sort: { publicationVersion: -1 }, session },
  );
  return latest?.publicationVersion ?? 0;
}

/** Records the publication version on the slot this attempt has just published. */
export async function assignPublicationVersion(
  petitionId: string,
  attemptId: string,
  publicationVersion: number,
  session: ClientSession,
): Promise<boolean> {
  const result = await collection().updateOne(
    { petitionId, attemptId, state: "published" },
    { $set: { publicationVersion } },
    { session },
  );
  return result.matchedCount === 1;
}

/** Extends the owner's lease; false when the lease already expired or ownership was lost. */
export async function renewReservationLease(
  petitionId: string,
  attemptId: string,
  leaseMs: number,
): Promise<boolean> {
  const result = await collection().updateOne(
    { ...ownedReservation(petitionId, attemptId), ...LEASE_ACTIVE },
    [{ $set: { leaseExpiresAt: leaseFromNow(leaseMs) } }],
  );
  return result.matchedCount === 1;
}

/** Inside the publication transaction: reserved → published, only for the unexpired owner. */
export async function finalizeOwnedReservation(
  petitionId: string,
  attemptId: string,
  session: ClientSession,
): Promise<boolean> {
  const result = await collection().updateOne(
    { ...ownedReservation(petitionId, attemptId), ...LEASE_ACTIVE },
    { $set: { state: "published", leaseExpiresAt: null } },
    { session },
  );
  return result.matchedCount === 1;
}

/** Records that the reserved Petition is already public; the slot becomes permanent. */
export async function markReservationPublished(
  petitionId: string,
  attemptId: string | null,
  session: ClientSession,
): Promise<boolean> {
  const result = await collection().updateOne(
    { petitionId, attemptId, state: "reserved" },
    { $set: { state: "published", leaseExpiresAt: null } },
    { session },
  );
  return result.matchedCount === 1;
}

/** Deletes a reservation held by `attemptId`; `expiredOnly` for recovery of other attempts. */
export async function deleteReservation(
  petitionId: string,
  attemptId: string | null,
  options: { expiredOnly: boolean },
  session: ClientSession,
): Promise<boolean> {
  const result = await collection().deleteOne(
    {
      petitionId,
      attemptId,
      state: "reserved",
      ...(options.expiredOnly ? LEASE_EXPIRED : {}),
    },
    { session },
  );
  return result.deletedCount === 1;
}

export async function listExpiredReservations(initiativeId: string): Promise<PetitionSlot[]> {
  return collection()
    .find({ initiativeId, state: "reserved", ...LEASE_EXPIRED }, WITHOUT_MONGO_ID)
    .toArray();
}

/** Cleanup only, for a Petition that no longer exists (see the slot service). */
export async function deletePetitionSlotByPetitionId(petitionId: string): Promise<number> {
  await ensurePetitionSlotStorageReady();
  const result = await collection().deleteMany({ petitionId });
  return result.deletedCount;
}

/** Releases a working draft's slot; reserved and published slots are never matched. */
export async function deleteDraftPetitionSlot(
  initiativeId: string,
  draftId: string,
  session?: ClientSession,
): Promise<number> {
  const result = await collection().deleteMany(
    { initiativeId, draftId, state: "draft" },
    { session },
  );
  return result.deletedCount;
}
