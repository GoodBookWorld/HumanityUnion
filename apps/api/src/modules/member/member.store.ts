/**
 * @deprecated Import from `./member-access.js` instead. Compatibility shim for legacy callers.
 * MongoDB is authoritative — use async APIs from member-access.ts for MVP paths.
 */
import type { Member } from "@hu/types";

import type { EditableMemberProfileFields } from "./domain/member-profile.types.js";
import {
  getMemberByIdSync,
  getMemberByUniqueNameSync,
} from "./application/member-read.service.js";
import { seedLegacyFixtureMember, listLegacyFixtureMembers } from "./infrastructure/member-fixture.store.js";

export type { EditableMemberProfileFields };

/** @deprecated Use `getMemberById` from `./member-access.js` */
export function getMemberById(memberId: string): Member | null {
  return getMemberByIdSync(memberId);
}

/** @deprecated Use `getMemberByUniqueName` from `./member-access.js` */
export function getMemberByUniqueName(uniqueName: string): Member | null {
  return getMemberByUniqueNameSync(uniqueName);
}

/** @deprecated Use `updateMemberProfile` from `./member-access.js` */
export function updateMemberProfile(
  _memberId: string,
  _fields: EditableMemberProfileFields,
): Member | null {
  throw new Error(
    "member.store.updateMemberProfile is deprecated. Use async updateMemberProfile from member-access.js.",
  );
}

/** @deprecated Verification scripts only — use Mongo-backed registration for MVP. */
export function seedMember(member: Member): Member {
  return seedLegacyFixtureMember(member);
}

/** @deprecated Use async `listMembers` from `./member-access.js` */
export function listMembers(): Member[] {
  return listLegacyFixtureMembers();
}
