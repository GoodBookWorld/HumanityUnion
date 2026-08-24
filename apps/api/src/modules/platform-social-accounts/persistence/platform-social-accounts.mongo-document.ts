import type { PlatformSocialAccount, PlatformSocialNetworkId } from "@hu/types";

import { labelForNetwork } from "../platform-social-accounts.catalog.js";

export interface PlatformSocialAccountMongoDocument {
  networkId: PlatformSocialNetworkId;
  label: string;
  url: string | null;
  enabled: boolean;
  updatedAt: string;
  updatedByParticipantId?: string;
}

export function toPlatformSocialAccountMongoDocument(
  account: PlatformSocialAccount,
): PlatformSocialAccountMongoDocument {
  return {
    networkId: account.networkId,
    label: account.label,
    url: account.url,
    enabled: account.enabled,
    updatedAt: account.updatedAt,
    ...(account.updatedByParticipantId
      ? { updatedByParticipantId: account.updatedByParticipantId }
      : {}),
  };
}

export function fromPlatformSocialAccountMongoDocument(
  doc: PlatformSocialAccountMongoDocument,
): PlatformSocialAccount {
  return {
    networkId: doc.networkId,
    label: doc.label?.trim() || labelForNetwork(doc.networkId),
    url: doc.url?.trim() ? doc.url.trim() : null,
    enabled: doc.enabled === true,
    updatedAt: doc.updatedAt,
    ...(doc.updatedByParticipantId
      ? { updatedByParticipantId: doc.updatedByParticipantId }
      : {}),
  };
}
