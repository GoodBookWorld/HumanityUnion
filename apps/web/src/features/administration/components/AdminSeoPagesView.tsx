"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import {
  filterSeoPageInventoryRows,
  formatSeoCapabilityLabel,
  formatSeoModeLabel,
  isSeoPageOverrideEditableFamily,
  type SeoCapabilityStatus,
  type SeoPageFamilyId,
  type SeoPageInventoryRow,
} from "../admin-seo-console-model";
import { AdminSeoPageEditorModal } from "./AdminSeoPageEditorModal";

import "./admin-seo-console.css";

interface AdminSeoPagesViewProps {
  rows: readonly SeoPageInventoryRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const FAMILY_OPTIONS: Array<{ value: "all" | SeoPageFamilyId; label: string }> = [
  { value: "all", label: "All families" },
  { value: "home", label: "Home" },
  { value: "country", label: "Countries" },
  { value: "blog", label: "Blog" },
  { value: "initiative", label: "Initiatives" },
  { value: "participant-profile", label: "Participant Profiles" },
  { value: "petition", label: "Petitions" },
  { value: "knowledge", label: "Knowledge" },
  { value: "civic-archive", label: "Civic Archive" },
];

const STATUS_OPTIONS: Array<{ value: "all" | SeoCapabilityStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "healthy", label: "Healthy" },
  { value: "warning", label: "Warning" },
  { value: "missing", label: "Missing" },
  { value: "not_applicable", label: "Not applicable" },
];

export function AdminSeoPagesView({ rows, loading, error, onRetry }: AdminSeoPagesViewProps) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<"all" | SeoPageFamilyId>("all");
  const [status, setStatus] = useState<"all" | SeoCapabilityStatus>("all");
  const [editingRow, setEditingRow] = useState<SeoPageInventoryRow | null>(null);

  const filtered = useMemo(
    () => filterSeoPageInventoryRows(rows, { query, family, status }),
    [rows, query, family, status],
  );

  return (
    <div className="admin-seo-console__panel">
      <ProfileSection title="Pages inventory">
        <p className="hu-caption admin-seo-console__lede">
          Public SEO inventory from safe enumeration sources. Use Edit SEO for Country, Initiative,
          Knowledge, and Civic Archive overrides. Blog uses the existing publication optimization
          editor. Petition SEO editing stays deferred until canonical ownership is resolved.
        </p>

        <div className="admin-seo-console__toolbar">
          <div className="admin-seo-console__field admin-seo-console__field--search">
            <label htmlFor="admin-seo-pages-search">Search</label>
            <input
              id="admin-seo-pages-search"
              type="search"
              value={query}
              placeholder="Title, path, or code"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="admin-seo-console__field">
            <label htmlFor="admin-seo-pages-family">Entity type</label>
            <select
              id="admin-seo-pages-family"
              value={family}
              onChange={(event) => setFamily(event.target.value as "all" | SeoPageFamilyId)}
            >
              {FAMILY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-seo-console__field">
            <label htmlFor="admin-seo-pages-status">SEO status</label>
            <select
              id="admin-seo-pages-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | SeoCapabilityStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="secondary" disabled={loading} onClick={onRetry}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>

        <p className="hu-caption admin-seo-console__count">
          {loading && rows.length === 0
            ? "Loading page inventory…"
            : `Showing ${filtered.length} of ${rows.length} entries`}
        </p>

        {error ? <p className="hu-body">{error}</p> : null}

        <div className="admin-seo-console__table-wrap">
          <table className="admin-seo-console__table">
            <thead>
              <tr>
                <th scope="col">Page / Entity</th>
                <th scope="col">Canonical path</th>
                <th scope="col">Metadata</th>
                <th scope="col">Sitemap</th>
                <th scope="col">Structured Data</th>
                <th scope="col">SEO mode</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <p className="admin-seo-console__title">{row.title}</p>
                    <p className="hu-caption admin-seo-console__family">{row.familyLabel}</p>
                    {row.note ? (
                      <p className="hu-caption admin-seo-console__note">{row.note}</p>
                    ) : null}
                  </td>
                  <td>
                    <p className="admin-seo-console__path">{row.canonicalPath}</p>
                  </td>
                  <td>
                    <CapabilityPill status={row.metadata} />
                  </td>
                  <td>
                    <CapabilityPill status={row.sitemap} />
                  </td>
                  <td>
                    <CapabilityPill status={row.structuredData} />
                  </td>
                  <td>
                    <span className={`admin-seo-console__pill admin-seo-console__pill--${row.seoMode}`}>
                      {formatSeoModeLabel(row.seoMode)}
                    </span>
                  </td>
                  <td>
                    <RowActions row={row} onEditSeo={setEditingRow} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="admin-seo-console__mobile-list">
          {filtered.map((row) => (
            <li key={`mobile-${row.id}`}>
              <article className="admin-seo-console__mobile-card">
                <p className="admin-seo-console__title">{row.title}</p>
                <p className="hu-caption admin-seo-console__family">{row.familyLabel}</p>
                <p className="admin-seo-console__path">{row.canonicalPath}</p>
                {row.note ? <p className="hu-caption admin-seo-console__note">{row.note}</p> : null}
                <div className="admin-seo-console__mobile-meta">
                  <CapabilityPill status={row.metadata} />
                  <CapabilityPill status={row.sitemap} />
                  <CapabilityPill status={row.structuredData} />
                  <span className={`admin-seo-console__pill admin-seo-console__pill--${row.seoMode}`}>
                    {formatSeoModeLabel(row.seoMode)}
                  </span>
                </div>
                <RowActions row={row} onEditSeo={setEditingRow} />
              </article>
            </li>
          ))}
        </ul>

        {!loading && filtered.length === 0 ? (
          <p className="hu-body">No inventory rows match the current filters.</p>
        ) : null}
      </ProfileSection>

      <AdminSeoPageEditorModal
        row={editingRow}
        isOpen={Boolean(editingRow)}
        onClose={() => setEditingRow(null)}
        onSaved={onRetry}
      />
    </div>
  );
}

function CapabilityPill({ status }: { status: SeoCapabilityStatus }) {
  return (
    <span className={`admin-seo-console__pill admin-seo-console__pill--${status}`}>
      {formatSeoCapabilityLabel(status)}
    </span>
  );
}

function RowActions({
  row,
  onEditSeo,
}: {
  row: SeoPageInventoryRow;
  onEditSeo: (row: SeoPageInventoryRow) => void;
}) {
  if (row.inventoryKind === "family-deferred" || !row.publicHref) {
    if (row.family === "petition") {
      return <span className="hu-caption">Initiative-owned — not independently indexed</span>;
    }
    return <span className="hu-caption">Inspect (family)</span>;
  }

  return (
    <div className="admin-seo-console__actions">
      {isSeoPageOverrideEditableFamily(row.family) ? (
        <button
          type="button"
          className="admin-panel__link"
          onClick={() => {
            onEditSeo(row);
          }}
        >
          Edit SEO
        </button>
      ) : null}
      {row.family === "blog" ? (
        <Link
          className="admin-panel__link"
          href={`/workspace/publishing/${encodeURIComponent(row.descriptor.entityKey)}`}
        >
          Edit Blog SEO
        </Link>
      ) : null}
      <Link className="admin-panel__link" href={row.publicHref} target="_blank" rel="noreferrer">
        Open public page
      </Link>
    </div>
  );
}
