/**
 * SEO Pack 06 — Admin SEO working-screen model (views, inventory rows, filters).
 * Read-only. Reuses Pack 05 diagnostics; no SEO write model.
 */

import type { SeoCoverageState, SeoDiagnosticSeverity } from "./admin-seo-diagnostics-model";
import {
  SEO_PUBLIC_SURFACE_REGISTRY,
  coverageStateToSeverity,
} from "./admin-seo-diagnostics-model";

export const ADMIN_SEO_VIEWS = ["overview", "pages", "diagnostics", "structured-data"] as const;

export type AdminSeoViewId = (typeof ADMIN_SEO_VIEWS)[number];

export const ADMIN_SEO_VIEW_LABELS: Record<AdminSeoViewId, string> = {
  overview: "Overview",
  pages: "Pages",
  diagnostics: "Diagnostics",
  "structured-data": "Structured Data",
};

export type SeoPageFamilyId =
  | "home"
  | "country"
  | "blog"
  | "initiative"
  | "participant-profile"
  | "petition"
  | "knowledge"
  | "civic-archive";

export type SeoMode = "automatic" | "customized" | "deferred";

export type SeoCapabilityStatus = SeoDiagnosticSeverity;

/** Stable descriptor for a future Page SEO Editor pack. */
export interface SeoPageEntityDescriptor {
  readonly family: SeoPageFamilyId;
  readonly entityKey: string;
  readonly canonicalPath: string;
  readonly label: string;
}

export interface SeoPageInventoryRow {
  readonly id: string;
  readonly family: SeoPageFamilyId;
  readonly familyLabel: string;
  readonly title: string;
  readonly canonicalPath: string;
  readonly metadata: SeoCapabilityStatus;
  readonly canonical: SeoCapabilityStatus;
  readonly openGraph: SeoCapabilityStatus;
  readonly sitemap: SeoCapabilityStatus;
  readonly structuredData: SeoCapabilityStatus;
  readonly seoMode: SeoMode;
  readonly descriptor: SeoPageEntityDescriptor;
  readonly publicHref: string | null;
  readonly inventoryKind: "page" | "family-deferred";
  readonly note?: string;
}

export interface SeoStructuredDataTypeCoverage {
  readonly id: string;
  readonly schemaType: string;
  readonly status: SeoCapabilityStatus;
  readonly surfaces: readonly string[];
  readonly summary: string;
}

export interface SeoPageInventoryFilters {
  readonly query: string;
  readonly family: "all" | SeoPageFamilyId;
  readonly status: "all" | SeoCapabilityStatus;
}

export function isAdminSeoViewId(value: string): value is AdminSeoViewId {
  return (ADMIN_SEO_VIEWS as readonly string[]).includes(value);
}

export function resolveBlogSeoMode(input: {
  seoTitle?: string | null;
  seoDescription?: string | null;
}): Exclude<SeoMode, "deferred"> {
  if (input.seoTitle?.trim() || input.seoDescription?.trim()) {
    return "customized";
  }
  return "automatic";
}

export function coverageToCapabilityStatus(state: SeoCoverageState): SeoCapabilityStatus {
  return coverageStateToSeverity(state);
}

function familyLabel(family: SeoPageFamilyId): string {
  switch (family) {
    case "home":
      return "Home";
    case "country":
      return "Countries";
    case "blog":
      return "Blog";
    case "initiative":
      return "Initiatives";
    case "participant-profile":
      return "Participant Profiles";
    case "petition":
      return "Petitions";
    case "knowledge":
      return "Knowledge";
    case "civic-archive":
      return "Civic Archive";
  }
}

export function buildSeoPageInventoryRow(input: {
  family: SeoPageFamilyId;
  entityKey: string;
  title: string;
  canonicalPath: string;
  metadata: SeoCapabilityStatus;
  canonical: SeoCapabilityStatus;
  openGraph: SeoCapabilityStatus;
  sitemap: SeoCapabilityStatus;
  structuredData: SeoCapabilityStatus;
  seoMode: SeoMode;
  publicHref?: string | null;
  inventoryKind?: "page" | "family-deferred";
  note?: string;
}): SeoPageInventoryRow {
  return {
    id: `${input.family}:${input.entityKey}`,
    family: input.family,
    familyLabel: familyLabel(input.family),
    title: input.title,
    canonicalPath: input.canonicalPath,
    metadata: input.metadata,
    canonical: input.canonical,
    openGraph: input.openGraph,
    sitemap: input.sitemap,
    structuredData: input.structuredData,
    seoMode: input.seoMode,
    publicHref: input.publicHref ?? null,
    inventoryKind: input.inventoryKind ?? "page",
    note: input.note,
    descriptor: {
      family: input.family,
      entityKey: input.entityKey,
      canonicalPath: input.canonicalPath,
      label: input.title,
    },
  };
}

