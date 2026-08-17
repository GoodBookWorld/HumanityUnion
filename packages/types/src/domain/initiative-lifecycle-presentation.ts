/**
 * Initiative Lifecycle — Part A Part 3/4: Stage status vocabulary and
 * Author/Public mode presentation contract.
 *
 * These are presentation-layer concepts, not persistence models: no stage
 * domain is required to store `InitiativeLifecyclePresentationStatus`
 * directly on its own aggregate. Each domain's real status (Part 3's
 * "domain-status adapter") maps onto this shared vocabulary so every stage
 * workspace can render consistent status chips and Author actions without
 * knowing another domain's status union.
 */

/**
 * Universal stage status vocabulary. Existing domain status unions
 * (e.g. `InitiativeCollectiveDecisionStatus`, `PetitionState`) remain the
 * source of truth and are NOT replaced — a small adapter maps each domain's
 * real status onto one of these five values for shared UI purposes only.
 */
export type InitiativeLifecyclePresentationStatus =
  | "not_started"
  | "draft"
  | "ready_for_review"
  | "published"
  | "superseded"
  /** Optional stage lookup failed (infrastructure) — not the same as not_started/absent. */
  | "unavailable";

/**
 * Who the current viewer is, from the Initiative Lifecycle Stage Workspace's
 * point of view. This is a presentation-layer role, distinct from (but
 * consistent with) `InitiativeActiveAlliesTeam.viewerRole`.
 */
export type InitiativeLifecycleViewerRole = "author" | "active_ally" | "participant" | "guest";

/**
 * The one binary mode switch every lifecycle stage surface renders against.
 * `"author_workspace"` only ever applies to the Initiative's own Author
 * (never an Active Ally, never any other Participant — Part 4), and only
 * for stages where {@link isInitiativeLifecycleAuthorWorkspaceStage} is
 * true. Every other viewer, on every stage, sees `"public"`.
 */
export type InitiativeLifecyclePresentationMode = "public" | "author_workspace";

/**
 * Result of resolving Author Mode for one viewer, one Initiative, one
 * stage. Always produced server-side (Part 4) — the server is the only
 * party that can verify `isInitiativeAuthor` against real identity; the
 * client only ever displays this result, never computes it from a local
 * flag.
 */
export interface InitiativeLifecyclePresentationModeResult {
  readonly viewerRole: InitiativeLifecycleViewerRole;
  readonly isInitiativeAuthor: boolean;
  /** True when this specific stage is one where Author Mode can apply at all. */
  readonly isAuthorWorkspaceStage: boolean;
  readonly presentationMode: InitiativeLifecyclePresentationMode;
}
