export type AdminPanelSectionId =
  | "overview"
  | "participants"
  | "initiatives"
  | "publishing"
  | "seo"
  | "beta-access"
  | "platform"
  | "audit";

export interface AdminPanelSection {
  readonly id: AdminPanelSectionId;
  readonly label: string;
  readonly href: string;
}

/** Canonical Admin Panel horizontal navigation — Pack 02. */
export const ADMIN_PANEL_SECTIONS: readonly AdminPanelSection[] = [
  { id: "overview", label: "Overview", href: "/admin" },
  { id: "participants", label: "Participants", href: "/admin/participants" },
  { id: "initiatives", label: "Initiatives", href: "/admin/initiatives" },
  { id: "publishing", label: "Publishing", href: "/admin/publishing" },
  { id: "seo", label: "SEO", href: "/admin/seo" },
  { id: "beta-access", label: "Beta Access", href: "/admin/beta-access" },
  { id: "platform", label: "Platform", href: "/admin/platform" },
  { id: "audit", label: "Audit", href: "/admin/audit" },
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
