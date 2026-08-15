import {
  isInitiativeLifecycleAuthorWorkspaceStage,
  type InitiativeLifecyclePresentationModeResult,
  type InitiativeLifecycleViewerRole,
} from "@hu/types";

/**
 * Initiative Lifecycle Part A Part 4 — server-authoritative Author Mode
 * resolution.
 *
 * This is the ONLY place that decides `isInitiativeAuthor`. It always
 * compares against the real, persisted `Initiative.stewardId` and the
 * caller's authenticated `viewerParticipantId` — never a client-supplied
 * flag, never a request body field named `ownerMode`/`isAuthor`, etc.
 * Every HTTP route that needs Author Mode must call this with identity it
 * itself derived from `req.auth`, not from anything the client sent.
 *
 * `"author_workspace"` presentation mode requires BOTH:
 *   1. the viewer genuinely is this Initiative's steward, and
 *   2. the stage is one where Author Mode applies at all (Collaborative
 *      Analysis onward — see {@link isInitiativeLifecycleAuthorWorkspaceStage}).
 *
 * An Active Ally never receives `"author_workspace"`, regardless of stage
 * — Active Allies collaborate with the Author but do not receive Author
 * editing controls (Primary Product Decision).
 */
export interface ResolveInitiativeLifecyclePresentationModeInput {
  readonly initiativeStewardId: string;
  readonly viewerParticipantId: string | null;
  readonly stageId: string;
  /** Caller-resolved (e.g. via `listActiveAlliesByInitiative`), never inferred here. */
  readonly isActiveAlly: boolean;
}

export function resolveInitiativeLifecyclePresentationMode(
  input: ResolveInitiativeLifecyclePresentationModeInput,
): InitiativeLifecyclePresentationModeResult {
  const isInitiativeAuthor =
    input.viewerParticipantId !== null &&
    input.viewerParticipantId.length > 0 &&
    input.viewerParticipantId === input.initiativeStewardId;

  const isAuthorWorkspaceStage = isInitiativeLifecycleAuthorWorkspaceStage(input.stageId);

  const viewerRole: InitiativeLifecycleViewerRole = isInitiativeAuthor
    ? "author"
    : input.isActiveAlly
      ? "active_ally"
      : input.viewerParticipantId
        ? "participant"
        : "guest";

  const presentationMode: InitiativeLifecyclePresentationModeResult["presentationMode"] =
    isInitiativeAuthor && isAuthorWorkspaceStage ? "author_workspace" : "public";

  return {
    viewerRole,
    isInitiativeAuthor,
    isAuthorWorkspaceStage,
    presentationMode,
  };
}
