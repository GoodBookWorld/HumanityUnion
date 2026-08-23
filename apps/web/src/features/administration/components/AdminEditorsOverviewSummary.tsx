"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { formatAuthFormError } from "../../../lib/api-client";
import { fetchAdminEditorSummary } from "../admin-editors-api";

/**
 * Pack 12A — Overview compact Editors management summary.
 * Replaces the Pack 11B informational "current Admin is Editor World" widget.
 */
export function AdminEditorsOverviewSummary() {
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetchAdminEditorSummary()
      .then((summary) => {
        if (cancelled) {
          return;
        }
        setActiveCount(summary.activeCount);
        setTotal(summary.total);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(formatAuthFormError(err));
        setActiveCount(null);
        setTotal(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="admin-editors-summary">
      <p className="admin-editors-summary__lede">
        Delegated Editors can receive scoped editing access without Admin Panel authority.
      </p>
      <dl className="admin-editors-summary__stats" aria-label="Editors summary">
        <div>
          <dt>Active editors</dt>
          <dd>{loading ? "…" : error ? "Unavailable" : String(activeCount ?? 0)}</dd>
        </div>
        <div>
          <dt>Total editors</dt>
          <dd>{loading ? "…" : error ? "Unavailable" : String(total ?? 0)}</dd>
        </div>
      </dl>
      {error ? <p className="hu-caption admin-editors-summary__error">{error}</p> : null}
      <div className="admin-editors-summary__actions">
        <Link className="admin-panel__link" href="/admin/editors">
          Manage Editors
        </Link>
        <Button href="/admin/editors/new" variant="secondary">
          Add Editor
        </Button>
      </div>
    </div>
  );
}
