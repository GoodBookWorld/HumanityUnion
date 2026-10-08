/**
 * Schedule the existing civic_media warm when the shared translation input changes.
 * The input is the active trusted-media explanation set. Names, URLs, and logos
 * are not part of it. One pending warm per civic-media-center is deduped by the
 * existing outbox. This does not call a translation provider.
 */

import type { MediaResourceType } from "@hu/types";

import { CIVIC_MEDIA_RECORD_ID } from "./content-translation-civic-loaders.js";
import { notifyPublicPresentationChanged } from "./public-presentation-changed.js";

export type TrustedMediaTranslationMembership = {
  readonly resourceType: MediaResourceType | string;
  readonly active: boolean;
  readonly id: string;
  readonly description?: string | null;
};

/** Active trusted explanation identity. Null when the row is outside the CT bag. */
export function trustedMediaTranslationMembershipKey(
  resource: TrustedMediaTranslationMembership | null | undefined,
): string | null {
  if (!resource || resource.resourceType !== "TRUSTED_MEDIA" || resource.active !== true) {
    return null;
  }
  const id = resource.id.trim();
  if (!id) {
    return null;
  }
  return `${id}\u0000${resource.description?.trim() ?? ""}`;
}

export function trustedMediaTranslationInputChanged(
  before: TrustedMediaTranslationMembership | null | undefined,
  after: TrustedMediaTranslationMembership | null | undefined,
): boolean {
  return (
    trustedMediaTranslationMembershipKey(before) !==
    trustedMediaTranslationMembershipKey(after)
  );
}

/** Fire-and-forget. Reconciliation and warm dedupe stay in the existing notifier. */
export function scheduleCivicMediaTranslationRecovery(): void {
  notifyPublicPresentationChanged({
    sourceKind: "civic_media",
    sourceRecordId: CIVIC_MEDIA_RECORD_ID,
    reason: "public_update",
  });
}
