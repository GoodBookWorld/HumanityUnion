/**
 * HU-RRP-09B — query-driven Participant directory navigation.
 * The directory applies the current search params whenever they change.
 * A repeated key does not open the same modal again.
 */

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
  if (match.viewableApplicationIds.length > 0) {
    return {
      action: "open-application",
      appliedKey: key,
      memberId: match.memberId,
      applicationId: null,
    };
  }
  return {
    action: "select-participant",
    appliedKey: key,
    memberId: match.memberId,
  };
}
