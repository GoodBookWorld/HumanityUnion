import type { AuthUserPublic, EditorViewerState } from "@hu/types";

/**
 * Pack 12A — Workspace Editor Panel eligibility.
 * Pack 12B will mount nav/content; this helper is the canonical rule.
 *
 * Active Editor grant → eligible.
 * Inactive grant / non-editor / Admin-only → not eligible via Editor path
 * (Admin Panel remains separate via role === "admin").
 */
export function resolveEditorViewerState(
  user: Pick<AuthUserPublic, "editor"> | null | undefined,
): EditorViewerState {
  if (user?.editor?.isEditor === true) {
    return user.editor;
  }
  return { isEditor: false };
}

export function isEligibleForEditorPanel(
  user: Pick<AuthUserPublic, "editor"> | null | undefined,
): boolean {
  const state = resolveEditorViewerState(user);
  return state.isEditor === true && state.status === "ACTIVE";
}
