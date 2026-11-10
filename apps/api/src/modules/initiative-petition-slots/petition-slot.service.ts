import { randomUUID } from "node:crypto";

import type { ClientSession } from "mongodb";
import type { Petition } from "@hu/types";

import { runMongoTransaction } from "../../infrastructure/mongodb/mongo-transaction.js";
import {
  deletePetitionWorkingDraft,
  deletePublishedPetitionWorkingDraft,
  insertPetitionWorkingDraft,
  listPetitionWorkingDrafts,
  lockPetitionWorkingDraft,
  transferPetitionWorkingDraftLock,
  unlockPetitionWorkingDraft,
} from "../initiative-petition-drafts/petition-working-draft.repository.js";
import type { PetitionWorkingDraft } from "../initiative-petition-drafts/petition-working-draft.types.js";
import {
  countPubliclyVisiblePetitionsByInitiativeId,
  findPetitionById,
} from "../petition/persistence/petition.repository.js";
import { isPetitionPubliclyVisible } from "../petition/petition-public-visibility.js";
import {
  getPetition,
  listPetitionsByInitiativeId,
  onPetitionPublished,
  publishPetitionInSession,
} from "../petition/petition.store.js";
import {
  assignPublicationVersion,
  convertDraftSlotToReservation,
  deleteDraftPetitionSlot,
  deletePetitionSlotByPetitionId,
  deleteReservation,
  ensurePetitionSlotStorageReady,
  finalizeOwnedReservation,
  findMaxPublicationVersion,
  findPetitionSlotByDraftId,
  findPetitionSlotByPetitionId,
  insertPetitionSlot,
  insertReservedPetitionSlot,
  isDuplicateKeyError,
  listExpiredReservations,
  listPetitionSlots,
  markReservationPublished,
  renewReservationLease,
  revertReservationToDraft,
  takeOverExpiredReservation,
} from "./petition-slot.repository.js";
import type { PetitionPublicationReservation, PetitionSlot } from "./petition-slot.types.js";

/**
 * HU-LC-05C.4A — at most three Petition slots per Initiative, shared by working
 * drafts, publications in progress and published Petitions. Drafts release
 * their slot when deleted; published Petitions keep theirs permanently.
 *
 * HU-LC-05C.4A.2 — a publication attempt owns its `reserved` slot through a
 * unique attemptId and a lease kept in MongoDB server time. Only the unexpired
 * owner can make the Petition public, in the same transaction that turns the
 * slot `published`; once the lease expires the attempt can never finalize, so
 * recovery may release the slot if the Petition is not public.
 */
export const PETITION_SLOT_LIMIT = 3;
const SLOT_NUMBERS = Array.from({ length: PETITION_SLOT_LIMIT }, (_, index) => index + 1);
const MAX_ALLOCATION_ATTEMPTS = 5;
const DEFAULT_RESERVATION_LEASE_MS = 120_000;

export class PetitionSlotLimitError extends Error {
  readonly code = "PETITION_SLOT_LIMIT_REACHED";

  constructor() {
    super(
      `Petition limit reached: an Initiative can hold at most ${PETITION_SLOT_LIMIT} Petitions, published or in draft.`,
    );
    this.name = "PetitionSlotLimitError";
  }
}

export class PetitionSlotBusyError extends Error {
  readonly code = "PETITION_SLOT_BUSY";

  constructor() {
    super("Petition slot allocation is busy; please retry.");
    this.name = "PetitionSlotBusyError";
  }
}

export class PetitionPublicationInProgressError extends Error {
  readonly code = "PETITION_PUBLICATION_IN_PROGRESS";

  constructor() {
    super("This Petition is already being published; please retry shortly.");
    this.name = "PetitionPublicationInProgressError";
  }
}

export class PetitionReservationLostError extends Error {
  readonly code = "PETITION_RESERVATION_LOST";

