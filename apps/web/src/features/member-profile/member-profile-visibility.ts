import type { MemberProfileVisibility } from "@hu/types";

export function isMemberProfileFieldVisible(
  visibility: MemberProfileVisibility,
  options: {
    viewerIsAuthenticated: boolean;
    viewerIsOwner: boolean;
  },
): boolean {
  if (visibility === "private" && !options.viewerIsOwner) {
    return false;
  }

  if (visibility === "members_only" && !options.viewerIsAuthenticated && !options.viewerIsOwner) {
    return false;
  }

  return true;
}
