import type { Member } from "@hu/types";

import type { EditableMemberProfileFields } from "../domain/member-profile.types.js";
import type { MemberProfileWritePort } from "./member-query.port.js";
import { toMemberDomain } from "../infrastructure/member.persistence.js";
import { updateMemberProfile as updateMemberProfileInMongo } from "../infrastructure/member.repository.js";
import { writeCachedMember } from "../infrastructure/member-read-cache.js";
import { updateLegacyFixtureMemberProfile } from "../infrastructure/member-fixture.store.js";

class MemberWriteService implements MemberProfileWritePort {
  async updateMemberProfile(
    memberId: string,
    fields: EditableMemberProfileFields,
  ): Promise<Member | null> {
    const updated = await updateMemberProfileInMongo(memberId, fields);

    if (updated) {
      const member = toMemberDomain(updated);
      writeCachedMember(member);
      return member;
    }

    return updateLegacyFixtureMemberProfile(memberId, fields);
  }
}

const memberWriteService = new MemberWriteService();

export { MemberWriteService, memberWriteService };

export async function updateMemberProfile(
  memberId: string,
  fields: EditableMemberProfileFields,
): Promise<Member | null> {
  return memberWriteService.updateMemberProfile(memberId, fields);
}
