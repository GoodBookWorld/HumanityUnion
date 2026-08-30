import type { PlatformSupportLink, PlatformSupportLinkId } from "@hu/types";

import { labelForSupportLink } from "../platform-support-links.catalog.js";

export interface PlatformSupportLinkMongoDocument {
  linkId: PlatformSupportLinkId;
  label: string;
  url: string | null;
  enabled: boolean;
  updatedAt: string;
  updatedByParticipantId?: string;
}

export function toPlatformSupportLinkMongoDocument(
  link: PlatformSupportLink,
): PlatformSupportLinkMongoDocument {
  return {
    linkId: link.linkId,
    label: link.label,
    url: link.url,
    enabled: link.enabled,
    updatedAt: link.updatedAt,
    ...(link.updatedByParticipantId
      ? { updatedByParticipantId: link.updatedByParticipantId }
      : {}),
  };
}

export function fromPlatformSupportLinkMongoDocument(
  doc: PlatformSupportLinkMongoDocument,
): PlatformSupportLink {
  return {
    linkId: doc.linkId,
    label: doc.label?.trim() || labelForSupportLink(doc.linkId),
    url: doc.url?.trim() ? doc.url.trim() : null,
    enabled: doc.enabled === true,
    updatedAt: doc.updatedAt,
    ...(doc.updatedByParticipantId
      ? { updatedByParticipantId: doc.updatedByParticipantId }
      : {}),
  };
}
