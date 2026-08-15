import type { InitiativeDecisionVoteChoice } from "@hu/types";

import type { DomainEventSchemaVersion } from "../../../infrastructure/events/domain-event.js";

/**
 * Recovery Task 27 Part 3 — canonical Participant Action domain vocabulary.
 *
 * The platform is participant-first (Recovery Task 26): the durable
 * participation ledger is the "Participant Action Ledger", not a
 * "Member Action Ledger", and `participantId` — never `memberId` — is the
 * canonical actor field on every new ledger record.
 *
 * Recovery Task 33 Part 2 adds the second durable source: Initiative
 * Decision Vote. `initiative_decision_vote_cast` and
 * `initiative_decision_vote_changed` are the only two members added by this
 * task — no `member_vote`, `vote_activity`, `decision_participation`,
 * `initiative_vote`, or `vote_updated` variant was introduced, and the
 * existing `petition_signed` member is untouched.
 */
export type ParticipantActionType =
  | "petition_signed"
  | "initiative_decision_vote_cast"
  | "initiative_decision_vote_changed";

/**
 * Recovery Task 33 Part 3 — the Vote aggregate itself (identified by
 * `voteId`) is the source record for both new action types, never the
 * Collective Decision, the Initiative, the Participant, or the durable
 * event.
 */
export type ParticipantActionSourceType = "petition_signature" | "initiative_decision_vote";

export type ParticipantActionValidityStatus = "valid";

/**
 * Recovery Task 33 Part 7 — narrow, additive, per-action-type metadata.
 *
 * The pre-existing `ParticipantActionRecord` (Task 27) carried no metadata
 * field at all beyond its normalized identity fields — Petition's mapper
 * never needed anything beyond `sourceId`/`occurredAt`/etc. Vote's Cast and
 * Changed facts are not fully reconstructible from the normalized identity
 * fields alone (the task explicitly asks for `choice`/`previousChoice`/
 * `newChoice`/vote-version metadata), so this task follows Part 7's
 * preferred-order guidance down to option 3: "add a narrow typed metadata
 * field only if required". This is a discriminated union (tagged by `kind`,
 * mirroring the existing `kind` discriminant convention in
 * `workspace-home.types.ts`), not an unvalidated arbitrary-JSON bag — every
 * member's fields are typed and are reconstructible directly from the
 * corresponding durable event payload, nothing else.
 */
export interface InitiativeDecisionVoteCastParticipantActionMetadata {
  kind: "initiative_decision_vote_cast";
  decisionId: string;
  choice: InitiativeDecisionVoteChoice;
  voteVersion: number;
}

export interface InitiativeDecisionVoteChangedParticipantActionMetadata {
  kind: "initiative_decision_vote_changed";
  decisionId: string;
  previousChoice: InitiativeDecisionVoteChoice;
  newChoice: InitiativeDecisionVoteChoice;
  previousVoteVersion: number;
  newVoteVersion: number;
}

export type ParticipantActionMetadata =
  | InitiativeDecisionVoteCastParticipantActionMetadata
  | InitiativeDecisionVoteChangedParticipantActionMetadata;

/**
 * Recovery Task 27 Part 4 — thin, append-oriented, event-derived ledger
 * record.
 *
 * Deliberately excluded (Part 4): Petition title/statement, Member status/
 * cohort label/display name, email, the full source event or Petition or
 * Signature, participation score, Fair value, Journey state, recommendation,
 * or a public visibility decision. This record is private internal
 * persistence, not a public Activity or profile artifact.
 *
 * `sourceEventSchemaVersion` intentionally uses the domain event
 * infrastructure's actual runtime schema-version type
 * (`DomainEventSchemaVersion`, currently the string literal `"1.0"` —
 * `../../../infrastructure/events/domain-event.ts`), not a bare `number` as
 * this task's illustrative pseudocode shape suggested. Recovery Task 26
 * established the precedent of correcting a field to match the real,
 * evidence-inspected contract rather than a provisional guess; coercing a
 * dotted version string to a `number` would be lossy and would silently
 * misbehave on a future non-numeric version. No other field name or type
 * departs from the task's specified shape.
 *
 * Recovery Task 33 Part 2/7: `sourceEventName` grows a second and third
 * literal member for the two new durable Vote events; `metadata` is a new,
 * explicit `| null` field (matching the existing explicit-`null` convention
 * already used by `correlationId`/`causationId`, not an optional/undefined
 * field) — `null` for every `petition_signed` record (Petition's mapper
 * needs no metadata) and a typed `ParticipantActionMetadata` value for every
 * Vote-sourced record.
 */
export interface ParticipantActionRecord {
  participantActionId: string;

  participantId: string;
  initiativeId: string;

  actionType: ParticipantActionType;

  sourceType: ParticipantActionSourceType;
  sourceId: string;

  sourceEventId: string;
  sourceEventName: "PetitionSigned" | "InitiativeDecisionVoteCast" | "InitiativeDecisionVoteChanged";
  sourceEventSchemaVersion: DomainEventSchemaVersion;

  occurredAt: string;
  recordedAt: string;

  validityStatus: ParticipantActionValidityStatus;

  correlationId: string | null;
  causationId: string | null;

  metadata: ParticipantActionMetadata | null;
}

/**
 * Recovery Task 27 Part 5 — deterministic, replay-safe Participant Action
 * identity, derived only from the source event's own identity. Never random,
 * never timestamp-only, never dependent on Member status.
 *
 * Recovery Task 33 Part 4 reuses this exact formula unmodified for both Vote
 * action types. Because `InitiativeDecisionVoteCastEvent`'s eventId is keyed
 * on `voteId` and `InitiativeDecisionVoteChangedEvent`'s eventId is keyed on
 * `voteId` + the resulting `newVoteVersion` (Recovery Task 32 Part 7), one
 * Cast event and every distinct committed Changed version each already have
 * a distinct `sourceEventId` — so `participant-action:${sourceEventId}`
 * alone is sufficient to guarantee Cast and Changed actions never collide,
 * and separate Changed versions never collide, with no Vote-specific
 * formula change required.
 */
export function buildParticipantActionId(sourceEventId: string): string {
  return `participant-action:${sourceEventId}`;
}
