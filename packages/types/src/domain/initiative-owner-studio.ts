import type { Initiative } from "./initiative.js";

/** Authenticated owner-studio access probe — never expose to non-owners. */
export interface InitiativeOwnerAccessPayload {
  canManage: boolean;
  initiative: Initiative | null;
}
