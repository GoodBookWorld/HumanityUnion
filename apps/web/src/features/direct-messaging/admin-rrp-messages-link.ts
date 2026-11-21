/** Directory row fields the Messages shortcut is allowed to read. */
export interface AdminRrpDirectoryLookupRow {
  readonly memberId: string;
  readonly rrpSummary?: {
    readonly viewableApplicationIds?: readonly string[];
  } | null;
}

const MESSAGES_HREF_BASE = "https://hu.local";
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const PRIVATE_APPLICATION_FIELD =
  /(dateofbirth|motivation|funding|annualrequested|dob|narrative)/i;

function isOpaqueId(value: string): boolean {
  return OPAQUE_ID.test(value);
}

/**
 * Messages navigation only. Accepts the two directory destinations and nothing else.
 * Notification deep links keep their own stricter contract.
 */
export function isSafeAdminRrpMessagesHref(href: string | null | undefined): boolean {
  if (typeof href !== "string" || href.length === 0 || href !== href.trim()) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//") || href.includes("#")) {
    return false;
  }
  if (PRIVATE_APPLICATION_FIELD.test(href)) {
    return false;
  }

  const queryStart = href.indexOf("?");
  if (queryStart <= 0 || queryStart !== href.lastIndexOf("?")) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(href, MESSAGES_HREF_BASE);
  } catch {
    return false;
  }
  if (url.origin !== MESSAGES_HREF_BASE || url.pathname !== "/admin/participants" || url.hash) {
    return false;
  }

  const parts = href.slice(queryStart + 1).split("&");
  if (parts.length !== 1 && parts.length !== 2) {
    return false;
  }

  const parsed: { key: string; value: string }[] = [];
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      return false;
    }
    const rawKey = part.slice(0, separator);
    const rawValue = part.slice(separator + 1);
    let key: string;
    let value: string;
    try {
      key = decodeURIComponent(rawKey);
      value = decodeURIComponent(rawValue);
    } catch {
      return false;
    }
    if (key !== rawKey || value !== rawValue || !isOpaqueId(value)) {
      return false;
    }
    parsed.push({ key, value });
  }

  if (parsed[0]?.key !== "participantId") {
    return false;
  }
  if (url.searchParams.getAll("participantId").length !== 1) {
    return false;
  }
  if (parsed.length === 1) {
    return url.searchParams.getAll("rrpApplicationId").length === 0;
  }
  if (parsed[1]?.key !== "rrpApplicationId") {
    return false;
  }
  return url.searchParams.getAll("rrpApplicationId").length === 1;
}

/**
 * Admin Messages shortcut.
 * One viewable application includes its id. Several applications omit it so
 * the directory opens the existing selector. The returned string is the
 * destination that passed `isSafeAdminRrpMessagesHref`.
 */
export function buildAdminRrpMessagesHref(
  participantId: string,
  viewableApplicationIds: readonly string[] | null | undefined,
): string | null {
  const participant = participantId.trim();
  const ids = [
    ...new Set((viewableApplicationIds ?? []).map((id) => id.trim()).filter((id) => id.length > 0)),
  ];
  if (!isOpaqueId(participant) || ids.length === 0 || ids.some((id) => !isOpaqueId(id))) {
    return null;
  }

  const href =
    ids.length === 1
      ? `/admin/participants?participantId=${participant}&rrpApplicationId=${ids[0]}`
      : `/admin/participants?participantId=${participant}`;
  return isSafeAdminRrpMessagesHref(href) ? href : null;
}

/**
 * Turn one directory lookup into a shortcut href.
 * A forbidden response, a stale participant, or an empty summary yields no link
 * and does not return application data.
 */
export function rrpHrefFromAdminDirectoryLookup(input: {
  requestedParticipantId: string;
  activeParticipantId: string | null | undefined;
  forbidden: boolean;
  participants: readonly AdminRrpDirectoryLookupRow[];
}): string | null {
  if (input.forbidden) {
    return null;
  }
  const active = input.activeParticipantId?.trim() ?? "";
  const requested = input.requestedParticipantId.trim();
  if (!active || active !== requested) {
    return null;
  }
  const row = input.participants.find((item) => item.memberId === active);
  const ids = row?.rrpSummary?.viewableApplicationIds;
  if (!ids || ids.length === 0) {
    return null;
  }
  return buildAdminRrpMessagesHref(active, ids);
}
