import type { Member } from "@hu/types";

import type { EditableMemberProfileFields } from "../domain/member-profile.types.js";

/** Read-only Member access contract — Mongo is authoritative. */
export interface MemberQueryPort {
  getMemberById(memberId: string): Promise<Member | null>;
  getMemberByUniqueName(uniqueName: string): Promise<Member | null>;
  listMembers(): Promise<Member[]>;
}

/** Profile mutation contract for MVP Member routes. */
export interface MemberProfileWritePort {
  updateMemberProfile(
    memberId: string,
    fields: EditableMemberProfileFields,
  ): Promise<Member | null>;
}
