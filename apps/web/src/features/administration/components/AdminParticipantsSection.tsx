"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type {
  AdminParticipantDirectoryItem,
  AuthUserPublic,
  MembershipStatisticsPayload,
  PlatformStatisticsCounts,
  PlatformStatisticsMeta,
} from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
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
import { listAdminParticipants } from "../admin-participant-directory-api";
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
  return status === "active" ? "Active" : "Disabled";
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

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "active" | "disabled">("");
  const [role, setRole] = useState<"" | "member" | "admin">("");
  const [membershipStatus, setMembershipStatus] = useState("");
  const [sort, setSort] = useState<"createdAt" | "lastLoginAt" | "email">("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

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
                <option value="disabled">Disabled</option>
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
                      const profileHref = row.uniqueName
                        ? `/member/${encodeURIComponent(row.uniqueName)}`
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
                            {profileHref ? (
                              <Link className="admin-panel__link" href={profileHref}>
                                View public profile
                              </Link>
                            ) : (
                              <span className="hu-caption">No public name</span>
                            )}
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
          Suspend/ban, role changes, password reset, Fair edits, and identity mutations are not
          available on this directory. They require explicit admin command APIs.
        </p>
      </ProfileSection>
    </div>
  );
}
