import { randomUUID } from "node:crypto";

import type { Petition } from "@hu/types";

import { runMongoTransaction } from "../../infrastructure/mongodb/mongo-transaction.js";
import {
  deletePetitionWorkingDraft,
  insertPetitionWorkingDraft,
  listPetitionWorkingDrafts,
} from "../initiative-petition-drafts/petition-working-draft.repository.js";
import type { PetitionWorkingDraft } from "../initiative-petition-drafts/petition-working-draft.types.js";
import { findPetitionById } from "../petition/persistence/petition.repository.js";
import { isPetitionPubliclyVisible } from "../petition/petition-public-visibility.js";
import {
  getPetition,
  listPetitionsByInitiativeId,
  onPetitionPublished,
  publishPetitionInSession,
} from "../petition/petition.store.js";
import {
  deleteDraftPetitionSlot,
  deletePetitionSlotByPetitionId,
  deleteReservation,
  ensurePetitionSlotStorageReady,
  finalizeOwnedReservation,
  findPetitionSlotByPetitionId,
  insertPetitionSlot,
  insertReservedPetitionSlot,
  isDuplicateKeyError,
  listExpiredReservations,
  listPetitionSlots,
  markReservationPublished,
  renewReservationLease,
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
  "after-draft-slot" | "after-draft-delete" | "crash-after-reserve" | "crash-after-prepare";
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

  await runMongoTransaction(async (session) => {
    const petition = await findPetitionById(petitionId, { session });

    if (petition && isPetitionPubliclyVisible(petition.status)) {
      return markReservationPublished(petitionId, slot.attemptId, session);
    }

    return deleteReservation(petitionId, slot.attemptId, { expiredOnly: true }, session);
  });
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
): Promise<Petition> {
  let petition: Petition;

  try {
    petition = await runMongoTransaction(async (session) => {
      if (
        !(await finalizeOwnedReservation(reservation.petitionId, reservation.attemptId, session))
      ) {
        throw new PetitionReservationLostError();
      }

      await finalizePauseForTests?.();
      return publishPetitionInSession(reservation.petitionId, session);
    });
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
  await runMongoTransaction(async (session) => {
    const petition = await findPetitionById(reservation.petitionId, { session });

    if (petition && isPetitionPubliclyVisible(petition.status)) {
      return markReservationPublished(reservation.petitionId, reservation.attemptId, session);
    }

    return deleteReservation(
      reservation.petitionId,
      reservation.attemptId,
      { expiredOnly: false },
      session,
    );
  });
}
