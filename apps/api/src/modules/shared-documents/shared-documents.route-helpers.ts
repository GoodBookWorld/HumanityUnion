import type { Response } from "express";

export function resolveParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

/**
 * Part 7/8 — "not found" and "access denied" resolve to the same generic
 * 404 for every context (never leaking whether a Conversation/Channel/
 * Session exists to someone who is not a member of it — the same
 * posture Direct Messaging and the Collaboration Channel/Sessions
 * routes already use). `ManagerOnlyError` only ever occurs after the
 * requester is already a confirmed context member, so a 403 there is a
 * real authorization distinction, not an existence leak.
 */
function resolveErrorStatus(errorName: string): number {
  if (
    errorName === "SharedDocumentContextNotFoundError" ||
    errorName === "SharedDocumentAccessDeniedError" ||
    errorName === "SharedDocumentNotFoundError"
  ) {
    return 404;
  }

  if (errorName === "SharedDocumentManagerOnlyError") {
    return 403;
  }

  return 400;
}

export function handleSharedDocumentServiceError(res: Response, error: unknown): void {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : "Shared Document request failed.";
  res.status(resolveErrorStatus(name)).json(createFailureResponse(message));
}
