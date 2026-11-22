/**
 * HU-RRP-POST-01B — explicit RRP notification opens.
 * The directory URL stays participantId|applicationId. A click carries its own
 * request id so a repeated link still opens and refetches the current record.
 */

import { readAdminDirectoryDeepLinkQuery } from "./admin-participant-directory-deep-link";

export const RRP_NOTIFICATION_OPEN_EVENT = "hu-rrp-notification-open";

export interface RrpNotificationOpenRequest {
  readonly requestId: number;
  readonly participantId: string;
  readonly applicationId: string;
}

export interface ExplicitRrpOpenChange {
  readonly modalOpen: true;
  readonly participantId: string;
  readonly applicationId: string;
  readonly openRequestId: number;
  readonly releaseAppliedKey: true;
}

let nextRequestId = 0;

export function resetRrpNotificationOpenRequestsForTests(): void {
  nextRequestId = 0;
}

export function createRrpNotificationOpenRequest(input: {
  readonly participantId: string;
  readonly applicationId: string;
}): RrpNotificationOpenRequest {
  nextRequestId += 1;
  return {
    requestId: nextRequestId,
    participantId: input.participantId,
    applicationId: input.applicationId,
  };
}

/** RRP submission notifications only. Other categories return null. */
export function readRrpApplicationNotificationTarget(notification: {
  readonly type: string;
  readonly targetHref?: string | null;
}): { readonly participantId: string; readonly applicationId: string } | null {
  if (notification.type !== "rrp_application_submitted") {
    return null;
  }
  const href = notification.targetHref?.trim() ?? "";
  if (!href) {
    return null;
  }
  let params: URLSearchParams;
  try {
    params = new URL(href, "https://hu.local").searchParams;
  } catch {
    return null;
  }
  const query = readAdminDirectoryDeepLinkQuery(params);
  if (!query.participantId || !query.rrpApplicationId) {
    return null;
  }
  return {
    participantId: query.participantId,
    applicationId: query.rrpApplicationId,
  };
}

export function explicitRrpOpenChanges(
  request: RrpNotificationOpenRequest,
): ExplicitRrpOpenChange {
  return {
    modalOpen: true,
    participantId: request.participantId,
    applicationId: request.applicationId,
    openRequestId: request.requestId,
    releaseAppliedKey: true,
  };
}

export function publishRrpNotificationOpen(request: RrpNotificationOpenRequest): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<RrpNotificationOpenRequest>(RRP_NOTIFICATION_OPEN_EVENT, {
      detail: request,
    }),
  );
}

export function readRrpNotificationOpenEvent(event: Event): RrpNotificationOpenRequest | null {
  const detail = (event as CustomEvent<RrpNotificationOpenRequest>).detail;
  if (!detail || typeof detail.requestId !== "number") {
    return null;
  }
  const participantId = detail.participantId?.trim() ?? "";
  const applicationId = detail.applicationId?.trim() ?? "";
  if (!participantId || !applicationId) {
    return null;
  }
  return {
    requestId: detail.requestId,
    participantId,
    applicationId,
  };
}

/**
 * A browser or direct-URL change may repeat a key that was already applied.
 * Releasing the applied key lets that navigation open again. An unchanged
 * location keeps the key so closing the modal is not undone by a re-render.
 */
export function releaseDirectoryDeepLinkForLocationChange(input: {
  readonly previousLocationKey: string | null;
  readonly locationKey: string;
  readonly appliedKey: string | null;
}): { readonly locationKey: string; readonly appliedKey: string | null } {
  if (input.previousLocationKey === input.locationKey) {
    return { locationKey: input.locationKey, appliedKey: input.appliedKey };
  }
  return { locationKey: input.locationKey, appliedKey: null };
}

export function shouldAcceptRrpDetailResponse(input: {
  readonly responseRequestId: number;
  readonly latestRequestId: number;
  readonly responseApplicationId: string;
  readonly selectedApplicationId: string | null;
  readonly responseGeneration: number;
  readonly latestGeneration: number;
}): boolean {
  return (
    input.responseRequestId === input.latestRequestId &&
    input.responseGeneration === input.latestGeneration &&
    input.selectedApplicationId === input.responseApplicationId
  );
}
