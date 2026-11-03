/**
 * SEO-11B.1 — Admin SEO Overview dashboard model.
 *
 * Built only from the Pack 05 diagnostics snapshot (an architecture registry, not
 * a crawl). No search-engine data is read or estimated here.
 */

import type {
  SeoDiagnosticCheck,
  SeoDiagnosticSeverity,
  SeoDiagnosticsSnapshot,
} from "./admin-seo-diagnostics-model";

export interface SeoHealthScore {
  readonly healthy: number;
  readonly warning: number;
  readonly missing: number;
  readonly deferred: number;
  readonly notApplicable: number;
  /** Healthy + Warning + Missing. Deferred and Not applicable are excluded. */
  readonly scored: number;
  /** Healthy / scored × 100, or null when nothing is scored ("No data"). */
  readonly percent: number | null;
}

export function computeSeoHealthScore(checks: readonly SeoDiagnosticCheck[]): SeoHealthScore {
  const count = (status: SeoDiagnosticSeverity) =>
    checks.filter((check) => check.status === status).length;
  const healthy = count("healthy");
  const warning = count("warning");
  const missing = count("missing");
  const scored = healthy + warning + missing;

  return {
    healthy,
    warning,
    missing,
    deferred: count("deferred"),
    notApplicable: count("not_applicable"),
    scored,
    percent: scored > 0 ? (healthy / scored) * 100 : null,
  };
}

/** One decimal place, without a trailing ".0". */
export function formatSeoHealthPercent(percent: number | null): string {
  if (percent === null) {
    return "No data";
  }
  const rounded = Math.round(percent * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export type SeoOverviewCategoryId =
  "metadata" | "canonical" | "indexing" | "sitemap" | "robots" | "structured-data";

export interface SeoOverviewCategory {
  readonly id: SeoOverviewCategoryId;
  readonly label: string;
  readonly checks: readonly SeoDiagnosticCheck[];
  readonly score: SeoHealthScore;
}

const INDEXING_CHECK_IDS = new Set(["indexing-mode", "indexing-allowed", "public-site-origin"]);
const ROBOTS_CHECK_IDS = new Set(["robots-protection"]);
const SITEMAP_INDEXING_CHECK_IDS = new Set(["sitemap-availability"]);

function uniqueById(checks: readonly SeoDiagnosticCheck[]): SeoDiagnosticCheck[] {
  const seen = new Set<string>();
  return checks.filter((check) => (seen.has(check.id) ? false : (seen.add(check.id), true)));
}

/**
 * Six dashboard categories over existing checks. Each check counts once per
 * category. Public-surface rollups and Country checks belong to no category, so
 * category totals need not add up to the overall score.
 */
export function buildSeoOverviewCategories(
  snapshot: SeoDiagnosticsSnapshot,
): readonly SeoOverviewCategory[] {
  const definitions: ReadonlyArray<{
    id: SeoOverviewCategoryId;
    label: string;
    checks: readonly SeoDiagnosticCheck[];
  }> = [
    { id: "metadata", label: "Metadata", checks: snapshot.metadata },
    { id: "canonical", label: "Canonical", checks: snapshot.canonical },
    {
      id: "indexing",
      label: "Indexing",
      checks: snapshot.indexing.filter((check) => INDEXING_CHECK_IDS.has(check.id)),
    },
    {
      id: "sitemap",
      label: "Sitemap",
      checks: [
        ...snapshot.indexing.filter((check) => SITEMAP_INDEXING_CHECK_IDS.has(check.id)),
        ...snapshot.sitemap,
      ],
    },
    {
      id: "robots",
      label: "Robots",
      checks: snapshot.indexing.filter((check) => ROBOTS_CHECK_IDS.has(check.id)),
    },
    { id: "structured-data", label: "Structured Data", checks: snapshot.structuredData },
  ];

  return definitions.map((definition) => {
    const checks = uniqueById(definition.checks);
    return { ...definition, checks, score: computeSeoHealthScore(checks) };
  });
}

export type SeoActionKind = "missing" | "warning" | "deferred";

export interface SeoActionItem {
  readonly id: string;
  readonly kind: SeoActionKind;
  readonly label: string;
  readonly area: string;
  readonly summary: string;
}

const AREA_LABELS: Record<SeoDiagnosticCheck["category"], string> = {
  indexing: "Indexing",
  sitemap: "Sitemap",
  metadata: "Metadata",
  structured_data: "Structured Data",
  canonical: "Canonical",
  public_surface: "Public surface",
  country: "Country",
};

/** Missing, Warning and Deferred checks from the overall diagnostic scope. */
export function buildSeoActionItems(snapshot: SeoDiagnosticsSnapshot): readonly SeoActionItem[] {
  const order: Record<SeoActionKind, number> = { missing: 0, warning: 1, deferred: 2 };

  return uniqueById(snapshot.allChecks)
    .filter(
      (check): check is SeoDiagnosticCheck & { status: SeoActionKind } =>
        check.status === "missing" || check.status === "warning" || check.status === "deferred",
    )
    .map((check) => ({
      id: check.id,
      kind: check.status,
      label: check.label,
      area: AREA_LABELS[check.category],
      summary: check.summary,
    }))
    .sort((left, right) => order[left.kind] - order[right.kind]);
}
