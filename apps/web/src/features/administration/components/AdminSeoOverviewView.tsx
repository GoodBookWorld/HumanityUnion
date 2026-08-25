"use client";

import Link from "next/link";

import { ProfileSection } from "../../../components/member/ProfileSection";
import {
  formatSeoDiagnosticSeverityLabel,
  type SeoDiagnosticsSnapshot,
} from "../admin-seo-diagnostics-model";

import "./admin-seo-diagnostics.css";
import "./admin-seo-console.css";

interface AdminSeoOverviewViewProps {
  diagnostics: SeoDiagnosticsSnapshot;
}

export function AdminSeoOverviewView({ diagnostics }: AdminSeoOverviewViewProps) {
  const indexingAllowed = diagnostics.indexingAllowed;
  const originConfigured = diagnostics.siteOriginConfigured;

  const coverageCards = [
    {
      id: "metadata",
      label: "Metadata",
      summary: `${countBy(diagnostics.metadata, "healthy")} healthy · ${countBy(diagnostics.metadata, "missing")} missing`,
    },
    {
      id: "canonical",
      label: "Canonical",
      summary: `${countBy(diagnostics.canonical, "healthy")} healthy · ${countBy(diagnostics.canonical, "warning")} warnings`,
    },
    {
      id: "structured-data",
      label: "Structured Data",
      summary: `${countBy(diagnostics.structuredData, "healthy")} healthy · ${countBy(diagnostics.structuredData, "missing")} missing`,
    },
    {
      id: "sitemap",
      label: "Sitemap",
      summary: `${countBy(diagnostics.sitemap, "healthy")} covered · ${countBy(diagnostics.sitemap, "not_applicable")} deferred`,
    },
  ];

  return (
    <div className="admin-seo-console__panel">
      <ProfileSection title="Search visibility">
        <ul className="admin-seo-console__overview-grid">
          <li>
            <article className="admin-seo-diagnostics__card">
              <header className="admin-seo-diagnostics__card-header">
                <h3 className="admin-seo-diagnostics__card-title">Indexing</h3>
                <span
                  className={`admin-seo-diagnostics__badge admin-seo-diagnostics__badge--healthy`}
                >
                  Healthy
                </span>
              </header>
              <p className="admin-seo-diagnostics__card-summary">
                {indexingAllowed ? "Allowed" : "Protected (noindex)"}
              </p>
              <p className="hu-caption admin-seo-diagnostics__card-detail">
                Mode: {diagnostics.platformMode}
              </p>
            </article>
          </li>
          <li>
            <OverviewCard
              label="Robots"
              status="healthy"
              summary={
                indexingAllowed ? "Indexing permitted via robots" : "Protective noindex active"
              }
            />
          </li>
          <li>
            <OverviewCard
              label="Public site origin"
              status={originConfigured ? "healthy" : "warning"}
              summary={originConfigured ? "Configured" : "NEXT_PUBLIC_SITE_URL missing"}
              detail={
                originConfigured
                  ? "Absolute canonicals, sitemap, and JSON-LD use this origin."
                  : "Absolute URLs omit until the public site origin is configured."
              }
            />
          </li>
          <li>
            <OverviewCard
              label="Sitemap"
              status={originConfigured ? "healthy" : "warning"}
              summary={
                !originConfigured
                  ? "Route exists; absolute URLs unavailable"
                  : indexingAllowed
                    ? "Available at /sitemap.xml"
                    : "Available; empty while indexing is disallowed"
              }
            />
          </li>
        </ul>
      </ProfileSection>

      <ProfileSection title="Coverage">
        <ul className="admin-seo-console__overview-grid">
          {coverageCards.map((card) => (
            <li key={card.id}>
              <article className="admin-seo-diagnostics__card">
                <header className="admin-seo-diagnostics__card-header">
                  <h3 className="admin-seo-diagnostics__card-title">{card.label}</h3>
                </header>
                <p className="admin-seo-diagnostics__card-summary">{card.summary}</p>
              </article>
            </li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection title="Issues">
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
            <p className="admin-seo-diagnostics__summary-label">Missing</p>
            <p className="admin-seo-diagnostics__summary-value">{diagnostics.summary.missing}</p>
          </li>
        </ul>
        <p className="hu-caption admin-seo-diagnostics__note">
          Counts come from Pack 05 diagnostics. Deferred / not applicable items are not treated as
          Missing failures.{" "}
          <Link className="admin-panel__link" href="/robots.txt">
            robots.txt
          </Link>
          {" · "}
          <Link className="admin-panel__link" href="/sitemap.xml">
            sitemap.xml
          </Link>
        </p>
      </ProfileSection>

      <ProfileSection title="Notable gaps">
        <ul className="admin-panel__gap-list hu-body">
          <li>
            Petition is Initiative-owned (Pack 10): not independently indexed; crawlable via
            Initiative URLs. Legacy /petitions/public/{"{id}"} remains a noindex compatibility
            redirect.
          </li>
          <li>
            Participant Profile Page SEO overrides remain deferred (Pack 07) — enumeration does not
            enable Edit SEO for Profiles in this Pack.
          </li>
        </ul>
      </ProfileSection>
    </div>
  );
}

function countBy(
  checks: SeoDiagnosticsSnapshot["metadata"],
  status: SeoDiagnosticsSnapshot["metadata"][number]["status"],
): number {
  return checks.filter((check) => check.status === status).length;
}

function OverviewCard(props: {
  label: string;
  status: "healthy" | "warning" | "missing" | "not_applicable";
  summary: string;
  detail?: string;
}) {
  return (
    <article className={`admin-seo-diagnostics__card admin-seo-diagnostics__card--${props.status}`}>
      <header className="admin-seo-diagnostics__card-header">
        <h3 className="admin-seo-diagnostics__card-title">{props.label}</h3>
        <span className={`admin-seo-diagnostics__badge admin-seo-diagnostics__badge--${props.status}`}>
          {formatSeoDiagnosticSeverityLabel(props.status)}
        </span>
      </header>
      <p className="admin-seo-diagnostics__card-summary">{props.summary}</p>
      {props.detail ? (
        <p className="hu-caption admin-seo-diagnostics__card-detail">{props.detail}</p>
      ) : null}
    </article>
  );
}
