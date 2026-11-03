"use client";

import Link from "next/link";

import { ProfileSection } from "../../../components/member/ProfileSection";
import type { AdminSeoViewId } from "../admin-seo-console-model";
import {
  formatSeoDiagnosticSeverityLabel,
  type SeoDiagnosticsSnapshot,
} from "../admin-seo-diagnostics-model";
import {
  buildSeoActionItems,
  buildSeoOverviewCategories,
  computeSeoHealthScore,
  type SeoActionItem,
  type SeoActionKind,
  type SeoHealthScore,
} from "../admin-seo-overview-model";
import { AdminSeoRadialIndicator } from "./AdminSeoRadialIndicator";

import "./admin-seo-diagnostics.css";
import "./admin-seo-console.css";
import "./admin-seo-overview.css";

interface AdminSeoOverviewViewProps {
  diagnostics: SeoDiagnosticsSnapshot;
  onNavigate?: (view: AdminSeoViewId) => void;
}

const ACTION_GROUPS: ReadonlyArray<{ kind: SeoActionKind; title: string }> = [
  { kind: "missing", title: "Missing" },
  { kind: "warning", title: "Warnings" },
  { kind: "deferred", title: "Deferred" },
];

function scoreCaption(score: SeoHealthScore): string {
  const base = `${score.healthy} of ${score.scored} healthy`;
  return score.deferred > 0 ? `${base} · ${score.deferred} deferred` : base;
}

/** SEO-11B.1 — visual SEO overview built from the Pack 05 diagnostics snapshot. */
export function AdminSeoOverviewView({ diagnostics, onNavigate }: AdminSeoOverviewViewProps) {
  const health = computeSeoHealthScore(diagnostics.allChecks);
  const categories = buildSeoOverviewCategories(diagnostics);
  const actions = buildSeoActionItems(diagnostics);
  const openDiagnostics = onNavigate ? () => onNavigate("diagnostics") : undefined;

  return (
    <div className="admin-seo-console__panel admin-seo-overview">
      <div className="admin-seo-overview__headline">
        <section className="admin-seo-overview__card" aria-labelledby="seo-health-title">
          <AdminSeoRadialIndicator
            label="SEO implementation health"
            percent={health.percent}
            size="large"
          />
          <div>
            <h2 className="admin-seo-overview__card-title" id="seo-health-title">
              SEO implementation health
            </h2>
            <ul className="admin-seo-overview__facts">
              <li>
                {health.healthy} healthy · {health.warning} warnings · {health.missing} missing
              </li>
              <li>
                Excluded: {health.deferred} deferred · {health.notApplicable} not applicable
              </li>
              <li>
                Indexing: {diagnostics.indexingAllowed ? "allowed" : "protected (noindex)"} · Mode:{" "}
                {diagnostics.platformMode}
              </li>
            </ul>
            <p className="admin-seo-overview__note">
              Healthy ÷ (healthy + warnings + missing). Measures the implemented SEO architecture,
              not a live crawl.{" "}
              <Link className="admin-panel__link" href="/robots.txt">
                robots.txt
              </Link>
              {" · "}
              <Link className="admin-panel__link" href="/sitemap.xml">
                sitemap.xml
              </Link>
            </p>
          </div>
        </section>

        <section className="admin-seo-overview__card" aria-labelledby="seo-visibility-title">
          <AdminSeoRadialIndicator label="Search visibility" percent={null} size="large" />
          <div>
            <h2 className="admin-seo-overview__card-title" id="seo-visibility-title">
              Search visibility
            </h2>
            <p className="admin-seo-overview__note">
              No data. Google Search Console and Bing Webmaster Tools are not connected, so search
              performance (impressions, clicks, indexed pages) is unavailable. No visibility figure
              is estimated.
            </p>
          </div>
        </section>
      </div>

      <ProfileSection title="Implementation categories">
        <ul className="admin-seo-overview__categories">
          {categories.map((category) => (
            <li key={category.id}>
              <AdminSeoRadialIndicator
                label={category.label}
                percent={category.score.percent}
                size="compact"
                caption={scoreCaption(category.score)}
                onSelect={openDiagnostics}
              />
            </li>
          ))}
        </ul>
        <p className="admin-seo-overview__note">
          Each category counts its own checks once. The overall score also includes per-surface
          rollups, so category totals do not add up to the overall total.
        </p>
      </ProfileSection>

      <ProfileSection title="Action center">
        <ActionCenter actions={actions} onNavigate={onNavigate} />
      </ProfileSection>

      <ProfileSection title="Notes">
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

function ActionCenter({
  actions,
  onNavigate,
}: {
  actions: readonly SeoActionItem[];
  onNavigate?: (view: AdminSeoViewId) => void;
}) {
  return (
    <div className="admin-seo-overview__actions">
      {actions.length === 0 ? (
        <p className="hu-body">No missing, warning or deferred checks.</p>
      ) : (
        ACTION_GROUPS.map(({ kind, title }) => {
          const items = actions.filter((action) => action.kind === kind);
          if (items.length === 0) {
            return null;
          }
          return (
            <section key={kind} className="admin-seo-overview__action-group">
              <h3>
                {title} ({items.length})
              </h3>
              <ul className="admin-seo-overview__action-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <span
                      className={`admin-seo-diagnostics__badge admin-seo-diagnostics__badge--${kind}`}
                    >
                      {formatSeoDiagnosticSeverityLabel(kind)}
                    </span>{" "}
                    <strong>{item.label}</strong>{" "}
                    <span className="admin-seo-overview__action-area">({item.area})</span> —{" "}
                    {item.summary}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      {onNavigate ? (
        <div className="admin-seo-overview__action-links">
          <button
            type="button"
            className="hu-tab-control admin-publishing__tab"
            onClick={() => onNavigate("diagnostics")}
          >
            Open Diagnostics
          </button>
          <button
            type="button"
            className="hu-tab-control admin-publishing__tab"
            onClick={() => onNavigate("pages")}
          >
            Open Pages
          </button>
        </div>
      ) : null}
    </div>
  );
}
