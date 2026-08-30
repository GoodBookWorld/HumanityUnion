import type { PlatformSupportLink, PlatformSupportLinkId } from "@hu/types";
import { PLATFORM_SUPPORT_LINK_IDS } from "@hu/types";

import { buildSeedPlatformSupportLink } from "../platform-support-links.catalog.js";

const memory = new Map<PlatformSupportLinkId, PlatformSupportLink>();

function ensureSeeded(): void {
  if (memory.size > 0) {
    return;
  }
  for (const linkId of PLATFORM_SUPPORT_LINK_IDS) {
    memory.set(linkId, buildSeedPlatformSupportLink(linkId));
  }
}

export function listPlatformSupportLinksMemory(): PlatformSupportLink[] {
  ensureSeeded();
  return PLATFORM_SUPPORT_LINK_IDS.map(
    (linkId) => memory.get(linkId) ?? buildSeedPlatformSupportLink(linkId),
  );
}

export function getPlatformSupportLinkMemory(
  linkId: PlatformSupportLinkId,
): PlatformSupportLink | null {
  ensureSeeded();
  return memory.get(linkId) ?? null;
}

export function upsertPlatformSupportLinkMemory(
  link: PlatformSupportLink,
): PlatformSupportLink {
  ensureSeeded();
  memory.set(link.linkId, link);
  return link;
}

export function resetPlatformSupportLinksMemoryForTests(): void {
  memory.clear();
}
