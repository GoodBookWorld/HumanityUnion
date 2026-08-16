"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type {
  AdminInitiativeDirectoryAggregates,
  AdminInitiativeDirectoryItem,
  AuthUserPublic,
  InitiativeLifecyclePhase,
  InitiativeStatus,
  InitiativeVisibilityPolicy,
} from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { WorkspaceStatusBadge } from "../../initiative-workspace-ux/components/WorkspaceStatusBadge";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import { listAdminInitiatives } from "../admin-initiative-directory-api";
import { AdminMetricDetailsGrid } from "./AdminMetricDetailsGrid";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-initiatives.css";

interface AdminInitiativesSectionProps {
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

function formatGeography(row: AdminInitiativeDirectoryItem): string {
  const parts = [
    row.geography.countrySlug,
    row.geography.regionSlug,
    row.geography.region,
  ].filter(Boolean);
  return parts.length > 0 ? Array.from(new Set(parts)).join(" · ") : "—";
}

/**
 * Admin Initiative directory — Pack 05.
 * Server-paginated via GET /api/v1/admin/initiatives (not the world list API).
 */
export function AdminInitiativesSection({ user: _user }: AdminInitiativesSectionProps) {
  const [rows, setRows] = useState<readonly AdminInitiativeDirectoryItem[]>([]);
  const [aggregates, setAggregates] = useState<AdminInitiativeDirectoryAggregates | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [lifecyclePhase, setLifecyclePhase] = useState<"" | InitiativeLifecyclePhase>("");
  const [status, setStatus] = useState<"" | InitiativeStatus>("");
  const [visibility, setVisibility] = useState<"" | InitiativeVisibilityPolicy>("");
  const [geographyInput, setGeographyInput] = useState("");
  const [geography, setGeography] = useState("");
  const [sort, setSort] = useState<"updatedAt" | "createdAt" | "title">("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDenied(false);

    try {
      const response = await listAdminInitiatives({
        search: search || undefined,
        lifecyclePhase: lifecyclePhase || undefined,
        status: status || undefined,
        visibility: visibility || undefined,
        geography: geography || undefined,
        sort,
        order,
        limit: PAGE_SIZE,
        offset,
      });
      setRows(response.initiatives);
      setAggregates(response.aggregates);
      setTotal(response.total);
    } catch (loadError: unknown) {
      setRows([]);
      setAggregates(null);
      setTotal(0);
      if (isForbiddenError(loadError)) {
        setDenied(true);
        setError("Initiative directory requires an Administrator account.");
      } else {
        setError(formatAuthFormError(loadError));
      }
    } finally {
      setLoading(false);
    }
  }, [search, lifecyclePhase, status, visibility, geography, sort, order, offset]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
    setGeography(geographyInput.trim());
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + rows.length, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Initiative aggregates">
        <AdminMetricDetailsGrid
          aria-label="Initiative aggregates"
          cells={[
            {
              label: "Total Initiatives",
              value: aggregates ? String(aggregates.total) : "Unavailable",
            },
            {
              label: "Public",
              value: aggregates ? String(aggregates.public) : "Unavailable",
            },
            {
              label: "Draft / non-public",
              value: aggregates ? String(aggregates.nonPublic) : "Unavailable",
            },
            {
              label: "Active lifecycle",
              value: aggregates ? String(aggregates.activeLifecycle) : "Unavailable",
            },
            {
              label: "Archived",
              value: aggregates ? String(aggregates.archived) : "Unavailable",
            },
            {
              label: "Proposals",
              value: aggregates ? String(aggregates.proposals) : "Unavailable",
            },
          ]}
        />
      </ProfileSection>

      <ProfileSection title="Initiative directory">
        <p className="hu-caption admin-panel__note">
          Server-paginated administrative inventory. Author Workspace remains the canonical
          content/lifecycle operator surface. Admin actions are explicit commands only.
        </p>

        <form className="admin-initiatives-filters" onSubmit={applyFilters}>
          <label className="admin-panel__label" htmlFor="admin-initiative-search">
            Search
          </label>
          <input
            id="admin-initiative-search"
            className="admin-panel__input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Title, ID, steward, or geography"
          />

          <div className="admin-initiatives-filters__row">
            <label>
              Lifecycle
              <select
                value={lifecyclePhase}
                onChange={(event) => {
                  setOffset(0);
                  setLifecyclePhase(event.target.value as "" | InitiativeLifecyclePhase);
                }}
              >
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="projected">Projected</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <label>
              Status
              <select
                value={status}
                onChange={(event) => {
                  setOffset(0);
                  setStatus(event.target.value as "" | InitiativeStatus);
                }}
              >
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="discussion">Discussion</option>
                <option value="revision">Revision</option>
                <option value="petition">Petition</option>
                <option value="implementation">Implementation</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <label>
              Visibility
              <select
                value={visibility}
                onChange={(event) => {
                  setOffset(0);
                  setVisibility(event.target.value as "" | InitiativeVisibilityPolicy);
                }}
              >
                <option value="">All</option>
                <option value="public">Public</option>
                <option value="steward_only">Steward only</option>
              </select>
            </label>

            <label>
              Geography
              <input
                type="search"
                value={geographyInput}
                onChange={(event) => setGeographyInput(event.target.value)}
                placeholder="Country / region"
              />
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

        {loading ? <p className="hu-body">Loading initiatives…</p> : null}

        {!loading && !error ? (
          <>
            <div className="admin-initiatives-table-wrap">
              <table className="admin-initiatives-table">
                <thead>
                  <tr>
                    <th scope="col">Initiative</th>
                    <th scope="col">Author</th>
                    <th scope="col">Geography</th>
                    <th scope="col">Lifecycle</th>
                    <th scope="col">Status</th>
                    <th scope="col">Visibility</th>
                    <th scope="col">Proposals</th>
                    <th scope="col">Decision</th>
                    <th scope="col">Updated</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10}>No initiatives match these filters.</td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.initiativeId}>
                        <td>
                          <p className="admin-initiatives-table__title">{row.title}</p>
                          <p className="hu-caption admin-initiatives-table__meta">
                            {row.publiclyProjected ? "Publicly projected" : "Not public"}
                            {row.integrityStatus === "warning" ? " · Integrity warning" : ""}
                          </p>
                        </td>
                        <td>
                          <p className="admin-initiatives-table__title">{row.stewardDisplayName}</p>
                          {row.stewardUniqueName ? (
                            <p className="hu-caption">@{row.stewardUniqueName}</p>
                          ) : null}
                        </td>
                        <td>{formatGeography(row)}</td>
                        <td>
                          <WorkspaceStatusBadge status={row.lifecyclePhase} />
                        </td>
                        <td>
                          <WorkspaceStatusBadge status={row.status} />
                        </td>
                        <td>
                          <WorkspaceStatusBadge
                            status={row.visibility === "public" ? "public" : "steward only"}
                          />
                        </td>
                        <td>{row.proposalCount}</td>
                        <td>{row.decisionSummary ?? "—"}</td>
                        <td>{formatCompactDate(row.updatedAt)}</td>
                        <td>
                          <Link
                            className="admin-panel__link"
                            href={`/admin/initiatives/${encodeURIComponent(row.initiativeId)}`}
                          >
                            Inspect
                          </Link>
                          {row.publiclyProjected ? (
                            <>
                              {" · "}
                              <Link
                                className="admin-panel__link"
                                href={`/initiatives/public/${encodeURIComponent(row.initiativeId)}`}
                              >
                                Public page
                              </Link>
                            </>
                          ) : null}
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

      <ProfileSection title="Deferred administrative commands">
        <p className="hu-body">
          Force-edit of authored title/body, steward reassignment, and force lifecycle
          transitions are not available. Public visibility hide/restore is available on the
          Initiative detail page when the Initiative is projected.
        </p>
      </ProfileSection>
    </div>
  );
}
