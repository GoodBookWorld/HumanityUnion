"use client";

import Link from "next/link";

import { ProfileSection } from "../../../components/member/ProfileSection";
import {
  formatSeoDiagnosticSeverityLabel,
  type SeoDiagnosticCheck,
  type SeoDiagnosticsSnapshot,
} from "../admin-seo-diagnostics-model";

import "./admin-seo-diagnostics.css";

interface AdminSeoDiagnosticsViewProps {
  diagnostics: SeoDiagnosticsSnapshot;
}

/** Pack 05 SEO Diagnostics retained as the Diagnostics console view. */
export function AdminSeoDiagnosticsView({ diagnostics }: AdminSeoDiagnosticsViewProps) {
  return (
    <div className="admin-seo-console__panel">
      <ProfileSection title="SEO Diagnostics">
        <p className="hu-caption admin-seo-diagnostics__note">
          Read-only coverage of the shared SEO architecture (Packs 01–04). Deferred items are not
          failures. Technical Health lives on{" "}
          <Link className="admin-panel__link" href="/admin/diagnostics">
            /admin/diagnostics
          </Link>
          .
        </p>

        <ul className="admin-seo-diagnostics__summary" aria-label="SEO issue summary">
          <li className="admin-seo-diagnostics__summary-card admin-seo-diagnostics__summary-card--healthy">
            <p className="admin-seo-diagnostics__summary-label">Healthy</p>
            <p className="admin-seo-diagnostics__summary-value">{diagnostics.summary.healthy}</p>
          </li>
          <li className="admin-seo-diagnostics__summary-card admin-seo-diagnostics__summary-card--warning">
            <p className="admin-seo-diagnostics__summary-label">Warnings</p>
            <p className="admin-seo-diagnostics__summary-value">{diagnostics.summary.warning}</p>
          </li>
          <li className="admin-seo-diagnostics__summary-card admin-seo-diagnostics__summary-card--missing">
            <p className="admin-seo-diagnostics__summary-label">Missing coverage</p>
            <p className="admin-seo-diagnostics__summary-value">{diagnostics.summary.missing}</p>
          </li>
        </ul>
      </ProfileSection>

      <ProfileSection title="Indexing">
        <ul className="admin-seo-diagnostics__grid">
          {diagnostics.indexing.map((row) => (
            <li key={row.id}>
              <SeoDiagnosticCard check={row} />
            </li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection title="Sitemap coverage">
        <ul className="admin-seo-diagnostics__grid">
          {diagnostics.sitemap.map((row) => (
            <li key={row.id}>
              <SeoDiagnosticCard check={row} />
            </li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection title="Country SEO">
        <p className="hu-caption admin-seo-diagnostics__note">
          Countries are mandatory SEO inventory — not optional or deferred.
        </p>
        <ul className="admin-seo-diagnostics__grid">
          {diagnostics.country.map((row) => (
            <li key={row.id}>
              <SeoDiagnosticCard check={row} />
            </li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection title="Metadata coverage">
        <ul className="admin-seo-diagnostics__grid">
          {diagnostics.metadata.map((row) => (
            <li key={row.id}>
              <SeoDiagnosticCard check={row} />
            </li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection title="Canonical coverage">
        <ul className="admin-seo-diagnostics__grid">
          {diagnostics.canonical.map((row) => (
            <li key={row.id}>
              <SeoDiagnosticCard check={row} />
            </li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection title="Structured Data coverage">
        <ul className="admin-seo-diagnostics__grid">
          {diagnostics.structuredData.map((row) => (
            <li key={row.id}>
              <SeoDiagnosticCard check={row} />
            </li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection title="Public surface coverage">
        <ul className="admin-seo-diagnostics__grid">
          {diagnostics.publicSurfaces.map((row) => (
            <li key={row.id}>
              <SeoDiagnosticCard check={row} />
            </li>
          ))}
        </ul>
      </ProfileSection>
    </div>
  );
}

function SeoDiagnosticCard({ check }: { check: SeoDiagnosticCheck }) {
  return (
    <article
      className={`admin-seo-diagnostics__card admin-seo-diagnostics__card--${check.status}`}
      aria-label={`${check.label} — ${formatSeoDiagnosticSeverityLabel(check.status)}`}
    >
      <header className="admin-seo-diagnostics__card-header">
        <h3 className="admin-seo-diagnostics__card-title">{check.label}</h3>
        <span className={`admin-seo-diagnostics__badge admin-seo-diagnostics__badge--${check.status}`}>
          {formatSeoDiagnosticSeverityLabel(check.status)}
        </span>
      </header>
      <p className="admin-seo-diagnostics__card-summary">{check.summary}</p>
      {check.detail ? (
        <p className="hu-caption admin-seo-diagnostics__card-detail">{check.detail}</p>
      ) : null}
    </article>
  );
}