export function buildHomeSeoInventoryRow(): SeoPageInventoryRow {
  const home = SEO_PUBLIC_SURFACE_REGISTRY.find((entry) => entry.id === "home");
  return buildSeoPageInventoryRow({
    family: "home",
    entityKey: "home",
    title: "Home",
    canonicalPath: "/",
    metadata: coverageToCapabilityStatus(home?.metadata ?? "covered"),
    canonical: coverageToCapabilityStatus(home?.canonical ?? "covered"),
    openGraph: coverageToCapabilityStatus(home?.openGraph ?? "covered"),
    sitemap: coverageToCapabilityStatus(home?.sitemap ?? "covered"),
    structuredData: coverageToCapabilityStatus(home?.structuredData ?? "covered"),
    seoMode: "automatic",
    publicHref: "/",
    note: home?.notes,
  });
}

export function buildKnowledgeSeoInventoryRow(input: {
  slug: string;
  title: string;
  seoMode?: Exclude<SeoMode, "deferred">;
}): SeoPageInventoryRow {
  const surface = SEO_PUBLIC_SURFACE_REGISTRY.find((entry) => entry.id === "knowledge");
  const path = `/knowledge/${encodeURIComponent(input.slug)}`;
  return buildSeoPageInventoryRow({
    family: "knowledge",
    entityKey: input.slug,
    title: input.title,
    canonicalPath: path,
    metadata: coverageToCapabilityStatus(surface?.metadata ?? "covered"),
    canonical: coverageToCapabilityStatus(surface?.canonical ?? "covered"),
    openGraph: coverageToCapabilityStatus(surface?.openGraph ?? "covered"),
    sitemap: coverageToCapabilityStatus(surface?.sitemap ?? "covered"),
    structuredData: coverageToCapabilityStatus(surface?.structuredData ?? "covered"),
    seoMode: input.seoMode ?? "automatic",
    publicHref: path,
    note: surface?.notes,
  });
}

export function buildCivicArchiveSeoInventoryRow(input: {
  initiativeId: string;
  title: string;
  seoMode?: Exclude<SeoMode, "deferred">;
}): SeoPageInventoryRow {
  const surface = SEO_PUBLIC_SURFACE_REGISTRY.find((entry) => entry.id === "civic-archive");
  const path = `/civic-archive/${encodeURIComponent(input.initiativeId)}`;
  return buildSeoPageInventoryRow({
    family: "civic-archive",
    entityKey: input.initiativeId,
    title: input.title,
    canonicalPath: path,
    metadata: coverageToCapabilityStatus(surface?.metadata ?? "covered"),
    canonical: coverageToCapabilityStatus(surface?.canonical ?? "covered"),
    openGraph: coverageToCapabilityStatus(surface?.openGraph ?? "covered"),
    sitemap: coverageToCapabilityStatus(surface?.sitemap ?? "covered"),
    structuredData: coverageToCapabilityStatus(surface?.structuredData ?? "covered"),
    seoMode: input.seoMode ?? "automatic",
    publicHref: path,
    note: surface?.notes,
  });
}

export function buildCountrySeoInventoryRows(
  countries: readonly { code: string; name: string }[],
  customizedPageIds?: ReadonlySet<string>,
): SeoPageInventoryRow[] {
  const surface = SEO_PUBLIC_SURFACE_REGISTRY.find((entry) => entry.id === "country");
  return countries.map((country) => {
    const code = country.code.trim().toUpperCase();
    const path = `/countries/${encodeURIComponent(code)}`;
    const pageId = `country:${code}`;
    return buildSeoPageInventoryRow({
      family: "country",
      entityKey: code,
      title: country.name,
      canonicalPath: path,
      metadata: coverageToCapabilityStatus(surface?.metadata ?? "covered"),
      canonical: coverageToCapabilityStatus(surface?.canonical ?? "covered"),
      openGraph: coverageToCapabilityStatus(surface?.openGraph ?? "covered"),
      sitemap: coverageToCapabilityStatus(surface?.sitemap ?? "covered"),
      structuredData: coverageToCapabilityStatus(surface?.structuredData ?? "covered"),
      seoMode: customizedPageIds?.has(pageId) ? "customized" : "automatic",
      publicHref: path,
    });
  });
}

