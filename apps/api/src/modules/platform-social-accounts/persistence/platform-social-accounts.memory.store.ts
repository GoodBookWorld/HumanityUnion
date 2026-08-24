import type { PlatformSocialAccount, PlatformSocialNetworkId } from "@hu/types";
import { PLATFORM_SOCIAL_NETWORK_IDS } from "@hu/types";

import { buildSeedPlatformSocialAccount } from "../platform-social-accounts.catalog.js";

const memory = new Map<PlatformSocialNetworkId, PlatformSocialAccount>();

function ensureSeeded(): void {
  if (memory.size > 0) {
    return;
  }
  for (const networkId of PLATFORM_SOCIAL_NETWORK_IDS) {
    memory.set(networkId, buildSeedPlatformSocialAccount(networkId));
  }
}

export function listPlatformSocialAccountsMemory(): PlatformSocialAccount[] {
  ensureSeeded();
  return PLATFORM_SOCIAL_NETWORK_IDS.map(
    (networkId) => memory.get(networkId) ?? buildSeedPlatformSocialAccount(networkId),
  );
}

export function getPlatformSocialAccountMemory(
  networkId: PlatformSocialNetworkId,
): PlatformSocialAccount | null {
  ensureSeeded();
  return memory.get(networkId) ?? null;
}

export function upsertPlatformSocialAccountMemory(
  account: PlatformSocialAccount,
): PlatformSocialAccount {
  ensureSeeded();
  memory.set(account.networkId, account);
  return account;
}

export function resetPlatformSocialAccountsMemoryForTests(): void {
  memory.clear();
}
