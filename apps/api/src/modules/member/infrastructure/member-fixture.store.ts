import type { Member } from "@hu/types";

import { sampleMember } from "../member.sample.js";
import type { EditableMemberProfileFields } from "../domain/member-profile.types.js";

/** Verification fixtures only — not authoritative for MVP Members. */
const fixtureMembers = new Map<string, Member>([[sampleMember.id, structuredClone(sampleMember)]]);

export function getLegacyFixtureMemberById(memberId: string): Member | null {
  const member = fixtureMembers.get(memberId);
  return member ? structuredClone(member) : null;
}

export function getLegacyFixtureMemberByUniqueName(uniqueName: string): Member | null {
  for (const member of fixtureMembers.values()) {
    if (member.profile.uniqueName === uniqueName) {
      return structuredClone(member);
    }
  }

  return null;
}

export function updateLegacyFixtureMemberProfile(
  memberId: string,
  fields: EditableMemberProfileFields,
): Member | null {
  const member = fixtureMembers.get(memberId);

  if (!member) {
    return null;
  }

  if (fields.displayName !== undefined) {
    member.profile.displayName = fields.displayName;
  }

  if (fields.country !== undefined) {
    member.profile.country = fields.country;
  }

  if (fields.region !== undefined) {
    member.profile.region = fields.region;
  }

  if (fields.city !== undefined) {
    member.profile.city = fields.city;
  }

  if (fields.languages !== undefined) {
    member.profile.languages = fields.languages;
  }

  member.updatedAt = new Date().toISOString();

  return structuredClone(member);
}

/** Used by verify scripts to seed in-memory fixtures without touching Mongo. */
export function seedLegacyFixtureMember(member: Member): Member {
  fixtureMembers.set(member.id, structuredClone(member));
  return structuredClone(member);
}

export function listLegacyFixtureMembers(): Member[] {
  return Array.from(fixtureMembers.values(), (member) => structuredClone(member));
}
