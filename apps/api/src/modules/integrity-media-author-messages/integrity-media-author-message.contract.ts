import type {
  IntegrityMediaAuthorMessageDirection,
  IntegrityMediaAuthorMessageKind,
} from "./integrity-media-author-message.types.js";

const MESSAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isIntegrityMediaAuthorMessageId(value: unknown): value is string {
  return typeof value === "string" && MESSAGE_ID_PATTERN.test(value);
}
const CREATED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export interface IntegrityMediaAuthorMessageCursor {
  createdAt: string;
  messageId: string;
}

/**
 * Missing and unrecognized values stay on the historical outbound notification
 * contract. Only an explicit im_to_hu or chat value selects the other side.
 */
export function resolveIntegrityMediaAuthorMessageDirection(
  value: unknown,
): IntegrityMediaAuthorMessageDirection {
  return value === "im_to_hu" ? "im_to_hu" : "hu_to_im";
}

export function resolveIntegrityMediaAuthorMessageKind(
  value: unknown,
): IntegrityMediaAuthorMessageKind {
  return value === "chat" ? "chat" : "system";
}

export function parseIntegrityMediaAuthorMessageDirection(
  value: unknown,
): IntegrityMediaAuthorMessageDirection | null {
  return value === "hu_to_im" || value === "im_to_hu" ? value : null;
}

export function parseIntegrityMediaAuthorMessageKind(
  value: unknown,
): IntegrityMediaAuthorMessageKind | null {
  return value === "chat" || value === "system" ? value : null;
}

/** Outbound delivery applies to every row that is not an explicit IM-originated message. */
export function isIntegrityMediaOutboundAuthorMessage(record: {
  direction?: IntegrityMediaAuthorMessageDirection | null;
}): boolean {
  return record.direction !== "im_to_hu";
}

export function encodeIntegrityMediaAuthorMessageCursor(
  input: IntegrityMediaAuthorMessageCursor,
): string {
  return Buffer.from(
    JSON.stringify({ v: 1, createdAt: input.createdAt, messageId: input.messageId }),
    "utf8",
  ).toString("base64url");
}

export function decodeIntegrityMediaAuthorMessageCursor(
  value: string,
): IntegrityMediaAuthorMessageCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      v?: unknown;
      createdAt?: unknown;
      messageId?: unknown;
    };
    if (
      parsed.v !== 1 ||
      typeof parsed.createdAt !== "string" ||
      !CREATED_AT_PATTERN.test(parsed.createdAt) ||
      typeof parsed.messageId !== "string" ||
      !MESSAGE_ID_PATTERN.test(parsed.messageId) ||
      Object.keys(parsed).length !== 3
    ) {
      return null;
    }

    return { createdAt: parsed.createdAt, messageId: parsed.messageId };
  } catch {
    return null;
  }
}

/** True when a row sorts strictly before the cursor in newest-first order. */
export function isBeforeIntegrityMediaAuthorMessageCursor(
  record: { createdAt: string; messageId: string },
  cursor: IntegrityMediaAuthorMessageCursor,
): boolean {
  if (record.createdAt < cursor.createdAt) {
    return true;
  }

  if (record.createdAt > cursor.createdAt) {
    return false;
  }

  return record.messageId < cursor.messageId;
}

export function compareIntegrityMediaAuthorMessagesNewestFirst(
  left: { createdAt: string; messageId: string },
  right: { createdAt: string; messageId: string },
): number {
  const created = right.createdAt.localeCompare(left.createdAt);
  if (created !== 0) {
    return created;
  }

  return right.messageId.localeCompare(left.messageId);
}