  constructor() {
    super("The Petition publication reservation expired before completion; please retry.");
    this.name = "PetitionReservationLostError";
  }
}

type SlotFault =
  | "after-draft-slot"
  | "after-draft-delete"
  | "crash-after-reserve"
  | "crash-after-prepare"
  | "crash-after-finalize";
let faultForTests: SlotFault | null = null;
let leaseMsForTests: number | null = null;
let finalizePauseForTests: (() => Promise<void>) | null = null;

function assertTestEnvironment(): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Petition slot test hooks are available only when NODE_TEST_ENV=true.");
  }
}

/** Test-only: fail at the matching point. `crash-*` faults simulate a process that stops there. */
export function setPetitionSlotFaultForTests(fault: SlotFault | null): void {
  assertTestEnvironment();
  faultForTests = fault;
}

/** Test-only: shorten the reservation lease. */
export function setPetitionReservationLeaseMsForTests(leaseMs: number | null): void {
  assertTestEnvironment();
  leaseMsForTests = leaseMs;
}

/** Test-only: awaited inside the publication transaction, after the slot is finalized. */
export function setPetitionFinalizePauseForTests(pause: (() => Promise<void>) | null): void {
  assertTestEnvironment();
  finalizePauseForTests = pause;
}

class SimulatedPublicationCrashError extends Error {}

/** A simulated crash skips all compensation, exactly like a process that stopped. */
export function isSimulatedPublicationCrash(error: unknown): boolean {
  return error instanceof SimulatedPublicationCrashError;
}

export function injectPetitionSlotFault(stage: SlotFault): void {
  if (faultForTests !== stage) {
    return;
  }

  if (stage.startsWith("crash-")) {
    throw new SimulatedPublicationCrashError(`Simulated publication crash: ${stage}.`);
  }

  throw new Error(`Injected Petition slot fault: ${stage}.`);
}

function reservationLeaseMs(): number {
  return leaseMsForTests ?? DEFAULT_RESERVATION_LEASE_MS;
}

function freeSlotNumber(slots: readonly PetitionSlot[]): number | null {
  const taken = new Set(slots.map((slot) => slot.slotNumber));
  return SLOT_NUMBERS.find((slotNumber) => !taken.has(slotNumber)) ?? null;
}

type Occupant =
  | { readonly state: "published"; readonly petitionId: string }
  | { readonly state: "draft"; readonly draftId: string };

function holds(slot: PetitionSlot, occupant: Occupant): boolean {
  return occupant.state === "published"
    ? slot.petitionId === occupant.petitionId
    : slot.draftId === occupant.draftId;
}

