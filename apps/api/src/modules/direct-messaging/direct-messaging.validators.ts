import { DirectMessagingValidationError } from "./direct-messaging.errors.js";

/**
 * Part 15 — Text Safety. Mirrors the existing initiative-comment safety
 * convention (`initiative-comment.mongo.repository.ts`): reject any angle
 * bracket outright (blocks both HTML rendering and script injection) and
 * a fixed maximum length, aligned with the same 2000-character limit
 * already established for civic Discussion comments. Line breaks are
 * preserved (never stripped), only HTML-significant characters are
 * rejected.
 */
export const MAX_DIRECT_MESSAGE_LENGTH = 2000;

const HTML_SIGNIFICANT_CHARACTERS = /[<>]/;
/** Every Unicode control character except tab (\t), newline (\n), carriage return (\r). */
// eslint-disable-next-line no-control-regex -- intentional: detects disallowed control-only content.
const DISALLOWED_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function validateDirectMessageText(rawText: unknown): string {
  if (typeof rawText !== "string") {
    throw new DirectMessagingValidationError("Message text is required.");
  }

  if (HTML_SIGNIFICANT_CHARACTERS.test(rawText)) {
    throw new DirectMessagingValidationError("Message contains invalid characters.");
  }

  if (DISALLOWED_CONTROL_CHARACTERS.test(rawText)) {
    throw new DirectMessagingValidationError("Message contains invalid characters.");
  }

  const normalized = rawText.replace(/\r\n/g, "\n").trim();

  if (normalized.length === 0) {
    throw new DirectMessagingValidationError("Message cannot be empty.");
  }

  if (normalized.length > MAX_DIRECT_MESSAGE_LENGTH) {
    throw new DirectMessagingValidationError(
      `Message must be at most ${MAX_DIRECT_MESSAGE_LENGTH} characters.`,
    );
  }

  return normalized;
}

const MAX_PREVIEW_LENGTH = 140;

export function buildDirectMessagePreview(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();

  if (collapsed.length <= MAX_PREVIEW_LENGTH) {
    return collapsed;
  }

  return `${collapsed.slice(0, MAX_PREVIEW_LENGTH - 1).trimEnd()}…`;
}

export function validateOptionalClientMessageId(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DirectMessagingValidationError("clientMessageId must be a non-empty string when provided.");
  }

  if (value.length > 128) {
    throw new DirectMessagingValidationError("clientMessageId must be at most 128 characters.");
  }

  return value.trim();
}
