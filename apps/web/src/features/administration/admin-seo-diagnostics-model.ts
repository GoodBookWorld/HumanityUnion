/**
 * SEO Pack 05 — Admin SEO Diagnostics registry and snapshot builder.
 * Read-only coverage of Packs 01–04. No crawler, no settings store, no scores.
 */

import {
  resolvePlatformIndexingMode,
  shouldDisallowSearchIndexing,
  type PlatformIndexingMode,
} from "../../lib/platform-indexing";
import { resolvePublicSiteOrigin } from "../../lib/seo/public-site-url";

type SeoDiagnosticsEnv = {
  NEXT_PUBLIC_PLATFORM_MODE?: string;
  PLATFORM_MODE?: string;
  NODE_ENV?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  [key: string]: string | undefined;
};
export type SeoDiagnosticSeverity = "healthy" | "warning" | "missing" | "not_applicable";

export type SeoDiagnosticCategory =
  | "indexing"
  | "sitemap"
  | "metadata"
  | "structured_data"
  | "canonical"
  | "public_surface"
  | "country";

/** Architecture coverage for a public surface capability. */
export type SeoCoverageState = "covered" | "partial" | "missing" | "deferred" | "not_applicable";

export interface SeoDiagnosticCheck {
  readonly id: string;
  readonly category: SeoDiagnosticCategory;
  readonly label: string;
  readonly status: SeoDiagnosticSeverity;
  readonly summary: string;
  readonly detail?: string;
}

export interface SeoSurfaceRegistryEntry {
  readonly id: string;
  readonly label: string;
  readonly routePattern: string;
  readonly metadata: SeoCoverageState;
  readonly canonical: SeoCoverageState;
  readonly openGraph: SeoCoverageState;
  readonly sitemap: SeoCoverageState;
  readonly structuredData: SeoCoverageState;
  /** Human-readable Pack 04 schema types when covered. */
  readonly structuredDataTypes?: string;
  readonly notes?: string;
}

export interface SeoSitemapProviderEntry {
  readonly id: string;
  readonly label: string;
  readonly state: SeoCoverageState;
  readonly summary: string;
  readonly detail?: string;
}

export interface SeoDiagnosticsSummary {
  readonly healthy: number;
  readonly warning: number;
  readonly missing: number;
  readonly notApplicable: number;
}

export interface SeoDiagnosticsSnapshot {
  readonly summary: SeoDiagnosticsSummary;
  readonly indexing: readonly SeoDiagnosticCheck[];
  readonly sitemap: readonly SeoDiagnosticCheck[];
  readonly metadata: readonly SeoDiagnosticCheck[];
  readonly structuredData: readonly SeoDiagnosticCheck[];
  readonly canonical: readonly SeoDiagnosticCheck[];
  readonly country: readonly SeoDiagnosticCheck[];
  readonly publicSurfaces: readonly SeoDiagnosticCheck[];
  readonly allChecks: readonly SeoDiagnosticCheck[];
  readonly siteOriginConfigured: boolean;
  readonly indexingAllowed: boolean;
  readonly platformMode: PlatformIndexingMode;
}

/**
 * Central coverage registry — describes implemented architecture, not live crawl results.
 */
