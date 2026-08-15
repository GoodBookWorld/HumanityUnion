/**
 * Assistant Production Hardening Pack 02 — accessibility & performance notes.
 *
 * Accessibility (verified in modal implementation):
 * - role="dialog" + aria-modal + aria-labelledby + aria-describedby
 * - Focus moves to Close on open; Tab cycles within dialog; Escape closes
 * - Guest CTA uses text links (Sign in / Register), not icon-only controls
 * - Session actions and composer controls have visible text labels
 * - Conversation region uses aria-live="polite" for new turns
 * - prefers-reduced-motion disables smooth scroll in conversation
 *
 * Performance (Pack 01 controls still apply):
 * - Session history bounded client-side and server-side
 * - Prompt budget + truncated stage/draft context
 * - Rate limits prevent abusive Gemini loops
 * - Diagnostics estimate prompt size without logging prompt bodies
 *
 * Browser matrix (manual / staging checklist):
 * Desktop · Tablet · Mobile · Guest · Authenticated · Author · Active Ally · Public visitor
 * Surfaces: Workspace, Initiatives, Messages, Notifications, Preferences, Profile,
 * Initiative Lifecycle Author/Preview/Public, FAB, Widget, Ask Assistant.
 */

export const ASSISTANT_PRODUCTION_READINESS = {
  canonicalModal: "HumanityUnionAssistantModal",
  canonicalHttpBase: "/api/v1/assistant",
  accessibilityBaseline: "dialog-focus-trap-escape-labels-reduced-motion",
  performanceBaseline: "history-budget-rate-limit-prompt-budget",
} as const;