/** Places one occupant in the lowest free slot; retries when a concurrent writer wins. */
async function occupyFreeSlot(
  initiativeId: string,
  occupant: Occupant,
): Promise<"occupied" | "already" | "full"> {
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const slots = await listPetitionSlots(initiativeId);

    if (slots.some((slot) => holds(slot, occupant))) {
      return "already";
    }

    const slotNumber = freeSlotNumber(slots);

    if (slotNumber === null) {
      return "full";
    }

    try {
      await insertPetitionSlot({
        initiativeId,
        slotNumber,
        state: occupant.state,
        draftId: occupant.state === "draft" ? occupant.draftId : null,
        petitionId: occupant.state === "published" ? occupant.petitionId : null,
        attemptId: null,
        leaseExpiresAt: null,
        createdAt: new Date().toISOString(),
      });
      return "occupied";
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  throw new PetitionSlotBusyError();
}

/**
 * Resolves one reservation whose lease has expired. Conflicts with the owner's
 * publication transaction on the same slot document, so exactly one commits:
 * a public Petition keeps its slot permanently; otherwise the slot is released
 * and the Draft/Ready Petition is left untouched for a retry.
 */
async function recoverExpiredReservation(slot: PetitionSlot): Promise<void> {
  const petitionId = slot.petitionId;

  if (!petitionId) {
    return;
  }

  await runMongoTransaction((session) =>
    releaseReservationInTransaction(
      {
        initiativeId: slot.initiativeId,
        petitionId,
        attemptId: slot.attemptId,
        draftId: slot.draftId,
      },
      { expiredOnly: true },
      session,
    ),
  ).catch((error: unknown) => {
    // The owner or a retry changed the reservation meanwhile; it is no longer expired.
    if (!(error instanceof PetitionReservationLostError)) {
      throw error;
    }
  });
}

/**
 * Ends one reservation inside a transaction. A public Petition keeps the slot
 * permanently. A working draft's converted slot returns to `draft` and the draft
 * is unlocked (HU-LC-05C.4C); any other reservation is released. The Draft/Ready
 * Petition is always kept for a retry.
 */
async function releaseReservationInTransaction(
  reservation: {
    readonly initiativeId: string;
    readonly petitionId: string;
    readonly attemptId: string | null;
    readonly draftId?: string | null;
  },
  options: { expiredOnly: boolean },
  session: ClientSession,
): Promise<boolean> {
  const { initiativeId, petitionId, attemptId } = reservation;
  const petition = await findPetitionById(petitionId, { session });

  if (petition && isPetitionPubliclyVisible(petition.status)) {
    return markReservationPublished(petitionId, attemptId, session);
  }

  if (
    reservation.draftId &&
    (await unlockPetitionWorkingDraft(initiativeId, reservation.draftId, attemptId, session))
  ) {
    if (!(await revertReservationToDraft(petitionId, attemptId, options, session))) {
      throw new PetitionReservationLostError();
    }
    return true;
  }

  return deleteReservation(petitionId, attemptId, options, session);
}

/** Releases every expired reservation of the Initiative whose Petition is not public. */
export async function recoverExpiredPetitionReservations(initiativeId: string): Promise<void> {
  await ensurePetitionSlotStorageReady();

  for (const slot of await listExpiredReservations(initiativeId)) {
    await recoverExpiredReservation(slot);
  }
}

/**
 * Recovers expired reservations, then gives a slot to occupants that predate
 * slot tracking — published Petitions, then working drafts, oldest first —
 * while one is free. Idempotent; never changes a Petition or a draft.
 */
export async function accountExistingPetitionSlotOccupants(initiativeId: string): Promise<void> {
  await recoverExpiredPetitionReservations(initiativeId);

  const slots = await listPetitionSlots(initiativeId);
  const slottedPetitions = new Set(slots.map((slot) => slot.petitionId));
  const slottedDrafts = new Set(slots.map((slot) => slot.draftId));
  const occupants: Occupant[] = [
    ...(await listPetitionsByInitiativeId(initiativeId))
      .filter(
        (petition) =>
          isPetitionPubliclyVisible(petition.status) && !slottedPetitions.has(petition.petitionId),
      )
      .map((petition) => ({ state: "published" as const, petitionId: petition.petitionId })),
    ...(await listPetitionWorkingDrafts(initiativeId))
      .filter((draft) => !slottedDrafts.has(draft.draftId))
      .map((draft) => ({ state: "draft" as const, draftId: draft.draftId })),
  ];

  for (const occupant of occupants) {
    if ((await occupyFreeSlot(initiativeId, occupant)) === "full") {
      return;
    }
  }
}

/** Inserts the draft and its slot in one transaction; 409 when all slots are occupied. */
export async function createWorkingDraftInSlot(
  draft: PetitionWorkingDraft,
): Promise<PetitionWorkingDraft> {
  await accountExistingPetitionSlotOccupants(draft.initiativeId);

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await runMongoTransaction(async (session) => {
        const slotNumber = freeSlotNumber(await listPetitionSlots(draft.initiativeId, session));

        if (slotNumber === null) {
          throw new PetitionSlotLimitError();
        }

        await insertPetitionSlot(
          {
            initiativeId: draft.initiativeId,
            slotNumber,
            state: "draft",
            draftId: draft.draftId,
            petitionId: null,
            attemptId: null,
            leaseExpiresAt: null,
            createdAt: draft.createdAt,
          },
          session,
        );
        injectPetitionSlotFault("after-draft-slot");
        await insertPetitionWorkingDraft(draft, session);
        return draft;
      });
    } catch (error) {
      if (!isDuplicateKeyError(error) || attempt + 1 >= MAX_ALLOCATION_ATTEMPTS) {
        throw error;
      }
    }
  }
}

