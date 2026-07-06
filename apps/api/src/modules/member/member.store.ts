import type { Member } from "@hu/types";

import { sampleMember } from "./member.sample.js";

export interface EditableMemberProfileFields {
  displayName?: string;
  country?: string;
  region?: string;
  city?: string;
  languages?: string[];
}

const members = new Map<string, Member>([[sampleMember.id, structuredClone(sampleMember)]]);

export function getMemberById(memberId: string): Member | null {
  const member = members.get(memberId);

  return member ? structuredClone(member) : null;
}

export function getMemberByUniqueName(uniqueName: string): Member | null {
  for (const member of members.values()) {
    if (member.profile.uniqueName === uniqueName) {
      return structuredClone(member);
    }
  }

  return null;
}

export function updateMemberProfile(
  memberId: string,
  fields: EditableMemberProfileFields,
): Member | null {
  const member = members.get(memberId);

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

export function seedMember(member: Member): Member {
  members.set(member.id, structuredClone(member));

  return structuredClone(member);
}
