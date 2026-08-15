/**
 * Initiative Lifecycle — Part F, Section 7/8 (Representative Signatures).
 *
 * A lightweight, cookie-scoped "civic interest" signal from an unregistered
 * Visitor viewing a Published Petition — mirrors
 * `InitiativeSupportVisitorSignalRecord`'s established visitor-cookie
 * pattern (`initiative-support`), scoped to one Petition instead of one
 * Initiative. Deliberately NOT a `Signature` — it carries no
 * `ParticipantId`/`MemberId`, is never counted toward `SupportMetrics`, and
 * is presented only as its own independent, explicitly non-binding
 * "Visitors" counter (never merged into the Participant/Member signature
 * counts).
 */
export interface PetitionVisitorSignalRecord {
  readonly signalId: string;
  readonly petitionId: string;
  readonly visitorKey: string;
  readonly createdAt: string;
}
