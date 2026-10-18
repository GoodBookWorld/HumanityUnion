"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { AdminMemberBadgeOrderModal } from "./AdminMemberBadgeOrderModal";
import { AdminMetricDetailsGrid } from "./AdminMetricDetailsGrid";
import { AdminPanelNavigation } from "./AdminPanelNavigation";
import {
  PARTICIPANT_SELECTION_CAP,
  classifyRestoreTargets,
  classifySuspendTargets,
  countEmailWarnings,
  createSequentialParticipantMutationRunner,
  pageCheckboxState,
  selectAllParticipantsOnPage,
  toggleParticipantSelection,
  type ParticipantMutationBatchResult,
} from "../participant-directory-selection";

import "./admin-panel.css";
import "./admin-participants-table.css";
import "./admin-member-badge-order.css";

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

function formatEmailVerificationStatus(status: string): string {
  return status === "verified" ? "Verified" : "Pending";
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
    application_submitted: "Application submitted",
    pending_payment: "Pending payment",
    active_member: "Active Members",
  };

  return statusLabels[row.membership.status] ?? row.membership.status.replace(/_/g, " ");
}

function formatBadgePaymentLabel(status: string | undefined): string {
  if (status === "paid") {
    return "Paid";
  }
  if (status === "refunded") {
    return "Refunded";
  }
  return "Unpaid";
}

function formatBadgeFulfillmentLabel(row: AdminParticipantDirectoryItem): string {
  const order = row.memberBadgeOrder;
  if (!order) {
    return "—";
  }
  if (order.delivered || order.fulfillmentStatus === "completed") {
    return "Delivered";
  }
  if (order.shipped || order.fulfillmentStatus === "shipped") {
    return "Shipped";
  }
  if (order.fulfillmentStatus === "preparing") {
    return "Preparing";
  }
  if (order.fulfillmentStatus === "awaiting_fulfillment") {
    return "Awaiting fulfillment";
  }
  return order.fulfillmentStatus.replace(/_/g, " ");
}