/** Deletes the draft and releases its slot in one transaction; false when no such draft. */
export async function deleteWorkingDraftAndReleaseSlot(
  initiativeId: string,
  draftId: string,
): Promise<boolean> {
  await ensurePetitionSlotStorageReady();

  return runMongoTransaction(async (session) => {
    if (!(await deletePetitionWorkingDraft(initiativeId, draftId, session))) {
      return false;
    }

    await deleteDraftPetitionSlot(initiativeId, draftId, session);
    injectPetitionSlotFault("after-draft-delete");
    return true;
  });
}

/**
 * Starts a publication attempt: a new `reserved` slot, or an expired reservation
 * of the same Petition taken over by this attempt. Returns null when the Petition
 * already holds a published slot. Throws PetitionPublicationInProgressError while
 * another attempt's lease is active and PetitionSlotLimitError when no slot is free.
 */
export async function reservePetitionPublication(
  initiativeId: string,
  petitionId: string,
): Promise<PetitionPublicationReservation | null> {
  await accountExistingPetitionSlotOccupants(initiativeId);

  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const existing = await findPetitionSlotByPetitionId(petitionId);
    const attemptId = randomUUID();

    if (existing) {
      if (existing.initiativeId !== initiativeId) {
        throw new Error("Petition belongs to another Initiative.");
      }

      if (existing.state === "published") {
        return null;
      }

      if (
        await takeOverExpiredReservation(
          petitionId,
          existing.attemptId,
          attemptId,
          reservationLeaseMs(),
        )
      ) {
        return { initiativeId, petitionId, attemptId };
      }

      const current = await findPetitionSlotByPetitionId(petitionId);

      if (current?.state === "reserved" && current.attemptId === existing.attemptId) {
        throw new PetitionPublicationInProgressError();
      }

      continue;
    }

    const slotNumber = freeSlotNumber(await listPetitionSlots(initiativeId));

    if (slotNumber === null) {
      throw new PetitionSlotLimitError();
    }

    try {
      await insertReservedPetitionSlot(
        { initiativeId, slotNumber, petitionId, attemptId },
        reservationLeaseMs(),
      );
      return { initiativeId, petitionId, attemptId };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  throw new PetitionSlotBusyError();
}

/**
 * HU-LC-05C.4C — starts the publication of a working draft in the draft's own
 * slot (draft → reserved), locking the draft against edits in the same
 * transaction; or takes over this draft's expired reservation. Never allocates
 * another slot. Returns null when the draft's slot is already published.
 * Throws PetitionPublicationInProgressError while another attempt's lease is
 * active and PetitionSlotLimitError when the draft holds no slot.
 */
export async function reserveWorkingDraftPublication(
  initiativeId: string,
  draftId: string,
  petitionId: string,
): Promise<PetitionPublicationReservation | null> {
  await accountExistingPetitionSlotOccupants(initiativeId);

  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const slot = await findPetitionSlotByDraftId(initiativeId, draftId);

    if (!slot) {
      // A draft that predates slot tracking found no free slot.
      throw new PetitionSlotLimitError();
    }

    if (slot.state === "published") {
      return null;
    }

    if (slot.state === "reserved" && slot.petitionId !== petitionId) {
      throw new Error("This Petition draft is not available for publication.");
    }

    const attemptId = randomUUID();
    const reservation = { initiativeId, petitionId, attemptId, draftId };
    const acquired = await runMongoTransaction(async (session) => {
      const slotAcquired =
        slot.state === "draft"
          ? await convertDraftSlotToReservation(reservation, reservationLeaseMs(), session)
          : await takeOverExpiredReservation(
              petitionId,
              slot.attemptId,
              attemptId,
              reservationLeaseMs(),
              session,
            );

      if (!slotAcquired) {
        return false;
      }

      const draftLocked =
        slot.state === "draft"
          ? await lockPetitionWorkingDraft(initiativeId, draftId, attemptId, session)
          : await transferPetitionWorkingDraftLock(
              initiativeId,
              draftId,
              slot.attemptId,
              attemptId,
              session,
            );

      if (!draftLocked) {
        throw new Error("Petition draft not found.");
      }

      return true;
    });

    if (acquired) {
      return reservation;
    }

    const current = await findPetitionSlotByDraftId(initiativeId, draftId);

    if (
      slot.state === "reserved" &&
      current?.state === "reserved" &&
      current.attemptId === slot.attemptId
    ) {
      throw new PetitionPublicationInProgressError();
    }
  }

  throw new PetitionSlotBusyError();
}

