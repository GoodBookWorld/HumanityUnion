export type AdminPanelSectionId =
  | "overview"
  | "views"
  | "participants"
  | "editors"
  | "initiatives"
  | "public-choice"
  | "publishing"
  | "media-resources"
  | "country-people"
  | "seo"
  | "beta-access"
  | "platform"
  | "audit";

export interface AdminPanelSection {
  readonly id: AdminPanelSectionId;
  readonly label: string;
  readonly href: string;
}

/** Canonical Admin Panel horizontal navigation — Pack 03–09E + Pack 12A Editors. */
export const ADMIN_PANEL_SECTIONS: readonly AdminPanelSection[] = [
  { id: "overview", label: "Overview", href: "/admin" },
  { id: "views", label: "Views", href: "/admin/views" },
  { id: "participants", label: "Participants", href: "/admin/participants" },
  { id: "editors", label: "Editors", href: "/admin/editors" },
  { id: "initiatives", label: "Initiatives", href: "/admin/initiatives" },
  { id: "public-choice", label: "Public Choice", href: "/admin/public-choice" },
  { id: "publishing", label: "Publishing", href: "/admin/publishing" },
  { id: "media-resources", label: "Media Resources", href: "/admin/media-resources" },
  { id: "country-people", label: "Country Team & Partners", href: "/admin/country-people" },
  { id: "seo", label: "SEO", href: "/admin/seo" },
  { id: "beta-access", label: "Beta Access", href: "/admin/beta-access" },
  { id: "platform", label: "Platform", href: "/admin/platform" },
  { id: "audit", label: "Audit", href: "/admin/audit" },
] as const;

export type AdminViewsSectionId = "traffic" | "insights" | "subscribers";

export interface AdminViewsSection {
  readonly id: AdminViewsSectionId;
  readonly label: string;
  readonly href: string;
}

/** Views secondary navigation — Pack 03. */
export const ADMIN_VIEWS_SECTIONS: readonly AdminViewsSection[] = [
  { id: "traffic", label: "Traffic", href: "/admin/views" },
  { id: "insights", label: "Insights", href: "/admin/views/insights" },
  { id: "subscribers", label: "Subscribers", href: "/admin/views/subscribers" },
] as const;

export function resolveAdminPanelSectionId(pathname: string): AdminPanelSectionId {
  const normalized = pathname.replace(/\/$/, "") || "/admin";

  for (const section of ADMIN_PANEL_SECTIONS) {
    if (section.href === "/admin") {
      if (normalized === "/admin") {
        return "overview";
      }
      continue;
    }

    if (normalized === section.href || normalized.startsWith(`${section.href}/`)) {
      return section.id;
    }
  }

  return "overview";
}

export function resolveAdminViewsSectionId(pathname: string): AdminViewsSectionId {
  const normalized = pathname.replace(/\/$/, "") || "/admin/views";

  if (normalized === "/admin/views/insights" || normalized.startsWith("/admin/views/insights/")) {
    return "insights";
  }

  if (
    normalized === "/admin/views/subscribers" ||
    normalized.startsWith("/admin/views/subscribers/")
  ) {
    return "subscribers";
  }

  return "traffic";
}
