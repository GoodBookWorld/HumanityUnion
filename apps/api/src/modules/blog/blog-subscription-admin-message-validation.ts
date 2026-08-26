/**
 * Pack 21E — Admin selected-subscriber message validation.
 */

export const BLOG_ADMIN_MESSAGE_SUBJECT_MAX_LENGTH = 180;
export const BLOG_ADMIN_MESSAGE_BODY_MAX_LENGTH = 4000;
export const BLOG_ADMIN_MESSAGE_CTA_LABEL_MAX_LENGTH = 60;
/** Conservative max selected recipients per Admin send (matches Admin list max). */
export const BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS = 100;

function rejectHtml(value: string, field: string): void {
  if (/<|>|script/i.test(value)) {
    throw new Error(`${field} must not contain HTML.`);
  }
}

export function sanitizeAdminSubscriberMessageSubject(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("subject must be a string.");
  }
  rejectHtml(value, "subject");
  const cleaned = value.replace(/\r\n/g, "\n").trim();
  if (cleaned.length < 1) {
    throw new Error("subject must not be empty.");
  }
  if (cleaned.length > BLOG_ADMIN_MESSAGE_SUBJECT_MAX_LENGTH) {
    throw new Error(
      `subject must be at most ${BLOG_ADMIN_MESSAGE_SUBJECT_MAX_LENGTH} characters.`,
    );
  }
  return cleaned;
}

export function sanitizeAdminSubscriberMessageBody(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("message must be a string.");
  }
  rejectHtml(value, "message");
  const cleaned = value.replace(/\r\n/g, "\n").trim();
  if (cleaned.length < 1) {
    throw new Error("message must not be empty.");
  }
  if (cleaned.length > BLOG_ADMIN_MESSAGE_BODY_MAX_LENGTH) {
    throw new Error(
      `message must be at most ${BLOG_ADMIN_MESSAGE_BODY_MAX_LENGTH} characters.`,
    );
  }
  return cleaned;
}

export function sanitizeOptionalAdminMessageCta(input: {
  ctaLabel?: unknown;
  ctaUrl?: unknown;
}): { ctaLabel?: string; ctaUrl?: string } {
  const hasLabel = input.ctaLabel !== undefined && input.ctaLabel !== null && input.ctaLabel !== "";
  const hasUrl = input.ctaUrl !== undefined && input.ctaUrl !== null && input.ctaUrl !== "";
  if (!hasLabel && !hasUrl) {
    return {};
  }
  if (!hasLabel || !hasUrl) {
    throw new Error("ctaLabel and ctaUrl must be provided together.");
  }
  if (typeof input.ctaLabel !== "string" || typeof input.ctaUrl !== "string") {
    throw new Error("ctaLabel and ctaUrl must be strings.");
  }
  rejectHtml(input.ctaLabel, "ctaLabel");
  rejectHtml(input.ctaUrl, "ctaUrl");
  const ctaLabel = input.ctaLabel.trim();
  const ctaUrl = input.ctaUrl.trim();
  if (ctaLabel.length < 1 || ctaLabel.length > BLOG_ADMIN_MESSAGE_CTA_LABEL_MAX_LENGTH) {
    throw new Error(
      `ctaLabel must be 1–${BLOG_ADMIN_MESSAGE_CTA_LABEL_MAX_LENGTH} characters.`,
    );
  }
  if (ctaUrl.startsWith("/")) {
    if (ctaUrl.includes("://") || /[<>\s]/.test(ctaUrl)) {
      throw new Error("ctaUrl must be a safe site-relative path.");
    }
    return { ctaLabel, ctaUrl };
  }
  try {
    const parsed = new URL(ctaUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("ctaUrl must be http(s) or a site-relative path.");
    }
  } catch {
    throw new Error("ctaUrl must be http(s) or a site-relative path.");
  }
  return { ctaLabel, ctaUrl };
}

export function sanitizeAdminSubscriberIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("subscriberIds must be an array.");
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      throw new Error("subscriberIds must contain only subscriberId strings.");
    }
    const id = entry.trim();
    if (!id) {
      throw new Error("subscriberIds must not contain empty values.");
    }
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  if (ids.length < 1) {
    throw new Error("Select at least one subscriber.");
  }
  if (ids.length > BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS) {
    throw new Error(
      `At most ${BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS} subscribers can be selected per send.`,
    );
  }
  return ids;
}
