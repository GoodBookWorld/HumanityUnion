import { CIVIC_MEDIA_ROUTE } from "../civic-media-center/routes";

export const PRIMARY_NAVIGATION: ReadonlyArray<{
  label: string;
  href?: string;
  status: "active" | "placeholder";
}> = [
  { label: "Home", href: "/", status: "active" },
  { label: "Institutions", href: "/institutions", status: "active" },
  { label: "Initiatives", href: "/initiatives", status: "active" },
  { label: "Civic Media", href: CIVIC_MEDIA_ROUTE, status: "active" },
  { label: "Knowledge", href: "/knowledge", status: "active" },
  { label: "Membership", href: "/membership", status: "active" },
  { label: "Search", href: "/search", status: "active" },
];

/**
 * Desktop floating capsule only (Header Visual Refinement 02).
 * Civic Media / Membership remain in PRIMARY_NAVIGATION for mobile + deep links.
 */
export const DESKTOP_CAPSULE_NAVIGATION = PRIMARY_NAVIGATION.filter((item) =>
  item.label === "Home" ||
  item.label === "Institutions" ||
  item.label === "Initiatives" ||
  item.label === "Knowledge" ||
  item.label === "Search",
);

export type PrimaryNavLabel = (typeof PRIMARY_NAVIGATION)[number]["label"];

export const BRAND_TAGLINE = "WORLD SOLIDARITY";

export const FOOTER_MISSION =
  "A global movement of citizens working together for a more just, peaceful and sustainable world.";

/**
 * Pack 02F / 08I.12 — founding-year copyright template.
 * Locale-facing sentence comes from `navigation.footerCopyright` (ICU).
 * Year stays founding year 2024 (not dynamic calendar year).
 */
export const FOOTER_COPYRIGHT_YEAR = 2024;
