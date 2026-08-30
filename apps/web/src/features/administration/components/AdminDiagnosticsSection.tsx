"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { AuthUserPublic } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  countAdminInitiativeIntegrityWarnings,
  fetchApiHealth,
  fetchApiReady,
} from "../admin-diagnostics-api";
import { evaluateAdminOperationalAlerts } from "../admin-notification-api";
import {
  buildTechnicalHealthSnapshot,
  formatDiagnosticSeverityLabel,
  type DiagnosticCheck,
  type DiagnosticSeverity,
} from "../admin-diagnostics-model";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-diagnostics.css";

interface AdminDiagnosticsSectionProps {
  user: AuthUserPublic;
}

interface DiagnosticsViewModel {
  overall: DiagnosticSeverity;
  services: DiagnosticCheck[];
  outbox: DiagnosticCheck;
  integrity: DiagnosticCheck[];
  checkedAt: string;
}

export function AdminDiagnosticsSection({ user: _user }: AdminDiagnosticsSectionProps) {
  const [view, setView] = useState<DiagnosticsViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDiagnostics = useCallback(async () => {
    const [healthResult, readyResult, integrityResult] = await Promise.allSettled([
      fetchApiHealth(),
      fetchApiReady(),
      countAdminInitiativeIntegrityWarnings(),
    ]);

    const health = healthResult.status === "fulfilled" ? healthResult.value : null;
    const healthError =
      healthResult.status === "rejected" ? formatAuthFormError(healthResult.reason) : null;
    const ready = readyResult.status === "fulfilled" ? readyResult.value : null;
    const readyError =
      readyResult.status === "rejected" ? formatAuthFormError(readyResult.reason) : null;
    const initiativeWarningCount =
      integrityResult.status === "fulfilled" ? integrityResult.value.warningCount : null;
    const initiativeSamples =
      integrityResult.status === "fulfilled" ? integrityResult.value.samples : null;
    const initiativeError =
      integrityResult.status === "rejected"
        ? formatAuthFormError(integrityResult.reason)
        : null;

    const snapshot = buildTechnicalHealthSnapshot({
      health,
      ready,
      healthError,
      readyError,
      initiativeWarningCount,
      initiativeError,
      initiativeSamples,
    });

    setView({
      ...snapshot,
      checkedAt: new Date().toISOString(),
    });
    setError(null);

    // Pack 22E.3 — idempotent ops alert evaluation (best-effort; never blocks Diagnostics UI).
    void evaluateAdminOperationalAlerts().catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadDiagnostics()
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(formatAuthFormError(loadError));
          setView(null);
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
  }, [loadDiagnostics]);

  async function handleRefresh() {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      await loadDiagnostics();
    } catch (refreshError: unknown) {
      setError(formatAuthFormError(refreshError));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="admin-panel admin-diagnostics">
      <AdminPanelNavigation />

      <div className="admin-diagnostics__toolbar">
        <p className="hu-caption admin-diagnostics__checked-at">
          {view
            ? `Last checked ${formatCheckedAt(view.checkedAt)}`
            : loading
              ? "Checking platform health…"
              : "Health has not been checked yet."}
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={loading || refreshing}
          aria-busy={refreshing}
          onClick={() => {
            void handleRefresh();
          }}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error ? <StatusBanner title="Diagnostics unavailable" message={error} /> : null}

      <ProfileSection title="Platform Health">
        {loading && !view ? <p className="hu-body">Loading technical health…</p> : null}
        {view ? (
          <div
            className={`admin-diagnostics__overall admin-diagnostics__overall--${view.overall}`}
            role="status"
            aria-live="polite"
          >
            <p className="admin-diagnostics__overall-label">Overall status</p>
            <p className="admin-diagnostics__overall-value">
              {formatDiagnosticSeverityLabel(view.overall)}
            </p>
            <p className="hu-caption admin-diagnostics__overall-hint">
              Derived from Web, API, MongoDB, Email, Outbox, and Initiative integrity checks.
              Missing checks stay Unknown — never reported as Healthy.
            </p>
          </div>
        ) : null}
      </ProfileSection>

      <ProfileSection title="Services">
        {view ? (
          <ul className="admin-diagnostics__service-grid">
            {view.services.map((check) => (
              <li key={check.id}>
                <DiagnosticStatusCard check={check} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="hu-body">Service statuses appear after the first health check.</p>
        )}
      </ProfileSection>

      <ProfileSection title="Event Infrastructure">
        {view ? (
          <DiagnosticStatusCard check={view.outbox} />
        ) : (
          <p className="hu-body">Outbox summary appears after the first health check.</p>
        )}
        <p className="hu-caption admin-panel__note">
          Published historical totals are informational and do not mark the platform unhealthy.
          This page is diagnosis-only and does not offer event repair controls.
        </p>
      </ProfileSection>

      <ProfileSection title="Data Integrity">
        {view ? (
          <ul className="admin-diagnostics__integrity-list">
            {view.integrity.map((check) => (
              <li key={check.id}>
                <DiagnosticStatusCard check={check} />
                {check.id === "initiative-integrity" ? (
                  <p className="hu-caption admin-diagnostics__integrity-link">
                    <Link className="admin-panel__link" href="/admin/initiatives">
                      Open Admin Initiatives
                    </Link>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="hu-body">Integrity checks appear after the first health check.</p>
        )}
      </ProfileSection>
    </div>
  );
}

function DiagnosticStatusCard({ check }: { check: DiagnosticCheck }) {
  return (
    <article
      className={`admin-diagnostics__card admin-diagnostics__card--${check.status}`}
      aria-label={`${check.label} — ${formatDiagnosticSeverityLabel(check.status)}`}
    >
      <header className="admin-diagnostics__card-header">
        <h3 className="admin-diagnostics__card-title">{check.label}</h3>
        <span className={`admin-diagnostics__badge admin-diagnostics__badge--${check.status}`}>
          {formatDiagnosticSeverityLabel(check.status)}
        </span>
      </header>
      <p className="admin-diagnostics__card-summary">{check.summary}</p>
      {check.detail ? <p className="hu-caption admin-diagnostics__card-detail">{check.detail}</p> : null}
    </article>
  );
}

function formatCheckedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
