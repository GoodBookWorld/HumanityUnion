/**
 * HU-RRP-06B — durable directory filter/pagination snapshot for Messages
 * navigation and remount restoration. Browser-local only; never the source
 * of truth for application attention/status.
 */

import type { AdminParticipantRoleFilterValue } from "./admin-rrp-directory";

export const ADMIN_PARTICIPANTS_DIRECTORY_STATE_KEY =
  "hu.admin.participants.directory.v1" as const;

export interface AdminParticipantsDirectoryPersistedState {
  readonly searchInput: string;
  readonly search: string;
  readonly status: "" | "active" | "disabled";
  readonly roleFilter: AdminParticipantRoleFilterValue;
  readonly membershipStatus: string;
  readonly sort: "createdAt" | "lastLoginAt" | "email";
  readonly order: "asc" | "desc";
  readonly emailVerification: "" | "pending" | "verified";
  readonly offset: number;
}

export function clampDirectoryOffset(offset: number, total: number, pageSize: number): number {
  const safePageSize = Math.max(1, Math.trunc(pageSize) || 1);
  const safeTotal = Math.max(0, Math.trunc(total) || 0);
  const raw = Number.isFinite(offset) ? Math.trunc(offset) : 0;
  if (raw <= 0 || safeTotal === 0) {
    return 0;
  }
  const maxOffset = Math.floor((safeTotal - 1) / safePageSize) * safePageSize;
  return Math.min(Math.max(0, raw), maxOffset);
}

export function serializeAdminParticipantsDirectoryState(
  state: AdminParticipantsDirectoryPersistedState,
): string {
  return JSON.stringify(state);
}

export function parseAdminParticipantsDirectoryState(
  raw: string | null | undefined,
): AdminParticipantsDirectoryPersistedState | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AdminParticipantsDirectoryPersistedState>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const status =
      parsed.status === "active" || parsed.status === "disabled" || parsed.status === ""
        ? parsed.status
        : "";
    const sort =
      parsed.sort === "createdAt" || parsed.sort === "lastLoginAt" || parsed.sort === "email"
        ? parsed.sort
        : "createdAt";
    const order = parsed.order === "asc" || parsed.order === "desc" ? parsed.order : "desc";
    const emailVerification =
      parsed.emailVerification === "pending" ||
      parsed.emailVerification === "verified" ||
      parsed.emailVerification === ""
        ? parsed.emailVerification
        : "";
    const roleFilter =
      typeof parsed.roleFilter === "string" ? (parsed.roleFilter as AdminParticipantRoleFilterValue) : "";
    const offset =
      typeof parsed.offset === "number" && Number.isFinite(parsed.offset)
        ? Math.max(0, Math.trunc(parsed.offset))
        : 0;

    return {
      searchInput: typeof parsed.searchInput === "string" ? parsed.searchInput : "",
      search: typeof parsed.search === "string" ? parsed.search : "",
      status,
      roleFilter,
      membershipStatus:
        typeof parsed.membershipStatus === "string" ? parsed.membershipStatus : "",
      sort,
      order,
      emailVerification,
      offset,
    };
  } catch {
    return null;
  }
}

export function readAdminParticipantsDirectoryState(
  storage: Pick<Storage, "getItem"> | null | undefined = typeof sessionStorage === "undefined"
    ? null
    : sessionStorage,
): AdminParticipantsDirectoryPersistedState | null {
  if (!storage) {
    return null;
  }
  try {
    return parseAdminParticipantsDirectoryState(
      storage.getItem(ADMIN_PARTICIPANTS_DIRECTORY_STATE_KEY),
    );
  } catch {
    return null;
  }
}

export function writeAdminParticipantsDirectoryState(
  state: AdminParticipantsDirectoryPersistedState,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof sessionStorage === "undefined"
    ? null
    : sessionStorage,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      ADMIN_PARTICIPANTS_DIRECTORY_STATE_KEY,
      serializeAdminParticipantsDirectoryState(state),
    );
  } catch {
    // Ignore quota / private-mode failures; directory still works without persistence.
  }
}