export function isSeoPageOverrideEditableFamily(
  family: SeoPageFamilyId,
): family is "country" | "initiative" | "knowledge" | "civic-archive" {
  return (
    family === "country" ||
    family === "initiative" ||
    family === "knowledge" ||
    family === "civic-archive"
  );
}

export function buildBlogSeoInventoryRow(input: {
  postId: string;
  title: string;
  slug: string;
  seoMode: Exclude<SeoMode, "deferred">;
}): SeoPageInventoryRow {
  const surface = SEO_PUBLIC_SURFACE_REGISTRY.find((entry) => entry.id === "blog-article");
  const path = `/blog/${encodeURIComponent(input.slug)}`;
  return buildSeoPageInventoryRow({
    family: "blog",
    entityKey: input.postId,
    title: input.title,
    canonicalPath: path,
    metadata: coverageToCapabilityStatus(surface?.metadata ?? "covered"),
    canonical: coverageToCapabilityStatus(surface?.canonical ?? "covered"),
    openGraph: coverageToCapabilityStatus(surface?.openGraph ?? "covered"),
    sitemap: coverageToCapabilityStatus(surface?.sitemap ?? "covered"),
    structuredData: coverageToCapabilityStatus(surface?.structuredData ?? "covered"),
    seoMode: input.seoMode,
    publicHref: path,
  });
}

export function buildInitiativeSeoInventoryRow(input: {
  initiativeId: string;
  title: string;
  seoMode?: Exclude<SeoMode, "deferred">;
}): SeoPageInventoryRow {
  const surface = SEO_PUBLIC_SURFACE_REGISTRY.find((entry) => entry.id === "initiative");
  const path = `/initiatives/public/${encodeURIComponent(input.initiativeId)}`;
  return buildSeoPageInventoryRow({
    family: "initiative",
    entityKey: input.initiativeId,
    title: input.title,
    canonicalPath: path,
    metadata: coverageToCapabilityStatus(surface?.metadata ?? "covered"),
    canonical: coverageToCapabilityStatus(surface?.canonical ?? "covered"),
    openGraph: coverageToCapabilityStatus(surface?.openGraph ?? "covered"),
    sitemap: coverageToCapabilityStatus(surface?.sitemap ?? "covered"),
    structuredData: coverageToCapabilityStatus(surface?.structuredData ?? "covered"),
    seoMode: input.seoMode ?? "automatic",
    publicHref: path,
  });
}

export function buildParticipantProfileSeoInventoryRow(input: {
  publicName: string;
}): SeoPageInventoryRow {
  const surface = SEO_PUBLIC_SURFACE_REGISTRY.find((entry) => entry.id === "participant-profile");
  const path = `/member/${encodeURIComponent(input.publicName)}`;
  return buildSeoPageInventoryRow({
    family: "participant-profile",
    entityKey: input.publicName,
    title: input.publicName,
    canonicalPath: path,
    metadata: coverageToCapabilityStatus(surface?.metadata ?? "covered"),
    canonical: coverageToCapabilityStatus(surface?.canonical ?? "covered"),
    openGraph: coverageToCapabilityStatus(surface?.openGraph ?? "covered"),
    sitemap: coverageToCapabilityStatus(surface?.sitemap ?? "covered"),
    structuredData: coverageToCapabilityStatus(surface?.structuredData ?? "covered"),
    seoMode: "automatic",
    publicHref: path,
    note: "Public profile — SEO overrides remain deferred (Pack 07).",
  });
}

export function buildParticipantProfileFamilyDeferredRow(): SeoPageInventoryRow {
  const surface = SEO_PUBLIC_SURFACE_REGISTRY.find((entry) => entry.id === "participant-profile");
  return buildSeoPageInventoryRow({
    family: "participant-profile",
    entityKey: "family",
    title: "Participant Profiles",
    canonicalPath: "/member/{uniqueName}",
    metadata: coverageToCapabilityStatus(surface?.metadata ?? "covered"),
    canonical: coverageToCapabilityStatus(surface?.canonical ?? "covered"),
    openGraph: coverageToCapabilityStatus(surface?.openGraph ?? "covered"),
    sitemap: coverageToCapabilityStatus(surface?.sitemap ?? "covered"),
    structuredData: coverageToCapabilityStatus(surface?.structuredData ?? "covered"),
    seoMode: "deferred",
    publicHref: null,
    inventoryKind: "family-deferred",
    note:
      "Public profile inventory unavailable right now. Sitemap enumeration exists (Pack 11); retry loading the Pages view.",
  });
}

