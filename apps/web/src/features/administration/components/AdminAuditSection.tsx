"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import type { AdminAuditBrowserItem, AdminAuditCategory, AuthUserPublic } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import { listAdminAudit } from "../admin-audit-api";
import {
  ADMIN_AUDIT_CATEGORY_OPTIONS,
  formatAdminAuditCategoryLabel,
  formatAdminAuditDateTime,
} from "../admin-audit-labels";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-publishing.css";
import "./admin-audit.css";

interface AdminAuditSectionProps {
  user: AuthUserPublic;
}

const PAGE_SIZE = 25;

export function AdminAuditSection({ user: _user }: AdminAuditSectionProps) {
  const searchId = useId();
  const categoryId = useId();
  const actionId = useId();
  const fromId = useId();
  const toId = useId();

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [category, setCategory] = useState<AdminAuditCategory | "">("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);

  const [items, setItems] = useState<readonly AdminAuditBrowserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [searchBounded, setSearchBounded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void listAdminAudit({
      q: appliedSearch || undefined,
      category: category || undefined,
      action: action.trim() || undefined,
      from: from.trim() ? new Date(from).toISOString() : undefined,
      to: to.trim() ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setItems(response.items);
        setTotal(response.total);
        setSearchBounded(Boolean(response.searchBounded));
        setError(null);
        setDenied(false);
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setItems([]);
        setTotal(0);
        if (isForbiddenError(loadError)) {
          setDenied(true);
          setError("Audit browsing requires an Administrator account.");
        } else {
          setError(formatAuthFormError(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appliedSearch, category, action, from, to, offset]);

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + items.length, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  function applySearch(event: React.FormEvent) {
    event.preventDefault();
    setOffset(0);
    setAppliedSearch(searchInput.trim());
  }

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Audit">
        <p className="hu-caption admin-panel__note">
          Append-only record of important Administration actions — who changed what, and when.
          Retention policy is governance-owned; this browser does not delete or archive events.
        </p>

        <form className="admin-publishing__toolbar admin-audit__filters" onSubmit={applySearch}>
          <label className="admin-panel__label" htmlFor={searchId}>
            Search audit
          </label>
          <input
            id={searchId}
            className="admin-panel__input"
            type="search"
            placeholder="Search audit…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            autoComplete="off"
          />

          <label className="admin-panel__label" htmlFor={categoryId}>
            Category
          </label>
          <select
            id={categoryId}
            className="admin-panel__input"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as AdminAuditCategory | "");
              setOffset(0);
            }}
          >
            {ADMIN_AUDIT_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="admin-panel__label" htmlFor={actionId}>
            Action
          </label>
          <input
            id={actionId}
            className="admin-panel__input"
            type="text"
            placeholder="e.g. beta.invite.revoke"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setOffset(0);
            }}
            autoComplete="off"
          />

          <label className="admin-panel__label" htmlFor={fromId}>
            From
          </label>
          <input
            id={fromId}
            className="admin-panel__input"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setOffset(0);
            }}
          />

          <label className="admin-panel__label" htmlFor={toId}>
            To
          </label>
          <input
            id={toId}
            className="admin-panel__input"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setOffset(0);
            }}
          />

          <Button type="submit">Search</Button>
        </form>

        {searchBounded ? (
          <p className="hu-caption admin-panel__note">
            Search is bounded to the newest 500 matching filtered records.
          </p>
        ) : null}

        {loading ? <p className="hu-body">Loading audit records…</p> : null}
        {error ? (
          <StatusBanner
            title={denied ? "Access restricted" : "Audit unavailable"}
            message={error}
          />
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <p className="hu-body">No audit records match the current filters.</p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <>
            <div className="admin-publishing-table-wrap admin-audit__table-wrap">
              <table className="admin-publishing-table admin-audit__table">
                <thead>
                  <tr>
                    <th scope="col">Date / time</th>
                    <th scope="col">Action</th>
                    <th scope="col">Category</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Target</th>
                    <th scope="col">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.auditId}>
                      <td>{formatAdminAuditDateTime(row.createdAt)}</td>
                      <td>
                        <code className="admin-audit__action">{row.action}</code>
                      </td>
                      <td>{formatAdminAuditCategoryLabel(row.category)}</td>
                      <td>{row.actorLabel}</td>
                      <td>
                        {row.targetHref ? (
                          <Link className="admin-panel__link" href={row.targetHref}>
                            {row.targetLabel}
                          </Link>
                        ) : (
                          row.targetLabel
                        )}
                      </td>
                      <td>{row.safeSummary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-audit__pagination">
              <p className="hu-caption">
                Showing {pageStart}–{pageEnd} of {total}
              </p>
              <div className="admin-audit__pagination-actions">
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
    </div>
  );
}
