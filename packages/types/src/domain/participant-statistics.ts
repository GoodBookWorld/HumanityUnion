/**
 * Profile UX Pack 02 Part 11 — the single shared definition of Personal
 * Statistics numbers, reused verbatim by Workspace, Member Profile, and
 * (privacy-filtered) Public Profile. See
 * `apps/api/src/modules/participant-statistics/participant-statistics.service.ts`
 * for the aggregation that produces this shape — no other module may
 * recompute these numbers independently.
 *
 * Pack 19B — Implementation Commitment counts.
 * Pack 19C.2B — Proposal and Petition counts.
 * (Same shared aggregation; not parallel statistics subsystems. Six-card UI
 * is deferred.)
 */
export interface ParticipantStatistics {
  /** Initiatives this Participant stewards (created), draft or published. */
  initiativesCount: number;
  /**
   * "Collective Decisions" — number of Initiatives where this Participant
   * is themselves an ACTIVE Initiative Ally (i.e. currently collaborating
   * on someone else's Initiative). Not a count of Discussion clicks and
   * not the unrelated `CollectiveDecision` domain record.
   */
  collectiveDecisionsCount: number;
  /**
   * Unique active Allies across Initiatives this Participant stewards. See
   * `workspace-allies.service.ts` Definition A.
   */
  alliesCount: number;
  /**
   * Pack 19C.2B — Discussion Proposal Candidates attributed to this
   * Participant as `sourceParticipantId` (idea author), one per `candidateId`.
   */
  proposalsCount: number;
  /**
   * Pack 19C.2B — distinct Petitions with an Active Signature for this
   * Participant (`memberId` persistence field).
   */
  petitionsCount: number;
  /**
   * Pack 19B — Implementation Commitments currently attributed as accepted
   * responsibility (`proposalStatus === "accepted"`, current `participantId`).
   */
  commitmentsAcceptedCount: number;
  /**
   * Pack 19B — accepted Commitments that are still active
   * (`status === "published"`; not completed/withdrawn).
   */
  commitmentsActiveCount: number;
  /**
   * Pack 19B — "Commitments Fulfilled": accepted + `status === "completed"`.
   * Credits the canonical `participantId` at completion time.
   */
  commitmentsFulfilledCount: number;
}

/**
 * The Public Profile projection of `ParticipantStatistics`: each field is
 * present only when the profile owner's Privacy settings allow it (or the
 * viewer is the profile owner). Absent fields must not be rendered as
 * zero — they are simply not shown.
 */
export interface PublicParticipantStatistics {
  initiativesCount?: number;
  collectiveDecisionsCount?: number;
  alliesCount?: number;
  proposalsCount?: number;
  petitionsCount?: number;
  commitmentsAcceptedCount?: number;
  commitmentsActiveCount?: number;
  commitmentsFulfilledCount?: number;
}