export const SEO_PUBLIC_SURFACE_REGISTRY: readonly SeoSurfaceRegistryEntry[] = [
  {
    id: "home",
    label: "Home",
    routePattern: "/",
    metadata: "covered",
    canonical: "covered",
    openGraph: "covered",
    sitemap: "covered",
    structuredData: "covered",
    structuredDataTypes: "WebSite + Organization (root)",
    notes: "Pack 08 — Home metadata via Pack 01 builder with absolute canonical and Open Graph.",
  },
  {
    id: "blog-article",
    label: "Blog article",
    routePattern: "/blog/{slug}",
    metadata: "covered",
    canonical: "covered",
    openGraph: "covered",
    sitemap: "covered",
    structuredData: "covered",
    structuredDataTypes: "BlogPosting + BreadcrumbList",
  },
  {
    id: "initiative",
    label: "Initiative",
    routePattern: "/initiatives/public/{initiativeId}",
    metadata: "covered",
    canonical: "covered",
    openGraph: "covered",
    sitemap: "covered",
    structuredData: "covered",
    structuredDataTypes: "WebPage + BreadcrumbList",
  },
  {
    id: "country",
    label: "Country",
    routePattern: "/countries/{countryCode}",
    metadata: "covered",
    canonical: "covered",
    openGraph: "covered",
    sitemap: "covered",
    structuredData: "covered",
    structuredDataTypes: "WebPage + BreadcrumbList",
    notes: "Mandatory inventory. Legacy /country/{slug} is not canonical.",
  },
  {
    id: "participant-profile",
    label: "Participant Profile",
    routePattern: "/member/{uniqueName}",
    metadata: "covered",
    canonical: "covered",
    openGraph: "covered",
    sitemap: "covered",
    structuredData: "covered",
    structuredDataTypes: "ProfilePage + Person",
    notes:
      "Pack 11 — public sitemap enumeration via GET /api/v1/public/sitemap/participant-profiles (active + profileVisibility public only).",
  },
  {
    id: "petition",
    label: "Petition",
    routePattern: "/petitions/public/{petitionId} → Initiative #petition",
    metadata: "covered",
    canonical: "not_applicable",
    openGraph: "not_applicable",
    sitemap: "not_applicable",
    structuredData: "not_applicable",
    notes:
      "Pack 10 — Strategy B (Initiative-owned). Legacy /petitions/public/{id} is a noindex compatibility redirect. Crawlable document, canonical, OG, sitemap, and Structured Data are owned by /initiatives/public/{initiativeId}.",
  },
  {
    id: "knowledge",
    label: "Knowledge",
    routePattern: "/knowledge/{slug}",
    metadata: "covered",
    canonical: "covered",
    openGraph: "covered",
    sitemap: "covered",
    structuredData: "covered",
    structuredDataTypes: "WebPage + BreadcrumbList",
    notes: "Pack 08 — automatic metadata and WebPage JSON-LD; Admin overrides merge when present.",
  },
  {
    id: "civic-archive",
    label: "Civic Archive",
    routePattern: "/civic-archive/{initiativeId}",
    metadata: "covered",
    canonical: "covered",
    openGraph: "covered",
    sitemap: "covered",
    structuredData: "covered",
    structuredDataTypes: "WebPage + BreadcrumbList",
    notes: "Pack 08 — automatic metadata and WebPage JSON-LD; Admin overrides merge when present.",
  },
] as const;

export const SEO_SITEMAP_PROVIDER_REGISTRY: readonly SeoSitemapProviderEntry[] = [
  {
    id: "static",
    label: "Static public pages",
    state: "covered",
    summary: "Audited static routes included in Pack 02 inventory",
  },
  {
    id: "countries",
    label: "Countries",
    state: "covered",
    summary: "All geography catalog countries under /countries/{code}",
  },
  {
    id: "blog",
    label: "Blog",
    state: "covered",
    summary: "Published posts via public Blog list API",
  },
  {
    id: "initiatives",
    label: "Initiatives",
    state: "covered",
    summary: "Public sitemap Initiative inventory with eligibility gate",
  },
  {
    id: "knowledge",
    label: "Knowledge",
    state: "covered",
    summary: "Knowledge articles from public listing",
  },
  {
    id: "civic-archive",
    label: "Civic Archive",
    state: "covered",
    summary: "Public civic archive records inventoriable in sitemap",
  },
  {
    id: "participant-profiles",
    label: "Participant Profiles",
    state: "covered",
    summary: "Active public profiles via Pack 11 sitemap inventory API",
    detail:
      "Only profileVisibility=public and status=active are enumerated. members_only/private/suspended never leave the API.",
  },
  {
    id: "petitions",
    label: "Petitions",
    state: "not_applicable",
    summary: "Initiative-owned — not enumerated separately",
    detail:
      "Pack 10 Strategy B: Petition-stage content is crawlable via Initiative sitemap URLs. Legacy /petitions/public/{id} remains a noindex redirect and is intentionally excluded from sitemap.xml.",
  },
  {
    id: "regions",
    label: "Regions",
    state: "deferred",
    summary: "Deferred — no meaningful public regional inventory yet",
  },
] as const;

