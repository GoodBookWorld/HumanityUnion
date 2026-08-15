export const ASSISTANT_TITLE = "Civic Assistant";

export const ASSISTANT_SAFETY_NOTE =
  "Assistant suggestions are advisory. You remain responsible for all civic actions.";

export const ASSISTANT_PLACEHOLDER_MESSAGE =
  "AI assistance is not connected yet. This action is prepared for the future assistant engine.";

export const ASSISTANT_GREETING =
  "I can help you understand the civic workflow and organize your next steps. I do not publish, vote, verify, send, or archive on your behalf.";

export const ASSISTANT_INPUT_LABEL = "Message the assistant (coming soon)";

export const ASSISTANT_COMING_SOON_INPUT =
  "Assistant chat is not connected yet. Suggested actions below are placeholders for a future engine.";

/**
 * Recovery Task 33 — Workspace UX Evolution, Part 10.
 *
 * The Civic Assistant is described as a future contextual advisor. These
 * labels are extension points only — UI-visible, disabled affordances that
 * describe what the assistant will eventually help with. No AI behavior is
 * implemented; selecting one of these does nothing beyond visual state.
 */
export const ASSISTANT_FUTURE_CAPABILITIES = [
  "Improve initiative title",
  "Generate description",
  "Generate proposal",
  "Improve report",
  "Create illustration",
  "Answer a question",
] as const;

export const ASSISTANT_COPY_LABEL = "Copy";
export const ASSISTANT_COPIED_LABEL = "Copied";
export const ASSISTANT_SHARE_LABEL = "Share";
export const ASSISTANT_SHARED_LABEL = "Link copied";
