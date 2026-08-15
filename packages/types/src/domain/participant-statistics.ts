/**
 * Profile UX Pack 02 Part 11 — the single shared definition of the three
 * "Personal Statistics" numbers, reused verbatim by Workspace, Member
 * Profile, and (privacy-filtered) Public Profile. See
 * `apps/api/src/modules/participant-statistics/participant-statistics.service.ts`
 * for the aggregation that produces this shape — no other module may
 * recompute these numbers independently.
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
}