export function coverageStateToSeverity(state: SeoCoverageState): SeoDiagnosticSeverity {
  switch (state) {
    case "covered":
      return "healthy";
    case "partial":
      return "warning";
    case "missing":
      return "missing";
    case "deferred":
    case "not_applicable":
      return "not_applicable";
  }
}

export function formatSeoDiagnosticSeverityLabel(status: SeoDiagnosticSeverity): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "missing":
      return "Missing";
    case "not_applicable":
      return "Not applicable";
  }
}

export function summarizeSeoDiagnostics(
  checks: readonly SeoDiagnosticCheck[],
): SeoDiagnosticsSummary {
  let healthy = 0;
  let warning = 0;
  let missing = 0;
  let notApplicable = 0;

  for (const check of checks) {
    switch (check.status) {
      case "healthy":
        healthy += 1;
        break;
      case "warning":
        warning += 1;
        break;
      case "missing":
        missing += 1;
        break;
      case "not_applicable":
        notApplicable += 1;
        break;
    }
  }

  return { healthy, warning, missing, notApplicable };
}

function check(
  partial: Omit<SeoDiagnosticCheck, "status"> & { status: SeoDiagnosticSeverity },
): SeoDiagnosticCheck {
  return partial;
}

export function buildIndexingDiagnostics(
  env: SeoDiagnosticsEnv = process.env,
): SeoDiagnosticCheck[] {
  const platformMode = resolvePlatformIndexingMode(env);
  const indexingDisallowed = shouldDisallowSearchIndexing(env);
  const origin = resolvePublicSiteOrigin(env);
  const siteOriginConfigured = Boolean(origin);

  const indexing: SeoDiagnosticCheck[] = [
    check({
      id: "indexing-mode",
      category: "indexing",
      label: "Platform indexing mode",
      status: "healthy",
      summary: platformMode,
      detail: "Resolved from NEXT_PUBLIC_PLATFORM_MODE / PLATFORM_MODE (env), not an Admin setting.",
    }),
    check({
      id: "indexing-allowed",
      category: "indexing",
      label: "Search indexing",
      status: "healthy",
      summary: indexingDisallowed ? "Disallowed (noindex)" : "Allowed",
      detail: indexingDisallowed
        ? "Staging, development, and unrecognized modes disallow indexing."
        : "Production (and beta under current helper) remain indexable.",
    }),
    check({
      id: "robots-protection",
      category: "indexing",
      label: "robots protection",
      status: "healthy",
      summary: indexingDisallowed ? "Protective noindex active" : "Indexing permitted via robots",
      detail: "Root layout and robots.ts mirror shouldDisallowSearchIndexing().",
    }),
    check({
      id: "sitemap-availability",
      category: "indexing",
      label: "Sitemap availability",
      status: siteOriginConfigured ? "healthy" : "warning",
      summary: !siteOriginConfigured
        ? "Route exists; absolute URLs unavailable without site origin"
        : indexingDisallowed
          ? "Available; returns empty while indexing is disallowed"
          : "Available at /sitemap.xml",
      detail: "Pack 02 app/sitemap.ts — empty when indexing disallowed or origin unset.",
    }),
    check({
      id: "public-site-origin",
      category: "indexing",
      label: "Public site origin",
      status: siteOriginConfigured ? "healthy" : "warning",
      summary: siteOriginConfigured ? "Configured" : "NEXT_PUBLIC_SITE_URL missing",
      detail: siteOriginConfigured
        ? "Absolute canonicals, sitemap URLs, and JSON-LD use this origin."
        : "Absolute canonicals, sitemap URLs, and JSON-LD omit absolute URLs until configured.",
    }),
  ];

  return indexing;
}

