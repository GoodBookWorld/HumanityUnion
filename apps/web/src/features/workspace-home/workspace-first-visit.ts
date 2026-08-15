/**
 * Recovery Task 33 — Workspace UX Evolution, Part 6.
 *
 * The backend does not expose a "first login after registration" signal
 * today (no `lastLoginAt`/login-count field is returned by any auth or
 * member-profile endpoint), and this task is explicitly UX-only — no
 * backend, API, or lifecycle change is in scope.
 *
 * As a frontend-only proxy, this mirrors the existing localStorage
 * dismissal pattern already used by `BetaOnboardingChecklist`
 * (`hu-beta-onboarding-dismissed`): the first time this browser renders the
 * Workspace home page for a signed-in participant, no marker is present, so
 * the "first login" welcome is shown; the marker is then set so every
 * subsequent visit (including from other tabs/sessions on this browser)
 * sees the regular "Welcome back" copy.
 *
 * Limitation (see Assessment recommendations): this is per-browser, not
 * per-account — a genuine account-level "first login" signal would need a
 * real backend field. Recording this as a follow-up recommendation, not
 * implementing it here.
 */
const HAS_VISITED_WORKSPACE_KEY = "hu_workspace_has_visited";

export function isFirstWorkspaceVisit(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(HAS_VISITED_WORKSPACE_KEY) !== "true";
}

export function markWorkspaceVisited(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(HAS_VISITED_WORKSPACE_KEY, "true");
}
