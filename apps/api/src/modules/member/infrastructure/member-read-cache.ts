import type { Member } from "@hu/types";

const memberReadCache = new Map<string, Member>();

export function readCachedMember(memberId: string): Member | null {
  const cached = memberReadCache.get(memberId);
  return cached ? structuredClone(cached) : null;
}

export function readCachedMemberByUniqueName(uniqueName: string): Member | null {
  for (const member of memberReadCache.values()) {
    if (member.profile.uniqueName === uniqueName) {
      return structuredClone(member);
    }
  }

  return null;
}

export function writeCachedMember(member: Member): void {
  memberReadCache.set(member.id, structuredClone(member));
}

export function writeCachedMembers(members: Member[]): void {
  for (const member of members) {
    writeCachedMember(member);
  }
}

export function listCachedMembers(): Member[] {
  return Array.from(memberReadCache.values(), (member) => structuredClone(member));
}

/** Test helper — reset in-process read cache. */
export function clearMemberReadCacheForTests(): void {
  memberReadCache.clear();
}