export function buildSitemapDiagnostics(): SeoDiagnosticCheck[] {
  return SEO_SITEMAP_PROVIDER_REGISTRY.map((entry) =>
    check({
      id: `sitemap-${entry.id}`,
      category: "sitemap",
      label: entry.label,
      status: coverageStateToSeverity(entry.state),
      summary: entry.summary,
      detail: entry.detail,
    }),
  );
}

export function buildMetadataDiagnostics(): SeoDiagnosticCheck[] {
  return SEO_PUBLIC_SURFACE_REGISTRY.map((surface) =>
    check({
      id: `metadata-${surface.id}`,
      category: "metadata",
      label: surface.label,
      status: coverageStateToSeverity(surface.metadata),
      summary:
        surface.metadata === "covered"
          ? surface.id === "petition"
            ? "Compatibility noindex on legacy redirect; Initiative owns indexable metadata"
            : "Unique metadata via shared builder / root layout"
          : surface.metadata === "missing"
            ? "No page-level unique metadata yet"
            : surface.metadata === "partial"
              ? "Partial metadata coverage"
              : "Deferred",
      detail: surface.notes,
    }),
  );
}

export function buildStructuredDataDiagnostics(): SeoDiagnosticCheck[] {
  return SEO_PUBLIC_SURFACE_REGISTRY.map((surface) =>
    check({
      id: `structured-data-${surface.id}`,
      category: "structured_data",
      label: surface.label,
      status: coverageStateToSeverity(surface.structuredData),
      summary:
        surface.structuredData === "covered"
          ? surface.structuredDataTypes ?? "Structured data wired"
          : surface.structuredData === "deferred"
            ? "Deferred"
            : surface.id === "petition"
              ? "N/A — Initiative WebPage owns Structured Data"
              : "No Pack 04 JSON-LD on this surface yet",
      detail: surface.notes,
    }),
  );
}

export function buildCanonicalDiagnostics(): SeoDiagnosticCheck[] {
  const fromRegistry = SEO_PUBLIC_SURFACE_REGISTRY.map((surface) =>
    check({
      id: `canonical-${surface.id}`,
      category: "canonical",
      label: surface.label,
      status: coverageStateToSeverity(surface.canonical),
      summary:
        surface.id === "country"
          ? "Canonical /countries/{countryCode}"
          : surface.id === "petition"
            ? "N/A — Initiative-owned (/initiatives/public/{id}#petition)"
            : surface.canonical === "covered"
              ? `Canonical via Pack 01 builder (${surface.routePattern})`
              : surface.canonical === "missing"
                ? "No dedicated absolute canonical yet"
                : surface.canonical === "partial"
                  ? "Canonical strategy incomplete"
                  : surface.canonical === "not_applicable"
                    ? "Not independently indexed"
                    : "Deferred",
      detail: surface.notes,
    }),
  );

  return [
    ...fromRegistry,
    check({
      id: "canonical-legacy-country",
      category: "canonical",
      label: "Legacy Country route",
      status: "healthy",
      summary: "/country/{slug} is not canonical",
      detail: "Legacy route remains redirect/noindex; inventory uses /countries/{countryCode}.",
    }),
  ];
}

