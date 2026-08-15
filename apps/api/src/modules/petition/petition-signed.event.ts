import type { ParticipationMode } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../infrastructure/events/domain-event.js";

/**
 * Recovery Task 25 Part 3 — the Petition Signature is the owning Aggregate
 * of this event, not the parent Petition: the event represents creation of
 * one specific, independently-identified Signature, and one Signature maps
 * to exactly one event. The Petition remains the parent definition
 * Aggregate and is referenced only through `payload.petitionId`.
 */
export const PETITION_SIGNATURE_AGGREGATE_TYPE = "PetitionSignature" as const;

/**
 * Recovery Task 25 Part 5 — thin, privacy-safe, completed-fact payload.
 *
 * Deliberately excluded: Petition title/statement/requested action,
 * Participant display name/email/IP/auth claims, the full Petition or
 * Signature document, mutable support metrics, outcome, Fair points, Social
 * Activity Score, and any future Participant Action `actionType` (that
 * classification is the future consumer's responsibility, not this
 * producer's — Part 7).
 *
 * `participantId` (Recovery Task 26 Part 4 — corrected from the provisional
 * `memberId` used by Recovery Task 25): the platform is participant-first —
 * every Signature's acting identity is a Participant, and holding Member
 * status is a separate, independent, earned title
 * (`packages/types/src/domain/membership.ts`'s `MembershipSummary
 * .cohortLabel: "Participant" | "Member"` already encodes exactly this
 * distinction). Signing a Petition never requires, checks, or depends on
 * Member status. The field's value type remains the existing account
 * identifier (`MemberId`, matching `Signature.participantId` in
 * `@hu/types`'s `petition/signature.ts` and the already-established
 * `ParticipantId = MemberId` alias used elsewhere in `@hu/types`) — only the
 * *name* was corrected; no new identity system, lookup, or persistence
 * change is introduced by this rename.
 *
 * `participationMode` is carried as `ParticipationMode | null` (never an
 * absent key) so downstream readers never need to distinguish "field
 * omitted" from "no participation mode recorded".
 */
export interface PetitionSignedPayload extends Record<string, unknown> {
  petitionId: string;
  signatureId: string;
  participantId: string;
  initiativeId: string;
  participationMode: ParticipationMode | null;
  signedAt: string;
}

/**
 * Deterministic, replay-safe event identity (Recovery Task 25 Part 10).
 *
 * `signatureId` is itself deterministic — `signature-${petitionId}-${participantId}`
 * (see `petition.store.ts`) — so this event ID is stable across a
 * `runMongoTransaction` retry of the same logical signing attempt, and is
 * naturally one-per-successful-signature because a second signing attempt
 * by the same Participant on the same Petition can never reach this point
 * (the `petition_signatures` unique index on `(petitionId, memberId)` —
 * still the legacy-compatible persistence field name, Recovery Task 26 Part
 * 3/10 — rejects it first, inside the same transaction, before the outbox
 * insert executes).
 */
export function buildPetitionSignedEventId(signatureId: string): string {
  return `petition-signed:${signatureId}`;
}

export function createPetitionSignedEvent(input: {
  petitionId: string;
  signatureId: string;
  participantId: string;
  initiativeId: string;
  participationMode?: ParticipationMode;
  signedAt: string;
  correlationId?: string;
  actorId?: string | null;
}): DomainEvent<PetitionSignedPayload> {
  return createDomainEvent({
    eventId: buildPetitionSignedEventId(input.signatureId),
    eventName: CATALOGUE_EVENTS.petitionSigned,
    aggregateType: PETITION_SIGNATURE_AGGREGATE_TYPE,
    aggregateId: input.signatureId,
    payload: {
      petitionId: input.petitionId,
      signatureId: input.signatureId,
      participantId: input.participantId,
      initiativeId: input.initiativeId,
      participationMode: input.participationMode ?? null,
      signedAt: input.signedAt,
    },
    correlationId: input.correlationId,
    actorId: input.actorId ?? input.participantId,
    occurredAt: input.signedAt,
  });
}
