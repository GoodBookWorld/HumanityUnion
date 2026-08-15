/**
 * Initiative Lifecycle — Part A Part 7: standard Author action model.
 *
 * A fixed, shared vocabulary of the actions a lifecycle stage workspace can
 * offer its Author, and the states each action can be in. Every
 * stage-specific pack maps its own domain operations onto this vocabulary
 * (e.g. Collaborative Analysis's "publish" maps to `"publish"`); the shell
 * (Part 6) renders from this vocabulary alone, never from a domain-specific
 * action name.
 */
export type InitiativeLifecycleAuthorActionId =
  | "generate_draft"
  | "regenerate_section"
  | "improve_wording"
  | "save_draft"
  | "preview"
  | "publish"
  | "open_public_preview"
  | "continue_to_next_stage";

export type InitiativeLifecycleAuthorActionState =
  | "available"
  | "unavailable"
  | "loading"
  | "success"
  | "validation_error"
  | "permission_denied"
  | "already_published"
  | "blocked_by_missing_prerequisites";

export interface InitiativeLifecycleAuthorAction {
  readonly actionId: InitiativeLifecycleAuthorActionId;
  readonly label: string;
  readonly state: InitiativeLifecycleAuthorActionState;
  /** Shown as help text/tooltip, especially for non-`"available"` states (e.g. "Coming soon — Workspace API pending."). */
  readonly description?: string;
}