/** The published slot that a working draft's own publication produced, if any. */
export async function findPublishedSlotOfWorkingDraft(
  initiativeId: string,
  draftId: string,
  petitionId: string,
): Promise<PetitionSlot | null> {
  const slot = await findPetitionSlotByPetitionId(petitionId);

  return slot?.state === "published" &&
    slot.initiativeId === initiativeId &&
    slot.draftId === draftId
    ? slot
    : null;
}

/** Extends the owner's lease before a long step; throws when the reservation was lost. */
export async function renewPetitionPublicationReservation(
  reservation: PetitionPublicationReservation,
): Promise<void> {
  if (
    !(await renewReservationLease(
      reservation.petitionId,
      reservation.attemptId,
      reservationLeaseMs(),
    ))
  ) {
    throw new PetitionReservationLostError();
  }
}

/**
 * HU-LC-05C.4C — the next lifecycle publication version of the Initiative:
 * above every stored version and above the positional versions earlier
 * publications used (at most the number of other public Petitions).
 */
async function allocatePublicationVersion(
  reservation: PetitionPublicationReservation,
  session: ClientSession,
): Promise<number> {
  const [maxStored, otherPublic] = await Promise.all([
    findMaxPublicationVersion(reservation.initiativeId, session),
    countPubliclyVisiblePetitionsByInitiativeId(
      reservation.initiativeId,
      reservation.petitionId,
      session,
    ),
  ]);
  const publicationVersion = Math.max(maxStored, otherPublic) + 1;

  if (
    !(await assignPublicationVersion(
      reservation.petitionId,
      reservation.attemptId,
      publicationVersion,
      session,
    ))
  ) {
    throw new PetitionReservationLostError();
  }

  return publicationVersion;
}

async function runFinalizeTransaction(
  reservation: PetitionPublicationReservation,
  options: Parameters<typeof finalizePetitionPublication>[1] = {},
): Promise<Petition> {
  const draftId = reservation.draftId ?? null;

  // A concurrent publication of the same Initiative may claim the same version
  // first; the unique (initiativeId, publicationVersion) index then rejects this
  // transaction, and it is retried with the next version.
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await runMongoTransaction(async (session) => {
        if (
          !(await finalizeOwnedReservation(reservation.petitionId, reservation.attemptId, session))
        ) {
          throw new PetitionReservationLostError();
        }

        await finalizePauseForTests?.();
        const petition = await publishPetitionInSession(reservation.petitionId, session);

        if (draftId) {
          const publicationVersion = await allocatePublicationVersion(reservation, session);

          if (
            !(await deletePublishedPetitionWorkingDraft(
              reservation.initiativeId,
              draftId,
              reservation.attemptId,
              session,
            ))
          ) {
            throw new PetitionReservationLostError();
          }

          await options.onPublishedInTransaction?.(session, publicationVersion);
        }

        return petition;
      });
    } catch (error) {
      if (!draftId || !isDuplicateKeyError(error) || attempt + 1 >= MAX_ALLOCATION_ATTEMPTS) {
        throw error;
      }
    }
  }
}