export function buildCountryDiagnostics(): SeoDiagnosticCheck[] {
  const country = SEO_PUBLIC_SURFACE_REGISTRY.find((entry) => entry.id === "country");
  if (!country) {
    return [];
  }

  return [
    check({
      id: "country-canonical-route",
      category: "country",
      label: "Country canonical route",
      status: "healthy",
      summary: "/countries/{countryCode}",
      detail: "Mandatory public Country inventory route.",
    }),
    check({
      id: "country-metadata",
      category: "country",
      label: "Country metadata",
      status: coverageStateToSeverity(country.metadata),
      summary: "Pack 03 generateMetadata via shared builder",
    }),
    check({
      id: "country-sitemap",
      category: "country",
      label: "Country sitemap",
      status: coverageStateToSeverity(country.sitemap),
      summary: "All catalog countries included in Pack 02 sitemap",
    }),
    check({
      id: "country-structured-data",
      category: "country",
      label: "Country structured data",
      status: coverageStateToSeverity(country.structuredData),
      summary: country.structuredDataTypes ?? "WebPage + BreadcrumbList",
    }),
    check({
      id: "country-legacy-not-canonical",
      category: "country",
      label: "Legacy /country/{slug}",
      status: "healthy",
      summary: "Not reported as canonical",
      detail: "Must not appear as the Country SEO canonical surface.",
    }),
  ];
}

function aggregateSurfaceStatus(
  capabilities: readonly SeoCoverageState[],
): SeoDiagnosticSeverity {
  if (capabilities.some((state) => state === "missing")) {
    return "missing";
  }
  if (capabilities.some((state) => state === "partial")) {
    return "warning";
  }
  if (capabilities.every((state) => state === "deferred" || state === "not_applicable")) {
    return "not_applicable";
  }
  // covered + intentional deferred siblings are Healthy — deferrals are not failures.
  if (
    capabilities.every(
      (state) => state === "covered" || state === "deferred" || state === "not_applicable",
    )
  ) {
    return "healthy";
  }
  return "warning";
}

export function buildPublicSurfaceDiagnostics(): SeoDiagnosticCheck[] {
  return SEO_PUBLIC_SURFACE_REGISTRY.map((surface) =>
    check({
      id: `surface-${surface.id}`,
      category: "public_surface",
      label: surface.label,
      status: aggregateSurfaceStatus([
        surface.metadata,
        surface.canonical,
        surface.openGraph,
        surface.sitemap,
        surface.structuredData,
      ]),
      summary: surface.routePattern,
      detail: surface.notes,
    }),
  );
}

export function buildSeoDiagnosticsSnapshot(
  env: SeoDiagnosticsEnv = process.env,
): SeoDiagnosticsSnapshot {
  const indexing = buildIndexingDiagnostics(env);
  const sitemap = buildSitemapDiagnostics();
  const metadata = buildMetadataDiagnostics();
  const structuredData = buildStructuredDataDiagnostics();
  const canonical = buildCanonicalDiagnostics();
  const country = buildCountryDiagnostics();
  const publicSurfaces = buildPublicSurfaceDiagnostics();

  // Summary uses category rollups once each (avoid double-counting Country duplicates).
  const allChecks = [
    ...indexing,
    ...sitemap,
    ...metadata,
    ...structuredData,
    ...canonical,
    ...publicSurfaces,
  ];

  return {
    summary: summarizeSeoDiagnostics(allChecks),
    indexing,
    sitemap,
    metadata,
    structuredData,
    canonical,
    country,
    publicSurfaces,
    allChecks,
    siteOriginConfigured: Boolean(resolvePublicSiteOrigin(env)),
    indexingAllowed: !shouldDisallowSearchIndexing(env),
    platformMode: resolvePlatformIndexingMode(env),
  };
}

export function getSeoSurfaceById(id: string): SeoSurfaceRegistryEntry | undefined {
  return SEO_PUBLIC_SURFACE_REGISTRY.find((entry) => entry.id === id);
}

export function getSeoSitemapProviderById(id: string): SeoSitemapProviderEntry | undefined {
  return SEO_SITEMAP_PROVIDER_REGISTRY.find((entry) => entry.id === id);
}
