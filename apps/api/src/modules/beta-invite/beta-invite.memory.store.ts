import type { BetaInviteRecord } from "./beta-invite.types.js";

const memoryInvites: BetaInviteRecord[] = [];

export function resetBetaInvitesMemoryForTests(): void {
  memoryInvites.length = 0;
}

export function listBetaInvitesMemory(): BetaInviteRecord[] {
  return memoryInvites.map((invite) => ({ ...invite }));
}

export function getBetaInviteByIdMemory(inviteId: string): BetaInviteRecord | null {
  const found = memoryInvites.find((invite) => invite.inviteId === inviteId);
  return found ? { ...found } : null;
}

export function insertBetaInviteMemory(record: BetaInviteRecord): BetaInviteRecord {
  memoryInvites.push({ ...record });
  return { ...record };
}

export function replaceBetaInviteMemory(record: BetaInviteRecord): BetaInviteRecord | null {
  const index = memoryInvites.findIndex((invite) => invite.inviteId === record.inviteId);
  if (index < 0) {
    return null;
  }
  memoryInvites[index] = { ...record };
  return { ...record };
}

export function updateBetaInviteMemoryIfStatus(
  inviteId: string,
  expectedStatus: BetaInviteRecord["status"],
  patch: Partial<BetaInviteRecord>,
): BetaInviteRecord | null {
  const index = memoryInvites.findIndex(
    (invite) => invite.inviteId === inviteId && invite.status === expectedStatus,
  );
  if (index < 0) {
    return null;
  }
  const next = { ...memoryInvites[index]!, ...patch };
  memoryInvites[index] = next;
  return { ...next };
}

export function deleteBetaInvitesMemoryByEmailPrefix(emailPrefix: string): void {
  for (let index = memoryInvites.length - 1; index >= 0; index -= 1) {
    if (memoryInvites[index]!.email.startsWith(emailPrefix)) {
      memoryInvites.splice(index, 1);
    }
  }
}