async function finalizedByThisAttempt(
  reservation: PetitionPublicationReservation,
): Promise<Petition | null> {
  const slot = await findPetitionSlotByPetitionId(reservation.petitionId);

  if (slot?.state !== "published" || slot.attemptId !== reservation.attemptId) {
    return null;
  }

  const petition = await getPetition(reservation.petitionId);
  return petition && isPetitionPubliclyVisible(petition.status) ? petition : null;
}

/**
 * Makes the Ready Petition public. One transaction validates the owner and its
 * unexpired lease (server time), turns the slot `published` and moves the
 * Petition to Published. Side effects run only after commit. If the commit
 * outcome is unknown, the slot's attemptId shows whether this attempt won.
 */
export async function finalizePetitionPublication(
  reservation: PetitionPublicationReservation,
  options: {
    /**
     * HU-LC-05C.4C — working-draft publication only: runs inside the finalizing
     * transaction with the allocated publication version (e.g. to enqueue the
     * publication event in the transactional outbox).
     */
    readonly onPublishedInTransaction?: (
      session: ClientSession,
      publicationVersion: number,
    ) => Promise<void>;
  } = {},
): Promise<Petition> {
  let petition: Petition;

  try {
    petition = await runFinalizeTransaction(reservation, options);
  } catch (error) {
    const committed = await finalizedByThisAttempt(reservation).catch(() => null);

    if (!committed) {
      throw error;
    }

    petition = committed;
  }

  onPetitionPublished(reservation.petitionId);
  return petition;
}

/**
 * Ready → Published for a Petition whose slot is already `published` (no new
 * reservation). The store refuses the transition without that slot.
 */
export async function publishPetitionInPublishedSlot(petitionId: string): Promise<Petition> {
  const petition = await runMongoTransaction((session) =>
    publishPetitionInSession(petitionId, session),
  );
  onPetitionPublished(petitionId);
  return petition;
}

/**
 * HU-LC-05C.4A.3 — the shared publication contract for an existing Ready
 * Petition: one reservation per call, atomic publication by its owner, release
 * on failure. Used by the HTTP route and internal scripts; the lifecycle path
 * reserves before creating its Petition and then calls
 * `finalizePetitionPublication` itself. Null when the Petition does not exist.
 */
export async function publishPetitionWithinSlotLimit(petitionId: string): Promise<Petition | null> {
  const target = await getPetition(petitionId);

  if (!target) {
    return null;
  }

  const reservation = await reservePetitionPublication(target.subject.initiativeId, petitionId);

  try {
    return reservation
      ? await finalizePetitionPublication(reservation)
      : await publishPetitionInPublishedSlot(petitionId);
  } catch (error) {
    if (reservation) {
      await releasePetitionPublicationReservation(reservation).catch(() => undefined);
    }
    throw error;
  }
}

/**
 * Verification-script cleanup: removes the slot of a Petition that no longer
 * exists. Never touches the slot of an existing Petition.
 */
export async function deleteSlotOfDeletedPetitionForTests(petitionId: string): Promise<void> {
  if (await getPetition(petitionId)) {
    throw new Error("Refusing to delete the slot of an existing Petition.");
  }

  await deletePetitionSlotByPetitionId(petitionId);
}

/**
 * Abandons this attempt's reservation. Only the owner's own `reserved` slot is
 * touched; a Petition that is already public keeps the slot permanently.
 */
export async function releasePetitionPublicationReservation(
  reservation: PetitionPublicationReservation,
): Promise<void> {
  await runMongoTransaction((session) =>
    releaseReservationInTransaction(reservation, { expiredOnly: false }, session),
  );
}