export function AdminParticipantsSection({ user }: AdminParticipantsSectionProps) {
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
  const [emailVerification, setEmailVerification] = useState<"" | "pending" | "verified">("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedById, setSelectedById] = useState<Map<string, AdminParticipantDirectoryItem>>(
    () => new Map(),
  );
  const [selectionLimitReached, setSelectionLimitReached] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | "suspend" | "restore">(null);
  const [suspendReason, setSuspendReason] = useState<ParticipantSuspensionReasonCode>(
    "community_standards_violation",
  );
  const [batchRunning, setBatchRunning] = useState(false);
  const batchRunnerRef = useRef(createSequentialParticipantMutationRunner());
  const previousFilterKey = useRef<string | null>(null);
  const [badgeOrderApplicationId, setBadgeOrderApplicationId] = useState<string | null>(null);

  const {
    isOpening: isOpeningMessage,
    errorMessage: messageError,
    openConversation,
  } = useOpenDirectConversation();
  const [messagingParticipantId, setMessagingParticipantId] = useState<string | null>(null);

  const isBadgeOrdersView = membershipStatus === "member_badge_orders";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const badgeApplicationId = params.get("badgeApplicationId")?.trim();

    if (view === "member_badge_orders") {
      setMembershipStatus("member_badge_orders");
      setOffset(0);
    }

    if (badgeApplicationId) {
      setBadgeOrderApplicationId(badgeApplicationId);
      if (view !== "member_badge_orders") {
        setMembershipStatus("member_badge_orders");
        setOffset(0);
      }
    }
  }, []);

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
        emailVerificationStatus: emailVerification || undefined,
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
  }, [search, status, role, membershipStatus, emailVerification, sort, order, offset]);

  const filterKey = `${search}|${status}|${role}|${membershipStatus}|${emailVerification}|${sort}|${order}`;

  useEffect(() => {
    if (previousFilterKey.current === null) {
      previousFilterKey.current = filterKey;
      return;
    }

    if (previousFilterKey.current === filterKey) {
      return;
    }

    previousFilterKey.current = filterKey;
    setSelectedIds([]);
    setSelectedById(new Map());
    setSelectionLimitReached(false);
  }, [filterKey]);

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

  function clearSelection() {
    setSelectedIds([]);
    setSelectedById(new Map());
    setSelectionLimitReached(false);
  }

  function rememberSelectedRows(nextIds: readonly string[]) {
    const keep = new Set(nextIds);
    setSelectedById((current) => {
      const next = new Map(current);
      for (const memberId of next.keys()) {
        if (!keep.has(memberId)) {
          next.delete(memberId);
        }
      }
      for (const row of rows) {
        if (keep.has(row.memberId)) {
          next.set(row.memberId, row);
        }
      }
      return next;
    });
  }

  function applySelection(nextIds: string[], limitReached: boolean) {
    setSelectedIds(nextIds);
    setSelectionLimitReached(limitReached);
    rememberSelectedRows(nextIds);
  }

  const selectedRecords = useMemo(
    () =>
      selectedIds
        .map((memberId) => selectedById.get(memberId))
        .filter((row): row is AdminParticipantDirectoryItem => Boolean(row)),
    [selectedById, selectedIds],
  );
  const suspendClassification = useMemo(
    () => classifySuspendTargets(selectedRecords, user.memberId),
    [selectedRecords, user.memberId],
  );
  const restoreClassification = useMemo(
    () => classifyRestoreTargets(selectedRecords),
    [selectedRecords],
  );
  const singleSelection = selectedRecords.length === 1 ? selectedRecords[0] : null;
  const canViewProfile = Boolean(singleSelection?.publicName?.trim());
  const canMessage = singleSelection?.status === "active";
  const pageMemberIds = isBadgeOrdersView ? [] : rows.map((row) => row.memberId);
  const pageSelection = pageCheckboxState(selectedIds, pageMemberIds);
  const selectionAtCap = selectedIds.length >= PARTICIPANT_SELECTION_CAP;

  function describeBatch(
    action: "Suspended" | "Restored",
    skippedCount: number,
    result: ParticipantMutationBatchResult,
  ): string {
    const emailWarnings = countEmailWarnings(result.succeeded);
    const parts = [
      `${action} ${result.succeeded.length}.`,
      `Skipped ${skippedCount}.`,
      `Failed ${result.failed.length}.`,
      `Email warnings ${emailWarnings}.`,
    ];

    if (emailWarnings > 0) {
      parts.push("Successful account changes are kept when a notification email fails.");
    }

    const failureDetail = result.failed
      .map((failure) => failure.message)
      .filter((message) => message.length > 0)
      .slice(0, 3)
      .join(" ");

    if (failureDetail) {
      parts.push(failureDetail);
    }

    return parts.join(" ");
  }

  async function runModerationBatch(
    action: "suspend" | "restore",
    memberIds: readonly string[],
    skippedCount: number,
  ) {
    if (batchRunnerRef.current.isRunning()) {
      setActionMessage("A directory update is already running.");
      return;
    }

    setBatchRunning(true);
    setActionMessage(null);

    try {
      const result = await batchRunnerRef.current.run(
        memberIds,
        async (memberId): Promise<{ emailQueued: boolean; emailWarning?: string }> => {
          if (action === "suspend") {
            return suspendAdminParticipant(memberId, suspendReason);
          }
          return restoreAdminParticipant(memberId);
        },
      );

      if (result.blockedDuplicate) {
        setActionMessage("A directory update is already running.");
        return;
      }

      setPendingAction(null);
      setActionMessage(
        describeBatch(action === "suspend" ? "Suspended" : "Restored", skippedCount, result),
      );
      clearSelection();
      await loadDirectory();
    } finally {
      setBatchRunning(false);
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
            {
              label: "Application started",
              value:
                membership && typeof membership.applicationStarted === "number"
                  ? formatMembershipStatisticValue(membership.applicationStarted)
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
              Account status
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
              Email verification
              <select
                value={emailVerification}
                onChange={(event) => {
                  setOffset(0);
                  setEmailVerification(event.target.value as "" | "pending" | "verified");
                }}
              >
                <option value="">All</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
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
                <option value="application_submitted">Application submitted</option>
                <option value="active_member">Active Members</option>
                <option value="member_badge_orders">Member Badge Orders</option>
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
            {isBadgeOrdersView ? null : (
              <div className="admin-participants-toolbar" role="region" aria-label="Participant actions">
                <p className="hu-caption admin-participants-toolbar__count" role="status">
                  {selectedIds.length === 1
                    ? "1 participant selected"
                    : `${selectedIds.length} participants selected`}
                </p>
                <Button type="button" variant="tertiary" onClick={clearSelection} disabled={batchRunning || selectedIds.length === 0}>
                  Clear selection
                </Button>
                {canViewProfile && singleSelection ? (
                  <Button
                    href={adminParticipantPublicProfilePath(singleSelection.memberId)}
                    variant="secondary"
                    className="admin-participants-toolbar__action"
                    aria-label={`View profile for ${participantPrimaryName(singleSelection)}`}
                  >
                    View profile
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" disabled aria-label="View profile">
                    View profile
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canMessage || isOpeningMessage || batchRunning || !singleSelection}
                  aria-label={
                    singleSelection
                      ? `Message ${participantPrimaryName(singleSelection)}`
                      : "Message"
                  }
                  onClick={() => {
                    if (!singleSelection || singleSelection.status !== "active") {
                      return;
                    }
                    setMessagingParticipantId(singleSelection.memberId);
                    openConversation({ participantId: singleSelection.memberId });
                  }}
                >
                  {isOpeningMessage && singleSelection && messagingParticipantId === singleSelection.memberId
                    ? "Opening…"
                    : "Message"}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={batchRunning || suspendClassification.eligible.length === 0}
                  onClick={() => {
                    setSuspendReason("community_standards_violation");
                    setPendingAction("suspend");
                  }}
                >
                  Suspend
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={batchRunning || restoreClassification.eligible.length === 0}
                  onClick={() => setPendingAction("restore")}
                >
                  Review / Restore
                </Button>
                {selectionLimitReached || selectionAtCap ? (
                  <p className="hu-caption admin-participants-toolbar__limit" role="status">
                    Selection is limited to {PARTICIPANT_SELECTION_CAP} participants. Clear a
                    selection before choosing someone else.
                  </p>
                ) : null}
              </div>
            )}
            <div
              className="admin-participants-table-wrap"
              tabIndex={0}
              role="region"
              aria-label={isBadgeOrdersView ? "Member badge orders" : "Participant directory"}
            >
              <table
                className={[
                  "admin-participants-table",
                  isBadgeOrdersView ? "admin-participants-table--badge-orders" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <thead>
                  <tr>
                    {isBadgeOrdersView ? null : (
                      <th scope="col" className="admin-participants-table__select">
                        <input
                          className="admin-participants-table__checkbox"
                          type="checkbox"
                          checked={pageSelection === "checked"}
                          ref={(element) => {
                            if (element) {
                              element.indeterminate = pageSelection === "indeterminate";
                            }
                          }}
                          aria-label="Select all participants on this page"
                          disabled={batchRunning || pageMemberIds.length === 0}
                          onChange={() => {
                            const next = selectAllParticipantsOnPage(selectedIds, pageMemberIds);
                            applySelection(next.selectedIds, next.limitReached);
                          }}
                        />
                      </th>
                    )}
                    <th scope="col" className="admin-participants-table__participant">
                      Participant
                    </th>
                    <th scope="col" className="admin-participants-table__email">
                      Email
                    </th>
                    {isBadgeOrdersView ? (
                      <>
                        <th scope="col" className="admin-participants-table__categorical">
                          Member Number
                        </th>
                        <th scope="col" className="admin-participants-table__categorical">
                          Payment
                        </th>
                        <th scope="col" className="admin-participants-table__categorical">
                          Fulfillment
                        </th>
                        <th scope="col" className="admin-participants-table__date">
                          Updated
                        </th>
                      </>
                    ) : (
                      <>
                        <th scope="col" className="admin-participants-table__categorical">
                          Account status
                        </th>
                        <th scope="col" className="admin-participants-table__categorical">
                          Email verification
                        </th>
                        <th scope="col" className="admin-participants-table__categorical">
                          Role
                        </th>
                        <th scope="col" className="admin-participants-table__categorical">
                          Member status
                        </th>
                        <th scope="col" className="admin-participants-table__date">
                          Joined
                        </th>
                        <th scope="col" className="admin-participants-table__date">
                          Last active
                        </th>
                      </>
                    )}
                    {isBadgeOrdersView ? (
                      <th scope="col" className="admin-participants-table__actions-heading">
                        Actions
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={isBadgeOrdersView ? 7 : 9}>
                        No participants match these filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const secondary = participantSecondaryName(row);
                      const badgeApplicationId = row.memberBadgeOrder?.applicationId;

                      const rowSelected = selectedIds.includes(row.memberId);

                      return (
                        <tr key={row.userId}>
                          {isBadgeOrdersView ? null : (
                            <td className="admin-participants-table__select">
                              <input
                                className="admin-participants-table__checkbox"
                                type="checkbox"
                                checked={rowSelected}
                                aria-label={`Select ${participantPrimaryName(row)}`}
                                disabled={
                                  batchRunning || (!rowSelected && selectionAtCap)
                                }
                                onChange={() => {
                                  const next = toggleParticipantSelection(selectedIds, row.memberId);
                                  applySelection(next.selectedIds, next.limitReached);
                                }}
                              />
                            </td>
                          )}
                          <td className="admin-participants-table__participant">
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
                              <div className="admin-participants-table__identity-copy">
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
                          <td className="admin-participants-table__email" title={row.email}>
                            <span className="admin-participants-table__email-text">{row.email}</span>
                          </td>
                          {isBadgeOrdersView ? (
                            <>
                              <td className="admin-participants-table__categorical">
                                {row.membership?.memberNumber ?? "—"}
                              </td>
                              <td className="admin-participants-table__categorical">
                                <WorkspaceStatusBadge
                                  status={formatBadgePaymentLabel(
                                    row.memberBadgeOrder?.paymentStatus,
                                  )}
                                />
                              </td>
                              <td className="admin-participants-table__categorical">
                                <WorkspaceStatusBadge
                                  status={formatBadgeFulfillmentLabel(row)}
                                />
                              </td>
                              <td className="admin-participants-table__date">
                                {formatCompactDate(
                                  row.memberBadgeOrder?.updatedAt ?? row.lastLoginAt,
                                )}
                              </td>
                              <td>
                                <div className="admin-participants-table__actions">
                                  {badgeApplicationId ? (
                                    <Button
                                      type="button"
                                      variant="primary"
                                      className="admin-participants-table__action admin-participants-table__view-order"
                                      aria-label={`View order for ${participantPrimaryName(row)}`}
                                      onClick={() =>
                                        setBadgeOrderApplicationId(badgeApplicationId)
                                      }
                                    >
                                      View Order
                                    </Button>
                                  ) : (
                                    <span className="hu-caption admin-participants-table__action--unavailable">
                                      Order unavailable
                                    </span>
                                  )}
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="admin-participants-table__categorical">
                                <WorkspaceStatusBadge status={formatAccountStatus(row.status)} />
                              </td>
                              <td className="admin-participants-table__categorical">
                                <WorkspaceStatusBadge
                                  status={formatEmailVerificationStatus(row.emailVerificationStatus)}
                                />
                              </td>
                              <td className="admin-participants-table__categorical">
                                <span className="admin-participants-table__role">
                                  {formatAccountRole(row.role)}
                                </span>
                              </td>
                              <td className="admin-participants-table__categorical">
                                <WorkspaceStatusBadge status={formatMembershipLabel(row)} />
                              </td>
                              <td className="admin-participants-table__date">
                                {formatCompactDate(row.createdAt)}
                              </td>
                              <td className="admin-participants-table__date">
                                {formatCompactDate(row.lastLoginAt)}
                              </td>
                            </>
                          )}
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

      {badgeOrderApplicationId ? (
        <AdminMemberBadgeOrderModal
          applicationId={badgeOrderApplicationId}
          isOpen={badgeOrderApplicationId !== null}
          onClose={() => setBadgeOrderApplicationId(null)}
          onUpdated={() => {
            void loadDirectory();
          }}
        />
      ) : null}

      <ConfirmDialog
        isOpen={pendingAction === "suspend"}
        title="Suspend participants?"
        description={
          <div className="admin-participants-suspend">
            <p className="hu-body">
              Suspend {suspendClassification.eligible.length} selected participant
              {suspendClassification.eligible.length === 1 ? "" : "s"}.{" "}
              {suspendClassification.skipped.length} selected participant
              {suspendClassification.skipped.length === 1 ? "" : "s"} will be skipped.
              Each successful suspension sends the existing review email.
            </p>
            <label className="admin-participants-suspend__label">
              Reason
              <select
                value={suspendReason}
                onChange={(event) =>
                  setSuspendReason(event.target.value as ParticipantSuspensionReasonCode)
                }
                disabled={batchRunning}
              >
                {PARTICIPANT_SUSPENSION_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        confirmLabel="Suspend participants"
        isConfirming={batchRunning}
        onCancel={() => {
          if (!batchRunning) {
            setPendingAction(null);
          }
        }}
        onConfirm={() => {
          void runModerationBatch(
            "suspend",
            suspendClassification.eligible.map((row) => row.memberId),
            suspendClassification.skipped.length,
          );
        }}
      />

      <ConfirmDialog
        isOpen={pendingAction === "restore"}
        title="Restore participants?"
        description={
          <div className="admin-participants-suspend">
            <p className="hu-body">
              Restore {restoreClassification.eligible.length} selected participant
              {restoreClassification.eligible.length === 1 ? "" : "s"}.{" "}
              {restoreClassification.skipped.length} selected participant
              {restoreClassification.skipped.length === 1 ? "" : "s"} will be skipped.
              Each successful restore sends the existing notification email.
            </p>
            {restoreClassification.eligible.map((row) => (
              <div key={row.memberId}>
                <p className="hu-body">
                  <strong>{participantPrimaryName(row)}</strong>
                  {row.email ? ` (${row.email})` : ""}
                </p>
                {row.suspension ? (
                  <dl className="admin-participants-suspend__meta">
                    <div>
                      <dt>Reason</dt>
                      <dd>
                        {formatParticipantSuspensionReasonLabel(row.suspension.reasonCode)}
                      </dd>
                    </div>
                    <div>
                      <dt>Suspended</dt>
                      <dd>{formatCompactDate(row.suspension.suspendedAt)}</dd>
                    </div>
                    {row.suspension.hasPendingReview ? (
                      <div>
                        <dt>Review request</dt>
                        <dd>
                          {row.suspension.reviewExplanation?.trim()
                            ? row.suspension.reviewExplanation
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
            ))}
          </div>
        }
        confirmLabel="Restore participants"
        destructive={false}
        isConfirming={batchRunning}
        onCancel={() => {
          if (!batchRunning) {
            setPendingAction(null);
          }
        }}
        onConfirm={() => {
          void runModerationBatch(
            "restore",
            restoreClassification.eligible.map((row) => row.memberId),
            restoreClassification.skipped.length,
          );
        }}
      />
    </div>
  );
}
