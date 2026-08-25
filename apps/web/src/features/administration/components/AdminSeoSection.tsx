"use client";

import { useCallback, useEffect, useState } from "react";

import type { AuthUserPublic } from "@hu/types";

import { formatAuthFormError } from "../../../lib/api-client";
import {
  ADMIN_SEO_VIEWS,
  ADMIN_SEO_VIEW_LABELS,
  type AdminSeoViewId,
  type SeoPageInventoryRow,
} from "../admin-seo-console-model";
import { buildSeoDiagnosticsSnapshot } from "../admin-seo-diagnostics-model";
import { loadAdminSeoPageInventory } from "../admin-seo-page-inventory";
import { AdminPanelNavigation } from "./AdminPanelNavigation";
import { AdminSeoDiagnosticsView } from "./AdminSeoDiagnosticsView";
import { AdminSeoOverviewView } from "./AdminSeoOverviewView";
import { AdminSeoPagesView } from "./AdminSeoPagesView";
import { AdminSeoStructuredDataView } from "./AdminSeoStructuredDataView";

import "./admin-panel.css";
import "./admin-seo-console.css";

interface AdminSeoSectionProps {
  user: AuthUserPublic;
}

/**
 * SEO Pack 06 — Admin SEO working console.
 * Overview | Pages | Diagnostics | Structured Data. Read-only; no Page SEO editor.
 */
export function AdminSeoSection({ user: _user }: AdminSeoSectionProps) {
  const [view, setView] = useState<AdminSeoViewId>("overview");
  const diagnostics = buildSeoDiagnosticsSnapshot();
  const [pageRows, setPageRows] = useState<readonly SeoPageInventoryRow[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [pagesLoaded, setPagesLoaded] = useState(false);

  const loadPages = useCallback(async () => {
    setPagesLoading(true);
    setPagesError(null);
    try {
      const rows = await loadAdminSeoPageInventory();
      setPageRows(rows);
      setPagesLoaded(true);
    } catch (error: unknown) {
      setPagesError(formatAuthFormError(error));
    } finally {
      setPagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view !== "pages" || pagesLoaded || pagesLoading) {
      return;
    }
    void loadPages();
  }, [view, pagesLoaded, pagesLoading, loadPages]);

  return (
    <div className="admin-panel admin-seo-console">
      <AdminPanelNavigation />

      <div className="admin-seo-console__tabs" role="tablist" aria-label="SEO areas">
        {ADMIN_SEO_VIEWS.map((viewId) => (
          <button
            key={viewId}
            type="button"
            role="tab"
            aria-selected={view === viewId}
            className={
              view === viewId
                ? "hu-tab-control hu-tab-control--selected admin-publishing__tab"
                : "hu-tab-control admin-publishing__tab"
            }
            onClick={() => setView(viewId)}
          >
            {ADMIN_SEO_VIEW_LABELS[viewId]}
          </button>
        ))}
      </div>

      {view === "overview" ? <AdminSeoOverviewView diagnostics={diagnostics} /> : null}
      {view === "pages" ? (
        <AdminSeoPagesView
          rows={pageRows}
          loading={pagesLoading}
          error={pagesError}
          onRetry={() => {
            void loadPages();
          }}
        />
      ) : null}
      {view === "diagnostics" ? <AdminSeoDiagnosticsView diagnostics={diagnostics} /> : null}
      {view === "structured-data" ? <AdminSeoStructuredDataView /> : null}
    </div>
  );
}
