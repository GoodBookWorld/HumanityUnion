"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  AdminParticipantDirectoryItem,
  AuthUserPublic,
  MembershipStatisticsPayload,
  ParticipantSuspensionReasonCode,
  PlatformStatisticsCounts,
  PlatformStatisticsMeta,
} from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { WorkspaceStatusBadge } from "../../initiative-workspace-ux/components/WorkspaceStatusBadge";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import {
  fetchMembershipStatistics,
  formatMembershipStatisticValue,
} from "../../membership-statistics/membership-statistics-api";
import {
  fetchPlatformStatistics,
  formatPlatformStatisticValue,
} from "../../platform-statistics/platform-statistics-api";
import {
  adminParticipantPublicProfilePath,
  listAdminParticipants,
} from "../admin-participant-directory-api";
import {
  formatParticipantSuspensionReasonLabel,
  PARTICIPANT_SUSPENSION_REASON_OPTIONS,
  restoreAdminParticipant,
  suspendAdminParticipant,
} from "../admin-participant-suspension-api";
import { useOpenDirectConversation } from "../../direct-messaging/use-open-direct-conversation";
import { AdminMetricDetailsGrid } from "./AdminMetricDetailsGrid";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-participants-table.css";

interface AdminParticipantsSectionProps {
  user: AuthUserPublic;
}

const PAGE_SIZE = 25;

