import { createHash, createHmac } from "node:crypto";

import { INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE } from "./integrity-media-author-message.constants.js";

export interface IntegrityMediaAuthorMessageContentInput {
  body: string;
  category: string;
  ctaLabel: string;
  ctaUrl: string;
  title: string;
}

/**
 * UTF-8 JSON with keys in this exact order: body, category, ctaLabel, ctaUrl, title.
 * Absent CTA is represented by empty strings, never omitted keys.
 */
export function buildIntegrityMediaAuthorMessageContentPayload(
  input: IntegrityMediaAuthorMessageContentInput,
): string {
  return JSON.stringify({
    body: input.body,
    category: input.category,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    title: input.title,
  });
}

export function hashIntegrityMediaAuthorMessageContent(
  input: IntegrityMediaAuthorMessageContentInput,
): string {
  return createHash("sha256")
    .update(buildIntegrityMediaAuthorMessageContentPayload(input), "utf8")
    .digest("hex");
}

/** Five newline-joined lines. The message body is not one of them. */
export function buildIntegrityMediaAuthorMessageCanonicalString(input: {
  timestamp: string;
  messageId: string;
  recipientAuthorId: string;
  contentSha256: string;
}): string {
  return [
    INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE,
    input.timestamp,
    input.messageId,
    input.recipientAuthorId,
    input.contentSha256,
  ].join("\n");
}

export function signIntegrityMediaAuthorMessage(secret: string, canonical: string): string {
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

/** Unix seconds as exactly 10 decimal digits. */
export function integrityMediaAuthorMessageTimestamp(now: Date): string {
  const timestamp = String(Math.floor(now.getTime() / 1000));

  if (!/^\d{10}$/.test(timestamp)) {
    throw new Error("Integrity Media message timestamp is outside the supported range.");
  }

  return timestamp;
}
