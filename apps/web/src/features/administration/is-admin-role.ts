import type { AuthUserAccountRole } from "@hu/types";

/** Canonical admin check for AuthUserPublic.role (JWT /auth/me). */
export function isAdminAccountRole(role: AuthUserAccountRole | string | null | undefined): boolean {
  return role === "admin";
}
