import type { MembershipStatisticsPayload } from "@hu/types";

import { countVerifiedActiveAuthUsers } from "../auth/auth-user.repository.js";
import {
  countActiveMembershipMembers,
  countApplicationStartedMemberships,
} from "../membership/membership.repository.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import {
  readCachedMembershipStatistics,
  writeCachedMembershipStatistics,
} from "./membership-statistics.cache.js";

export async function buildMembershipStatisticsPayload(): Promise<MembershipStatisticsPayload> {
  const updatedAt = new Date().toISOString();

  if (!isMongoConfigured()) {
    return {
      totalParticipation: 0,
      members: 0,
      participants: 0,
      applicationStarted: 0,
      updatedAt,
    };
  }

  const [members, verifiedParticipants, applicationStarted] = await Promise.all([
    countActiveMembershipMembers(),
    countVerifiedActiveAuthUsers(),
    countApplicationStartedMemberships(),
  ]);

  const participants = Math.max(0, verifiedParticipants - members);
  const totalParticipation = members + participants;

  return {
    totalParticipation,
    members,
    participants,
    applicationStarted,
    updatedAt,
  };
}

export async function getMembershipStatisticsPayload(): Promise<MembershipStatisticsPayload> {
  const cached = readCachedMembershipStatistics();

  if (cached) {
    return cached;
  }

  const payload = await buildMembershipStatisticsPayload();
  writeCachedMembershipStatistics(payload);
  return payload;
}
