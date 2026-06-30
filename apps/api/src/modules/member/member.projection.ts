import type { Member, MemberPublicProjection } from "@hu/types";

export function toMemberPublicProjection(member: Member): MemberPublicProjection {
  return {
    displayName: member.profile.displayName,
    uniqueName: member.profile.uniqueName,
    country: member.profile.country,
    region: member.profile.region,
    languages: member.profile.languages,
  };
}
