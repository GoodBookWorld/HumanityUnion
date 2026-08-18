import type { Member } from "@hu/types";

import type { MemberQueryPort } from "./member-query.port.js";
import { toMemberDomain } from "../infrastructure/member.persistence.js";
import {
  findMemberById,
  findMemberByUniqueName,
  listMembers as listMembersFromMongo,
} from "../infrastructure/member.repository.js";
import {
  readCachedMember,
  readCachedMemberByUniqueName,
  writeCachedMember,
  writeCachedMembers,
} from "../infrastructure/member-read-cache.js";
import {
  getLegacyFixtureMemberById,
  getLegacyFixtureMemberByUniqueName,
  listLegacyFixtureMembers,
} from "../infrastructure/member-fixture.store.js";

class MemberReadService implements MemberQueryPort {
  async getMemberById(memberId: string): Promise<Member | null> {
    try {
      const persisted = await findMemberById(memberId);

      if (persisted) {
        const member = toMemberDomain(persisted);
        writeCachedMember(member);
        return member;
      }
    } catch {
      // Member substrate optional for Author Lifecycle CAP side-effects.
    }

    const fixture = getLegacyFixtureMemberById(memberId);

    if (fixture) {
      writeCachedMember(fixture);
      return fixture;
    }

    return null;
  }

  async getMemberByUniqueName(uniqueName: string): Promise<Member | null> {
    const persisted = await findMemberByUniqueName(uniqueName);

    if (persisted) {
      const member = toMemberDomain(persisted);
      writeCachedMember(member);
      return member;
    }

    const fixture = getLegacyFixtureMemberByUniqueName(uniqueName);

    if (fixture) {
      writeCachedMember(fixture);
      return fixture;
    }

    return null;
  }

  async listMembers(): Promise<Member[]> {
    const persisted = await listMembersFromMongo();
    const mongoMembers = persisted.map(toMemberDomain);
    writeCachedMembers(mongoMembers);

    if (mongoMembers.length > 0) {
      return mongoMembers;
    }

    return listLegacyFixtureMembers();
  }
}

const memberReadService = new MemberReadService();

export { MemberReadService, memberReadService };

/**
 * Sync read for legacy callers — returns cached Mongo reads or verification fixtures only.
 * Prefer async `getMemberById` from member-access.ts.
 */
export function getMemberByIdSync(memberId: string): Member | null {
  return readCachedMember(memberId) ?? getLegacyFixtureMemberById(memberId);
}

/** @deprecated Prefer async getMemberByUniqueName from member-access.ts */
export function getMemberByUniqueNameSync(uniqueName: string): Member | null {
  return readCachedMemberByUniqueName(uniqueName) ?? getLegacyFixtureMemberByUniqueName(uniqueName);
}

export async function getMemberById(memberId: string): Promise<Member | null> {
  return memberReadService.getMemberById(memberId);
}

export async function getMemberByUniqueName(uniqueName: string): Promise<Member | null> {
  return memberReadService.getMemberByUniqueName(uniqueName);
}

export async function listMembers(): Promise<Member[]> {
  return memberReadService.listMembers();
}
