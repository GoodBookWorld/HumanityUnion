/**
 * HU-LC-05C.4B.2/4B.3 — the optional Petition working-draft id of an Assistant
 * request. One rule for request validation and for the duplicate-request guard.
 */
export const MAX_ASSISTANT_DRAFT_ID_LENGTH = 200;

/** The trimmed draftId when it is a non-empty string within the length bound; otherwise null. */
export function normalizeAssistantDraftId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const draftId = value.trim();
  return draftId && draftId.length <= MAX_ASSISTANT_DRAFT_ID_LENGTH ? draftId : null;
}
