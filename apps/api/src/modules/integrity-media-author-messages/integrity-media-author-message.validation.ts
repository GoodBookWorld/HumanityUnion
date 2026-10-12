import {
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_BODY_MAX_LENGTH,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_CTA_LABEL_MAX_LENGTH,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_CTA_URL_MAX_LENGTH,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_TITLE_MAX_LENGTH,
} from "./integrity-media-author-message.constants.js";
import type { IntegrityMediaAuthorMessageCta } from "./integrity-media-author-message.types.js";

export interface ValidatedIntegrityMediaAuthorMessageContent {
  title: string;
  body: string;
  cta: IntegrityMediaAuthorMessageCta | null;
  category: typeof INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY;
}

export interface IntegrityMediaAuthorMessageValidationFailure {
  ok: false;
  code: "invalid_request" | "payload_too_large" | "invalid_cta";
  message: string;
}

/** http/https only. Same rule the live Integrity Media receiver applies. */
export function isIntegrityMediaAuthorMessageCtaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Ordinary chat. Title and CTA are not part of this contract. */
export function validateIntegrityMediaAuthorChatContent(input: {
  body: unknown;
}):
  | { ok: true; value: { body: string; category: typeof INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY } }
  | IntegrityMediaAuthorMessageValidationFailure {
  if (typeof input.body !== "string") {
    return failure("invalid_request", "Message is required.");
  }

  const body = input.body.trim();

  if (body.length === 0) {
    return failure("invalid_request", "Message is required.");
  }

  if (containsMarkup(body)) {
    return failure("invalid_request", "Message must be plain text.");
  }

  if (body.length > INTEGRITY_MEDIA_AUTHOR_MESSAGE_BODY_MAX_LENGTH) {
    return failure("payload_too_large", "Message is too long.");
  }

  return {
    ok: true,
    value: {
      body,
      category: INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY,
    },
  };
}

export function validateIntegrityMediaAuthorMessageContent(input: {
  title: unknown;
  body: unknown;
  cta: unknown;
}):
  | { ok: true; value: ValidatedIntegrityMediaAuthorMessageContent }
  | IntegrityMediaAuthorMessageValidationFailure {
  if (typeof input.title !== "string" || typeof input.body !== "string") {
    return failure("invalid_request", "Title and message are required.");
  }

  const title = input.title.trim();
  const body = input.body.trim();

  if (title.length === 0 || body.length === 0) {
    return failure("invalid_request", "Title and message are required.");
  }

  if (containsMarkup(title) || containsMarkup(body)) {
    return failure("invalid_request", "Title and message must be plain text.");
  }

  if (
    title.length > INTEGRITY_MEDIA_AUTHOR_MESSAGE_TITLE_MAX_LENGTH ||
    body.length > INTEGRITY_MEDIA_AUTHOR_MESSAGE_BODY_MAX_LENGTH
  ) {
    return failure("payload_too_large", "Title or message is too long.");
  }

  if (input.cta === undefined || input.cta === null) {
    return {
      ok: true,
      value: {
        title,
        body,
        cta: null,
        category: INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY,
      },
    };
  }

  if (typeof input.cta !== "object" || Array.isArray(input.cta)) {
    return failure("invalid_cta", "The message link is not valid.");
  }

  const cta = input.cta as Record<string, unknown>;
  const extraCtaField = Object.keys(cta).find((key) => key !== "label" && key !== "url");

  if (extraCtaField || typeof cta.label !== "string" || typeof cta.url !== "string") {
    return failure("invalid_cta", "The message link is not valid.");
  }

  const label = cta.label.trim();
  const url = cta.url.trim();

  if (label.length === 0 || url.length === 0 || containsMarkup(label) || containsMarkup(url)) {
    return failure("invalid_cta", "The message link is not valid.");
  }

  if (
    label.length > INTEGRITY_MEDIA_AUTHOR_MESSAGE_CTA_LABEL_MAX_LENGTH ||
    url.length > INTEGRITY_MEDIA_AUTHOR_MESSAGE_CTA_URL_MAX_LENGTH
  ) {
    return failure("payload_too_large", "The message link is too long.");
  }

  if (!isIntegrityMediaAuthorMessageCtaUrl(url)) {
    return failure("invalid_cta", "The message link must be an http(s) URL.");
  }

  return {
    ok: true,
    value: {
      title,
      body,
      cta: { label, url },
      category: INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY,
    },
  };
}

function containsMarkup(value: string): boolean {
  return /[<>]/.test(value);
}

function failure(
  code: IntegrityMediaAuthorMessageValidationFailure["code"],
  message: string,
): IntegrityMediaAuthorMessageValidationFailure {
  return { ok: false, code, message };
}
