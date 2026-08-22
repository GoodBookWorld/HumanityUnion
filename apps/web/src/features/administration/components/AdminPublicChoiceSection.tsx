"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { AdminPublicChoiceDirectoryItem, AuthUserPublic } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { WorkspaceStatusBadge } from "../../initiative-workspace-ux/components/WorkspaceStatusBadge";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import {
  blockAdminPublicChoiceElection,
  listAdminPublicChoiceElections,
  unblockAdminPublicChoiceElection,
} from "../admin-public-choice-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-initiatives.css";
import "./admin-public-choice.css";

interface AdminPublicChoiceSectionProps {
  user: AuthUserPublic;
}

const PAGE_SIZE = 25;

type PendingModeration =
  | { kind: "block"; row: AdminPublicChoiceDirectoryItem }
  | { kind: "unblock"; row: AdminPublicChoiceDirectoryItem }
  | null;

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

function publicElectionHref(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}`;
}

/**
 * Fix 08C — Admin Public Choice election directory.
 */
export function AdminPublicChoiceSection({ user: _user }: AdminPublicChoiceSectionProps) {
  const [rows, setRows] = useState<readonly AdminPublicChoiceDirectoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [blockedFilter, setBlockedFilter] = useState<"" | "blocked" | "unblocked">("");
  const [sort, setSort] = useState<"updatedAt" | "createdAt" | "title">("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [pending, setPending] = useState<PendingModeration>(null);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDenied(false);

    try {
      const response = await listAdminPublicChoiceElections({
        search: search || undefined,
        blocked: blockedFilter || undefined,
        sort,
        order,
        limit: PAGE_SIZE,
        offset,
      });
      setRows(response.elections);
      setTotal(response.total);
    } catch (loadError: unknown) {
      setRows([]);
      setTotal(0);
      if (isForbiddenError(loadError)) {
        setDenied(true);
        setError("Public Choice directory requires an Administrator account.");
      } else {
        setError(formatAuthFormError(loadError));
      }
    } finally {
      setLoading(false);
    }
  }, [search, blockedFilter, sort, order, offset]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  }

  async function confirmModeration() {
    if (!pending) {
      return;
    }

    setConfirming(true);
    setActionError(null);
    setActionMessage(null);

    try {
      if (pending.kind === "block") {
        await blockAdminPublicChoiceElection({
          initiativeId: pending.row.initiativeId,
        });
        setActionMessage(`Blocked election “${pending.row.electionTitle}”.`);
      } else {
        await unblockAdminPublicChoiceElection({
          initiativeId: pending.row.initiativeId,
        });
        setActionMessage(`Unblocked election “${pending.row.electionTitle}”.`);
      }
      setPending(null);
      await loadDirectory();
    } catch (commandError: unknown) {
      setActionError(formatAuthFormError(commandError));
    } finally {
      setConfirming(false);
    }
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + rows.length, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Public Choice directory">
        <p className="hu-caption admin-panel__note">
          Administrative inventory of PUBLIC_CHOICE elections only. STANDARD Initiatives remain
          under Initiatives. Block freezes interaction without closing the election lifecycle.
        </p>

        <form className="admin-initiatives-filters" onSubmit={applyFilters}>
          <label className="admin-panel__label" htmlFor="admin-public-choice-search">
            Search
          </label>
          <input
            id="admin-public-choice-search"
            className="admin-panel__input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Election title, ID, steward, or country"
          />

          <div className="admin-initiatives-filters__row">
            <label>
              Admin status
              <select
                value={blockedFilter}
                onChange={(event) => {
                  setOffset(0);
                  setBlockedFilter(event.target.value as "" | "blocked" | "unblocked");
                }}
              >
                <option value="">All</option>
                <option value="blocked">Blocked</option>
                <option value="unblocked">Unblocked</option>
              </select>
            </label>

            <label>
              Sort
              <select
                value={`${sort}:${order}`}
                onChange={(event) => {
                  const [nextSort, nextOrder] = event.target.value.split(":") as [
                    "updatedAt" | "createdAt" | "title",
                    "asc" | "desc",
                  ];
                  setOffset(0);
                  setSort(nextSort);
                  setOrder(nextOrder);
                }}
              >
                <option value="updatedAt:desc">Updated (newest)</option>
                <option value="updatedAt:asc">Updated (oldest)</option>
                <option value="createdAt:desc">Created (newest)</option>
                <option value="title:asc">Title (A–Z)</option>
              </select>
            </label>
          </div>

          <Button type="submit" variant="primary">
            Apply filters
          </Button>
        </form>

        {error ? (
          <StatusBanner
            title={denied ? "Access restricted" : "Directory unavailable"}
            message={error}
          />
        ) : null}

        {actionMessage ? (
          <StatusBanner title="Action completed" message={actionMessage} />
        ) : null}
        {actionError ? <StatusBanner title="Action failed" message={actionError} /> : null}

        {loading ? <p className="hu-body">Loading Public Choice elections…</p> : null}

        {!loading && !error ? (
          <>
            <div className="admin-initiatives-table-wrap">
              <table className="admin-initiatives-table admin-initiatives-table--public-choice">
                <thead>
                  <tr>
                    <th scope="col">Election</th>
                    <th scope="col">ID</th>
                    <th scope="col">Country</th>
                    <th scope="col">Author</th>
                    <th scope="col">Start</th>
                    <th scope="col">End</th>
                    <th scope="col">Status</th>
                    <th scope="col">Candidates</th>
                    <th scope="col">Voters</th>
                    <th scope="col">Admin status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={11}>No Public Choice elections match these filters.</td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.initiativeId}>
                        <td>
                          <p className="admin-initiatives-table__title">{row.electionTitle}</p>
                        </td>
                        <td>
                          <code>{row.initiativeId}</code>
                        </td>
                        <td>{row.countrySlug ?? "—"}</td>
                        <td>
                          <p className="admin-initiatives-table__title">
                            {row.stewardDisplayName}
                          </p>
                          {row.stewardUniqueName ? (
                            <p className="hu-caption">@{row.stewardUniqueName}</p>
                          ) : null}
                        </td>
                        <td>{formatCompactDate(row.openedAt)}</td>
                        <td>{formatCompactDate(row.closesAt ?? row.closedAt)}</td>
                        <td>
                          <WorkspaceStatusBadge status={row.votingStatus} />
                        </td>
                        <td>{row.candidateCount}</td>
                        <td>
                          {row.effectiveVoterCount === null
                            ? "—"
                            : String(row.effectiveVoterCount)}
                        </td>
                        <td>
                          <WorkspaceStatusBadge
                            status={row.administrativelyBlocked ? "blocked" : "active"}
                          />
                        </td>
                        <td>
                          <div className="admin-public-choice-actions">
                            <Link
                              className="admin-panel__link"
                              href={publicElectionHref(row.initiativeId)}
                            >
                              View
                            </Link>
                            <Link
                              className="admin-panel__link"
                              href={`/admin/public-choice/${encodeURIComponent(row.initiativeId)}`}
                            >
                              Manage
                            </Link>
                            {row.administrativelyBlocked ? (
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                  setActionError(null);
                                  setActionMessage(null);
                                  setPending({ kind: "unblock", row });
                                }}
                              >
                                Unblock
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="danger"
                                onClick={() => {
                                  setActionError(null);
                                  setActionMessage(null);
                                  setPending({ kind: "block", row });
                                }}
                              >
                                Block
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="admin-initiatives-pagination">
              <p className="hu-caption">
                Showing {pageStart}–{pageEnd} of {total}
              </p>
              <div className="admin-initiatives-pagination__actions">
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

      <ConfirmDialog
        isOpen={pending?.kind === "block"}
        title="Block election?"
        description="This will stop participant interaction with this election until an administrator unblocks it."
        confirmLabel="Block election"
        isConfirming={confirming}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          void confirmModeration();
        }}
      />

      <ConfirmDialog
        isOpen={pending?.kind === "unblock"}
        title="Unblock election?"
        description="This will restore interaction if the election is otherwise open."
        confirmLabel="Unblock election"
        destructive={false}
        isConfirming={confirming}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          void confirmModeration();
        }}
      />
    </div>
  );
}
