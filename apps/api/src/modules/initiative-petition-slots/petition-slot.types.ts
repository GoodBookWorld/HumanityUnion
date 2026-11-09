/**
 * HU-LC-05C.4A — one occupied Petition slot of an Initiative. A slot holds an
 * unpublished working draft (released when the draft is deleted), a Petition
 * publication in progress (`reserved`, owned by one attempt until its lease
 * expires), or a published Petition (never released). `slotNumber` is an
 * allocation position only; it is not a publication event version.
 */
export type PetitionSlotState = "draft" | "reserved" | "published";

export interface PetitionSlot {
  readonly initiativeId: string;
  readonly slotNumber: number;
  readonly state: PetitionSlotState;
  readonly draftId: string | null;
  readonly petitionId: string | null;
  /** The publication attempt that owns (`reserved`) or finalized (`published`) the slot. */
  readonly attemptId: string | null;
  /** MongoDB server time; set only while `reserved`. */
  readonly leaseExpiresAt: Date | null;
  readonly createdAt: string;
}

/** Proof of ownership of a `reserved` slot, held by one publication attempt. */
export interface PetitionPublicationReservation {
  readonly initiativeId: string;
  readonly petitionId: string;
  readonly attemptId: string;
}
