/** Shared transparency note — do not duplicate in UI copy. */
export const MEMBERSHIP_VOTE_WEIGHT_TRANSPARENCY_NOTE =
  "Membership status does not change vote weight. This result is a statistical indicator of civic support.";

/** Public Membership participation aggregates (TASK-093). */
export interface MembershipStatisticsPayload {
  totalParticipation: number;
  members: number;
  participants: number;
  /**
   * Pack 25D — cumulative count of Participants who started a Membership
   * application at least once (includes those who later became Members).
   */
  applicationStarted: number;
  updatedAt: string;
}

/** Future analytics dimensions — architecture only (not implemented). */
export interface MembershipStatisticsFutureDimensions {
  membersByCountry: Record<string, number> | null;
  membersByRegion: Record<string, number> | null;
  monthlyMemberships: number[] | null;
  inactiveMembers: number | null;
  growthRatePercent: number | null;
}

/** Future search filter dimensions — architecture only (not implemented). */
export type MembershipStatisticsSearchFilter = "members_only" | "participants_only";
