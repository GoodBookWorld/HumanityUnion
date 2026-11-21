/**
 * HU-RRP-09B — query-driven Participant directory navigation.
 * The directory applies the current search params whenever they change.
 * A repeated key does not open the same modal again.
 * A participant id alone selects the row. An application modal opens only
 * when the query also names an authorized rrpApplicationId.
 */
import type { AdminRrpDirectoryClassification } from "@hu/types";

export interface AdminDirectoryDeepLinkQuery {
  readonly participantId: string | null;
  readonly rrpApplicationId: string | null;
  readonly view: string | null;
  readonly badgeApplicationId: string | null;
}

export function readAdminDirectoryDeepLinkQuery(params: {
  get(name: string): string | null;
}): AdminDirectoryDeepLinkQuery {
  const read = (value: string | null): string | null => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
  };
  return {
    participantId: read(params.get("participantId")),
    rrpApplicationId: read(params.get("rrpApplicationId")),
    view: read(params.get("view")),
    badgeApplicationId: read(params.get("badgeApplicationId")),
  };
}

export function adminDirectoryParticipantDeepLinkKey(
  participantId: string | null,
  rrpApplicationId: string | null,
): string {
  return `${participantId ?? ""}|${rrpApplicationId ?? ""}`;
}

export interface DirectoryDeepLinkRow {
  readonly memberId: string;
  readonly viewableApplicationIds: readonly string[];
}

export type DirectoryParticipantDeepLinkResult =
  | { readonly action: "wait" }
  | { readonly action: "ignore" }
  | { readonly action: "participant-unavailable"; readonly appliedKey: string }
  | {
      readonly action: "application-unavailable";
      readonly appliedKey: string;
      readonly memberId: string;
    }
  | {
      readonly action: "open-application";
      readonly appliedKey: string;
      readonly memberId: string;
      readonly applicationId: string | null;
    }
  | {
      readonly action: "select-participant";
      readonly appliedKey: string;
      readonly memberId: string;
    };

/**
 * Open or select only after the directory response for this participant id
 * has arrived. Viewable application ids are the caller's authorized list.
 */
export function resolveDirectoryParticipantDeepLink(input: {
  readonly participantId: string | null;
  readonly rrpApplicationId: string | null;
  readonly acceptedParticipantFilter: string | null;
  readonly directoryReady: boolean;
  readonly rows: readonly DirectoryDeepLinkRow[];
  readonly appliedKey: string | null;
}): DirectoryParticipantDeepLinkResult {
  if (!input.participantId) {
    return { action: "ignore" };
  }
  const key = adminDirectoryParticipantDeepLinkKey(
    input.participantId,
    input.rrpApplicationId,
  );
  if (input.appliedKey === key) {
    return { action: "ignore" };
  }
  if (!input.directoryReady || input.acceptedParticipantFilter !== input.participantId) {
    return { action: "wait" };
  }
  const match = input.rows.find((row) => row.memberId === input.participantId);
  if (!match) {
    return { action: "participant-unavailable", appliedKey: key };
  }
  if (input.rrpApplicationId) {
    if (!match.viewableApplicationIds.includes(input.rrpApplicationId)) {
      return {
        action: "application-unavailable",
        appliedKey: key,
        memberId: match.memberId,
      };
    }
    return {
      action: "open-application",
      appliedKey: key,
      memberId: match.memberId,
      applicationId: input.rrpApplicationId,
    };
  }
  return {
    action: "select-participant",
    appliedKey: key,
    memberId: match.memberId,
  };
}

export function isDirectoryBadgeDeepLink(
  query: Pick<AdminDirectoryDeepLinkQuery, "view" | "badgeApplicationId">,
): boolean {
  return query.view === "member_badge_orders" || Boolean(query.badgeApplicationId);
}

export interface DirectoryNotificationListFilters {
  readonly search?: string;
  readonly status?: "active" | "disabled";
  readonly role?: "member" | "admin";
  readonly rrpClassification?: AdminRrpDirectoryClassification;
  readonly emailVerificationStatus?: "pending" | "verified";
  readonly membershipStatus?: string;
  readonly participantId?: string;
}

/**
 * A participant notification names one row. Saved directory filters stay in
 * the form, but they are not sent with that request. Badge-order navigation
 * keeps its own view filter.
 */
export function directoryListFiltersForNotificationTarget(input: {
  readonly participantId: string | null;
  readonly badgeViewRequested: boolean;
  readonly search?: string;
  readonly status?: "" | "active" | "disabled";
  readonly role?: "member" | "admin";
  readonly rrpClassification?: AdminRrpDirectoryClassification;
  readonly emailVerificationStatus?: "" | "pending" | "verified";
  readonly membershipStatus?: string;
}): DirectoryNotificationListFilters {
  if (input.participantId && !input.badgeViewRequested) {
    return { participantId: input.participantId };
  }
  return {
    ...(input.search ? { search: input.search } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.role ? { role: input.role } : {}),
    ...(input.rrpClassification ? { rrpClassification: input.rrpClassification } : {}),
    ...(input.emailVerificationStatus
      ? { emailVerificationStatus: input.emailVerificationStatus }
      : {}),
    ...(input.membershipStatus ? { membershipStatus: input.membershipStatus } : {}),
    ...(input.participantId ? { participantId: input.participantId } : {}),
  };
}
