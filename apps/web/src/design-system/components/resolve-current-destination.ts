/**
 * Launch Readiness Pack 02 / Pack 04 — primary-nav active destination.
 * Stable English PRIMARY_NAVIGATION labels are the matching identity
 * (Pack 02D translates display text only).
 */

import type { PrimaryNavLabel } from "../../features/public-experience/constants";

type PrimaryDestination = PrimaryNavLabel;

/**
 * Public Initiative lifecycle records that live outside `/initiatives/*`
 * but still belong to the Initiatives navigation destination.
 */
const NESTED_PUBLIC_INITIATIVE_PREFIXES = [
  "/collaborative-analysis/public/",
  "/improvement-proposals/public/",
  "/petitions/public/",
  "/decision-sessions/public/",
  "/collective-decisions/public/",
  "/implementation-commitments/public/",
  "/initiative-implementation-commitments/public/",
  "/implementation-tracking/public/",
  "/implementations/public/",
  "/public-impact/",
  "/civic-archive/",
] as const;

function isNestedPublicInitiativeRoute(pathname: string): boolean {
  if (pathname === "/civic-archive" || pathname === "/civic-archive/") {
    return false;
  }

  return NESTED_PUBLIC_INITIATIVE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Only mark a primary nav item current when the pathname actually belongs to
 * that destination. Unmatched routes (Blog, Workspace, Profile, auth, …) must
 * not fall through to "Home". Nested public Initiative lifecycle records mark
 * Initiatives.
 */
export function resolveCurrentDestination(pathname: string): PrimaryDestination | null {
  if (pathname === "/" || pathname === "") {
    return "Home";
  }

  if (pathname.startsWith("/institutions")) {
    return "Institutions";
  }

  if (pathname.startsWith("/initiatives") || isNestedPublicInitiativeRoute(pathname)) {
    return "Initiatives";
  }

  if (pathname.startsWith("/media") || pathname.startsWith("/knowledge/media")) {
    return "Civic Media";
  }

  if (pathname.startsWith("/knowledge")) {
    return "Knowledge";
  }

  if (pathname.startsWith("/membership")) {
    return "Membership";
  }

  if (pathname.startsWith("/search")) {
    return "Search";
  }

  return null;
}
