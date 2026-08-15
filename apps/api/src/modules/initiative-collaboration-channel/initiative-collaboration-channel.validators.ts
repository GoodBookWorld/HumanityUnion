import { InitiativeCollaborationChannelValidationError } from "./initiative-collaboration-channel.errors.js";

/**
 * Part 4 — text-only composer (no attachments, no emoji system, no
 * reactions). Deliberately an independent copy of Direct Messaging's exact
 * text-safety rule (`direct-messaging.validators.ts`) rather than an
 * import from that module: the Collaboration Channel is "completely
 * independent from Personal Direct Messaging" (Part 1), so its validation
 * boundary must not depend on Direct Messaging internals, even though the
 * rule itself is intentionally identical.
 */
export const MAX_COLLABORATION_CHANNEL_MESSAGE_LENGTH = 2000;

const HTML_SIGNIFICANT_CHARACTERS = /[<>]/;
/** Every Unicode control character except tab (\t), newline (\n), carriage return (\r). */
// eslint-disable-next-line no-control-regex -- intentional: detects disallowed control-only content.
const DISALLOWED_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function validateCollaborationChannelMessageText(rawText: unknown): string {
  if (typeof rawText !== "string") {
    throw new InitiativeCollaborationChannelValidationError("Message text is required.");
  }

  if (HTML_SIGNIFICANT_CHARACTERS.test(rawText)) {
    throw new InitiativeCollaborationChannelValidationError("Message contains invalid characters.");
  }

  if (DISALLOWED_CONTROL_CHARACTERS.test(rawText)) {
    throw new InitiativeCollaborationChannelValidationError("Message contains invalid characters.");
  }

  const normalized = rawText.replace(/\r\n/g, "\n").trim();

  if (normalized.length === 0) {
    throw new InitiativeCollaborationChannelValidationError("Message cannot be empty.");
  }

  if (normalized.length > MAX_COLLABORATION_CHANNEL_MESSAGE_LENGTH) {
    throw new InitiativeCollaborationChannelValidationError(
      `Message must be at most ${MAX_COLLABORATION_CHANNEL_MESSAGE_LENGTH} characters.`,
    );
  }

  return normalized;
}
