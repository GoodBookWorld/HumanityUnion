import { resolvePublicGeography } from "../../data/geography/format-public-geography";
import { isAdminAccountRole } from "./is-admin-role";
import {
  ADMIN_PANEL_SECTIONS,
  type AdminPanelSectionId,
} from "./admin-panel-sections";

/**
 * Pack 11B — Admin Overview "Editor" widget is an authority summary, not a role.
 * These section ids are the Admin Panel areas with real editing/moderation surfaces
 * (not inventory-only / placeholder / diagnostics sections).
 */
export const ADMIN_EDITOR_CAPABILITY_SECTION_IDS = [
  "initiatives",
  "public-choice",
  "publishing",
  "media-resources",
  "country-people",
  "beta-access",
] as const satisfies readonly AdminPanelSectionId[];

export type AdminEditorCapabilitySectionId =
  (typeof ADMIN_EDITOR_CAPABILITY_SECTION_IDS)[number];

export type AdminEditingAccessStatus = "available" | "unavailable";

export type AdminGeographicEditingLevel = "WORLD" | "COUNTRY" | "REGION" | "CITY";

export interface AdminEditorCapability {
  readonly sectionId: AdminEditorCapabilitySectionId;
  readonly label: string;
  readonly status: AdminEditingAccessStatus;
  readonly statusLabel: string;
}

/**
 * Future-ready geographic editing area. Today global Admin resolves WORLD only;
 * COUNTRY / REGION / CITY shapes are for presentation when scoped authority exists.
 */
export interface AdminGeographicEditingAreaInput {
  readonly level: AdminGeographicEditingLevel;
  readonly countryCode?: string;
  readonly regionCode?: string;
  readonly communitySlug?: string;
  /** When community JSON is not loaded, callers may pass a resolved city label. */
  readonly knownCommunityName?: string;
}

export interface AdminGeographicEditingArea {
  readonly level: AdminGeographicEditingLevel;
  /** User-facing level: World / Country / Region / City */
  readonly levelLabel: string;
  /** Primary place line (e.g. World, or Canada → British Columbia). */
  readonly summary: string;
  /** Supporting copy (e.g. all countries… or empty when summary is enough). */
  readonly detail: string;
}

export interface AdminEditorAuthority {
  readonly capabilities: readonly AdminEditorCapability[];
  readonly editingArea: AdminGeographicEditingArea;
}

const LEVEL_LABELS: Record<AdminGeographicEditingLevel, string> = {
  WORLD: "World",
  COUNTRY: "Country",
  REGION: "Region",
  CITY: "City",
};

function sectionLabel(sectionId: AdminEditorCapabilitySectionId): string {
  const section = ADMIN_PANEL_SECTIONS.find((entry) => entry.id === sectionId);
  return section?.label ?? sectionId;
}

/**
 * Formats geographic editing area for Overview.
 * Uses canonical @hu/geography resolvers — never raw CA / CA-BC as primary labels.
 */
export function formatAdminGeographicEditingArea(
  input: AdminGeographicEditingAreaInput,
): AdminGeographicEditingArea {
  const levelLabel = LEVEL_LABELS[input.level];

  if (input.level === "WORLD") {
    return {
      level: "WORLD",
      levelLabel,
      summary: "World",
      detail: "All countries, regions and cities",
    };
  }

  const resolved = resolvePublicGeography({
    countryCode: input.countryCode,
    regionCode: input.regionCode,
    communitySlug: input.communitySlug,
    knownCommunityName: input.knownCommunityName,
  });

  const parts: string[] = [];
  if (resolved.country) {
    parts.push(resolved.country);
  }
  if (input.level !== "COUNTRY" && resolved.region) {
    parts.push(resolved.region);
  }
  if (input.level === "CITY" && resolved.city) {
    parts.push(resolved.city);
  }

  const summary = parts.length > 0 ? parts.join(" → ") : levelLabel;

  return {
    level: input.level,
    levelLabel,
    summary,
    detail: "",
  };
}

/**
 * Read-only Editor authority for the current account.
 * Derives editing access from Admin Panel sections that have real mutation surfaces,
 * gated by the same global `role === "admin"` authority AdminAccessGate / assertAdminUser use.
 * Geographic scope is WORLD while no server-enforced country/region/city admin scope exists.
 */
export function resolveAdminEditorAuthority(input: {
  role: string | null | undefined;
}): AdminEditorAuthority | null {
  if (!isAdminAccountRole(input.role)) {
    return null;
  }

  const capabilities: AdminEditorCapability[] = ADMIN_EDITOR_CAPABILITY_SECTION_IDS.map(
    (sectionId) => ({
      sectionId,
      label: sectionLabel(sectionId),
      status: "available",
      statusLabel: "Available",
    }),
  );

  return {
    capabilities,
    editingArea: formatAdminGeographicEditingArea({ level: "WORLD" }),
  };
}