export function buildPetitionFamilyDeferredRow(): SeoPageInventoryRow {
  const surface = SEO_PUBLIC_SURFACE_REGISTRY.find((entry) => entry.id === "petition");
  return buildSeoPageInventoryRow({
    family: "petition",
    entityKey: "family",
    title: "Petitions",
    canonicalPath: "/initiatives/public/{initiativeId}#petition",
    metadata: coverageToCapabilityStatus(surface?.metadata ?? "covered"),
    canonical: coverageToCapabilityStatus(surface?.canonical ?? "not_applicable"),
    openGraph: coverageToCapabilityStatus(surface?.openGraph ?? "not_applicable"),
    sitemap: coverageToCapabilityStatus(surface?.sitemap ?? "not_applicable"),
    structuredData: coverageToCapabilityStatus(surface?.structuredData ?? "not_applicable"),
    seoMode: "deferred",
    publicHref: null,
    inventoryKind: "family-deferred",
    note:
      "Initiative-owned (Pack 10 Strategy B). Not independently indexed. Legacy /petitions/public/{id} is a noindex compatibility redirect. SEO editing is not available for Petitions.",
  });
}

export function filterSeoPageInventoryRows(
  rows: readonly SeoPageInventoryRow[],
  filters: SeoPageInventoryFilters,
): SeoPageInventoryRow[] {
  const query = filters.query.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.family !== "all" && row.family !== filters.family) {
      return false;
    }

    if (filters.status !== "all") {
      const matchesStatus =
        row.metadata === filters.status ||
        row.canonical === filters.status ||
        row.sitemap === filters.status ||
        row.structuredData === filters.status ||
        (filters.status === "not_applicable" && row.seoMode === "deferred");
      if (!matchesStatus) {
        return false;
      }
    }

    if (!query) {
      return true;
    }

    return (
      row.title.toLowerCase().includes(query) ||
      row.canonicalPath.toLowerCase().includes(query) ||
      row.familyLabel.toLowerCase().includes(query) ||
      row.descriptor.entityKey.toLowerCase().includes(query)
    );
  });
}

/**
 * Pack 04 schema types and which public surfaces emit them.
 */
export function buildStructuredDataTypeCoverage(): readonly SeoStructuredDataTypeCoverage[] {
  return [
    {
      id: "website",
      schemaType: "WebSite",
      status: "healthy",
      surfaces: ["Root layout"],
      summary: "Emitted on the global public root",
    },
    {
      id: "organization",
      schemaType: "Organization",
      status: "healthy",
      surfaces: ["Root layout"],
      summary: "Humanity Union organization node on the public root",
    },
    {
      id: "webpage",
      schemaType: "WebPage",
      status: "healthy",
      surfaces: ["Country", "Initiative", "Knowledge article", "Civic Archive detail"],
      summary: "Generic entity pages without a more specific schema type",
    },
    {
      id: "breadcrumb-list",
      schemaType: "BreadcrumbList",
      status: "healthy",
      surfaces: [
        "Country",
        "Blog article",
        "Initiative",
        "Participant Profile",
        "Knowledge article",
        "Civic Archive detail",
      ],
      summary: "Real public-route breadcrumbs only",
    },
    {
      id: "blog-posting",
      schemaType: "BlogPosting",
      status: "healthy",
      surfaces: ["Blog article"],
      summary: "Public Blog articles",
    },
    {
      id: "profile-page",
      schemaType: "ProfilePage",
      status: "healthy",
      surfaces: ["Participant Profile"],
      summary: "Public /member/{uniqueName} pages",
    },
    {
      id: "person",
      schemaType: "Person",
      status: "healthy",
      surfaces: ["Participant Profile"],
      summary: "Nested mainEntity on ProfilePage",
    },
    {
      id: "petition-initiative-owned",
      schemaType: "Petition (Initiative-owned)",
      status: "not_applicable",
      surfaces: ["Initiative public page (#petition)"],
      summary:
        "Pack 10 Strategy B — no Petition JSON-LD; Initiative WebPage represents the crawlable document",
    },
  ];
}

export function formatSeoModeLabel(mode: SeoMode): string {
  switch (mode) {
    case "automatic":
      return "Automatic";
    case "customized":
      return "Customized";
    case "deferred":
      return "Deferred";
  }
}

export function formatSeoCapabilityLabel(status: SeoCapabilityStatus): string {
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