function formatCompactDate(value?: string): string {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function participantPrimaryName(row: AdminParticipantDirectoryItem): string {
  return row.profileDisplayName || row.displayName || row.publicName || row.email;
}

function participantSecondaryName(row: AdminParticipantDirectoryItem): string | null {
  if (row.uniqueName) {
    return `@${row.uniqueName}`;
  }
  if (row.publicName && row.publicName !== participantPrimaryName(row)) {
    return row.publicName;
  }
  return null;
}

function formatAccountStatus(status: AdminParticipantDirectoryItem["status"]): string {
  return status === "active" ? "Active" : "Suspended";
}

function formatAccountRole(role: AdminParticipantDirectoryItem["role"]): string {
  return role === "admin" ? "Administrator" : "Participant account";
}

function formatMembershipLabel(row: AdminParticipantDirectoryItem): string {
  if (!row.membership) {
    return "Not a Member";
  }

  if (row.membership.cohortLabel === "Member" || row.membership.status === "active_member") {
    return "Member";
  }

  const statusLabels: Record<string, string> = {
    not_started: "Not started",
    application_started: "Application started",
    application_completed: "Application submitted",
    pending_payment: "Pending payment",
    active_member: "Active Member",
  };

  return statusLabels[row.membership.status] ?? row.membership.status.replace(/_/g, " ");
}

export function AdminParticipantsSection({ user: _user }: AdminParticipantsSectionProps) {
  const [counts, setCounts] = useState<PlatformStatisticsCounts | null>(null);
  const [meta, setMeta] = useState<PlatformStatisticsMeta | null>(null);
  const [membership, setMembership] = useState<MembershipStatisticsPayload | null>(null);
  const [rows, setRows] = useState<readonly AdminParticipantDirectoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "active" | "disabled">("");
  const [role, setRole] = useState<"" | "member" | "admin">("");
  const [membershipStatus, setMembershipStatus] = useState("");
  const [sort, setSort] = useState<"createdAt" | "lastLoginAt" | "email">("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [suspendTarget, setSuspendTarget] = useState<AdminParticipantDirectoryItem | null>(null);
  const [suspendReason, setSuspendReason] = useState<ParticipantSuspensionReasonCode>(
    "community_standards_violation",
  );
  const [suspending, setSuspending] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState<AdminParticipantDirectoryItem | null>(null);
  const [restoring, setRestoring] = useState(false);

  const {
    isOpening: isOpeningMessage,
    errorMessage: messageError,
    openConversation,
  } = useOpenDirectConversation();
  const [messagingParticipantId, setMessagingParticipantId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([fetchPlatformStatistics(), fetchMembershipStatistics()]).then(
      ([platformResult, membershipResult]) => {
        if (cancelled) {
          return;
        }

        if (platformResult.status === "fulfilled") {
          setCounts(platformResult.value.data);
          setMeta(platformResult.value.meta);
        }

        if (membershipResult.status === "fulfilled") {
          setMembership(membershipResult.value);
        }

        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const loadDirectory = useCallback(async () => {
    setTableLoading(true);
    setError(null);
    setDenied(false);

    try {
      const response = await listAdminParticipants({
        search: search || undefined,
        status: status || undefined,
        role: role || undefined,
        membershipStatus: membershipStatus || undefined,
        sort,
        order,
        limit: PAGE_SIZE,
        offset,
      });
      setRows(response.participants);
      setTotal(response.total);
    } catch (loadError: unknown) {
      setRows([]);
      setTotal(0);
      if (isForbiddenError(loadError)) {
        setDenied(true);
        setError("Participant directory requires an Administrator account.");
      } else {
        setError(formatAuthFormError(loadError));
      }
    } finally {
      setTableLoading(false);
    }
  }, [search, status, role, membershipStatus, sort, order, offset]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + rows.length, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  async function confirmSuspend() {
    if (!suspendTarget) {
      return;
    }
    setSuspending(true);
    setActionMessage(null);
    try {
      const result = await suspendAdminParticipant(suspendTarget.memberId, suspendReason);
      setSuspendTarget(null);
      setActionMessage(
        result.emailQueued
          ? "Participant suspended. A review email was queued."
          : result.emailWarning
            ? `Participant suspended. ${result.emailWarning}`
            : "Participant suspended. Review email could not be queued.",
      );
      await loadDirectory();
    } catch (caught: unknown) {
      setActionMessage(formatAuthFormError(caught));
    } finally {
      setSuspending(false);
    }
  }

  async function confirmRestore() {
    if (!restoreTarget) {
      return;
    }
    setRestoring(true);
    setActionMessage(null);
    try {
      const result = await restoreAdminParticipant(restoreTarget.memberId);
      setRestoreTarget(null);
      setActionMessage(
        result.emailQueued
          ? "Participant restored."
          : result.emailWarning
            ? `Participant restored. ${result.emailWarning}`
            : "Participant restored.",
      );
      await loadDirectory();
    } catch (caught: unknown) {
      setActionMessage(formatAuthFormError(caught));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Participant aggregates">
        {loading ? <p className="hu-body">Loading aggregates…</p> : null}
        <AdminMetricDetailsGrid
          aria-label="Participant aggregates"
          cells={[
            {
              label: "Total Participants",
              value: counts ? formatPlatformStatisticValue(counts.users) : "Unavailable",
            },
            {
              label: "Recently Active",
              value: counts
                ? formatPlatformStatisticValue(counts.activeMembers)
                : "Unavailable",
            },
            {
              label: "Active Window",
              value: meta ? `${meta.activeMemberWindowDays} days` : "Unavailable",
              caption: "activity measurement window",
              methodological: true,
            },
            {
              label: "Members",
              value: membership
                ? formatMembershipStatisticValue(membership.members)
                : "Unavailable",
            },
          ]}
        />
      </ProfileSection>

      <ProfileSection title="Participant directory">
        <p className="hu-caption admin-panel__note">
          Server-paginated directory from the admin-authorized Participant contract. Fair points
          and per-row civic activity counters are not collected on this surface.
        </p>

        <form className="admin-participants-filters" onSubmit={applyFilters}>
          <label className="admin-panel__label" htmlFor="admin-participant-search">
            Search
          </label>
          <input
            id="admin-participant-search"
            className="admin-panel__input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Email, display name, or unique name"
          />

          <div className="admin-participants-filters__row">
            <label>
              Status
              <select
                value={status}
                onChange={(event) => {
                  setOffset(0);
                  setStatus(event.target.value as "" | "active" | "disabled");
                }}
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="disabled">Suspended</option>
              </select>
            </label>

            <label>
              Role
              <select
                value={role}
                onChange={(event) => {
                  setOffset(0);
                  setRole(event.target.value as "" | "member" | "admin");
                }}
              >
                <option value="">All</option>
                <option value="member">Participant account</option>
                <option value="admin">Administrator</option>
              </select>
            </label>

            <label>
              Membership
              <select
                value={membershipStatus}
                onChange={(event) => {
                  setOffset(0);
                  setMembershipStatus(event.target.value);
                }}
              >
                <option value="">All</option>
                <option value="active_member">Active Member</option>
                <option value="not_started">Not started</option>
                <option value="application_started">Application started</option>
                <option value="application_completed">Application submitted</option>
                <option value="pending_payment">Pending payment</option>
              </select>
            </label>

            <label>
              Sort
              <select
                value={`${sort}:${order}`}
                onChange={(event) => {
                  const [nextSort, nextOrder] = event.target.value.split(":") as [
                    "createdAt" | "lastLoginAt" | "email",
                    "asc" | "desc",
                  ];
                  setOffset(0);
                  setSort(nextSort);
                  setOrder(nextOrder);
                }}
              >
                <option value="createdAt:desc">Joined (newest)</option>
                <option value="createdAt:asc">Joined (oldest)</option>
                <option value="lastLoginAt:desc">Last active (newest)</option>
                <option value="email:asc">Email (A–Z)</option>
              </select>
            </label>
          </div>

          <Button type="submit" variant="primary">
            Apply search
          </Button>
        </form>

        {actionMessage ? (
          <StatusBanner title="Moderation update" message={actionMessage} />
        ) : null}

        {messageError ? <StatusBanner title="Messaging" message={messageError} /> : null}

        {error ? (
          <StatusBanner
            title={denied ? "Access restricted" : "Directory unavailable"}
            message={error}
          />
        ) : null}

        {tableLoading ? <p className="hu-body">Loading directory…</p> : null}

        {!tableLoading && !error ? (
          <>
            <div className="admin-participants-table-wrap">
              <table className="admin-participants-table">
                <thead>
                  <tr>
                    <th scope="col">Participant</th>
                    <th scope="col">Email</th>
                    <th scope="col">Status</th>
                    <th scope="col">Role</th>
                    <th scope="col">Member status</th>
                    <th scope="col">Joined</th>
                    <th scope="col">Last active</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8}>No participants match these filters.</td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const secondary = participantSecondaryName(row);
                      // Pack 24A — enable only when CURRENT publicName exists; navigate via
                      // Admin resolver keyed by stable memberId (never uniqueName).
                      const canViewPublicProfile = Boolean(row.publicName?.trim());
                      const profileHref = canViewPublicProfile
                        ? adminParticipantPublicProfilePath(row.memberId)
                        : null;

                      return (
                        <tr key={row.userId}>
                          <td>
                            <div className="admin-participants-table__identity">
                              {row.avatarUrl ? (
                                <img
                                  src={row.avatarUrl}
                                  alt=""
                                  width={32}
                                  height={32}
                                  className="admin-participants-table__avatar"
                                />
                              ) : (
                                <span
                                  className="admin-participants-table__avatar-fallback"
                                  aria-hidden="true"
                                >
                                  {(participantPrimaryName(row)[0] ?? "?").toUpperCase()}
                                </span>
                              )}
                              <div>
                                <p className="admin-participants-table__name">
                                  {participantPrimaryName(row)}
                                </p>
                                {secondary ? (
                                  <p className="hu-caption admin-participants-table__secondary">
                                    {secondary}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td>{row.email}</td>
                          <td>
                            <WorkspaceStatusBadge status={formatAccountStatus(row.status)} />
                          </td>
                          <td>
                            <span className="admin-participants-table__role">
                              {formatAccountRole(row.role)}
                            </span>
                          </td>
                          <td>
                            <WorkspaceStatusBadge status={formatMembershipLabel(row)} />
                          </td>
                          <td>{formatCompactDate(row.createdAt)}</td>
                          <td>{formatCompactDate(row.lastLoginAt)}</td>
                          <td>
                            <div className="admin-participants-table__actions">
                              {profileHref ? (
                                <Button
                                  href={profileHref}
                                  variant="secondary"
                                  className="admin-participants-table__action"
                                  aria-label={`View profile for ${participantPrimaryName(row)}`}
                                >
                                  View profile
                                </Button>
                              ) : (
                                <span className="hu-caption admin-participants-table__action--unavailable">
                                  Profile unavailable
                                </span>
                              )}
                              {row.status === "active" ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="admin-participants-table__action"
                                  disabled={isOpeningMessage}
                                  aria-label={`Message ${participantPrimaryName(row)}`}
                                  onClick={() => {
                                    setMessagingParticipantId(row.memberId);
                                    openConversation({ participantId: row.memberId });
                                  }}
                                >
                                  {isOpeningMessage && messagingParticipantId === row.memberId
                                    ? "Opening…"
                                    : "Message"}
                                </Button>
                              ) : null}
                              {row.status === "active" && row.role !== "admin" ? (
                                <Button
                                  type="button"
                                  variant="danger"
                                  className="admin-participants-table__action"
                                  aria-label={`Suspend ${participantPrimaryName(row)}`}
                                  onClick={() => {
                                    setSuspendReason("community_standards_violation");
                                    setSuspendTarget(row);
                                  }}
                                >
                                  Suspend
                                </Button>
                              ) : null}
                              {row.status === "disabled" ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="admin-participants-table__action"
                                  aria-label={`Review or restore ${participantPrimaryName(row)}`}
                                  onClick={() => setRestoreTarget(row)}
                                >
                                  Review / Restore
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="admin-participants-pagination">
              <p className="hu-caption">
                Showing {pageStart}–{pageEnd} of {total}
              </p>
              <div className="admin-participants-pagination__actions">
                <Button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  disabled={!canNext}
                  onClick={() => setOffset((current) => current + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </ProfileSection>

      <ProfileSection title="Deferred administrative commands">
        <p className="hu-body">
          Role changes, password reset, Fair edits, and identity mutations are not available on
          this directory. They require explicit admin command APIs.
        </p>
      </ProfileSection>

      <ConfirmDialog
        isOpen={suspendTarget !== null}
        title="Suspend Participant?"
        description={
          suspendTarget ? (
            <div className="admin-participants-suspend">
              <p className="hu-body">
                Suspend <strong>{participantPrimaryName(suspendTarget)}</strong>
                {suspendTarget.email ? ` (${suspendTarget.email})` : ""}. They will lose normal
                access and receive a review request email.
              </p>
              <label className="admin-participants-suspend__label">
                Reason
                <select
                  value={suspendReason}
                  onChange={(event) =>
                    setSuspendReason(event.target.value as ParticipantSuspensionReasonCode)
                  }
                  disabled={suspending}
                >
                  {PARTICIPANT_SUSPENSION_REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null
        }
        confirmLabel="Suspend Participant"
        isConfirming={suspending}
        onCancel={() => {
          if (!suspending) {
            setSuspendTarget(null);
          }
        }}
        onConfirm={() => {
          void confirmSuspend();
        }}
      />

      <ConfirmDialog
        isOpen={restoreTarget !== null}
        title="Restore Participant?"
        description={
          restoreTarget ? (
            <div className="admin-participants-suspend">
              <p className="hu-body">
                Restore access for <strong>{participantPrimaryName(restoreTarget)}</strong>.
              </p>
              {restoreTarget.suspension ? (
                <dl className="admin-participants-suspend__meta">
                  <div>
                    <dt>Reason</dt>
                    <dd>
                      {formatParticipantSuspensionReasonLabel(restoreTarget.suspension.reasonCode)}
                    </dd>
                  </div>
                  <div>
                    <dt>Suspended</dt>
                    <dd>{formatCompactDate(restoreTarget.suspension.suspendedAt)}</dd>
                  </div>
                  {restoreTarget.suspension.hasPendingReview ? (
                    <div>
                      <dt>Review request</dt>
                      <dd>
                        {restoreTarget.suspension.reviewExplanation?.trim()
                          ? restoreTarget.suspension.reviewExplanation
                          : "Pending (submitted)"}
                      </dd>
                    </div>
                  ) : (
                    <div>
                      <dt>Review request</dt>
                      <dd>None pending</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="hu-caption">No suspension details available for this account.</p>
              )}
            </div>
          ) : null
        }
        confirmLabel="Restore Participant"
        destructive={false}
        isConfirming={restoring}
        onCancel={() => {
          if (!restoring) {
            setRestoreTarget(null);
          }
        }}
        onConfirm={() => {
          void confirmRestore();
        }}
      />
    </div>
  );
}
