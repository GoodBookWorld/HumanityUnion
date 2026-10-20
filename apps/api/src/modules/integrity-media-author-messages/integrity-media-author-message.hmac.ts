import { createHash, createHmac } from "node:crypto";

import {
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE_V2,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE_V3,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_V3_ENV,
} from "./integrity-media-author-message.constants.js";

const AUTHOR_MESSAGE_V3_TARGETS = ["staging", "production"] as const;
const AUTHOR_MESSAGE_V3_KINDS = ["notification", "chat"] as const;

export type IntegrityMediaAuthorMessageSignedTarget = (typeof AUTHOR_MESSAGE_V3_TARGETS)[number];
export type IntegrityMediaAuthorMessageSignedKind = (typeof AUTHOR_MESSAGE_V3_KINDS)[number];

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

/**
 * Six newline-joined lines. `kind` is authenticated here and is not part of contentSha256.
 * Matches Integrity Media `buildHuAuthorMessageCanonicalStringV2`.
 */
export function buildIntegrityMediaAuthorMessageCanonicalStringV2(input: {
  timestamp: string;
  messageId: string;
  recipientAuthorId: string;
  kind: "chat";
  contentSha256: string;
}): string {
  return [
    INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE_V2,
    input.timestamp,
    input.messageId,
    input.recipientAuthorId,
    input.kind,
    input.contentSha256,
  ].join("\n");
}

/**
 * Seven newline-joined lines, no trailing newline.
 * `target` and `kind` are authenticated here and are not part of contentSha256.
 * Unknown targets and kinds are rejected and are never replaced with another value.
 */
export function buildIntegrityMediaAuthorMessageCanonicalStringV3(input: {
  timestamp: string;
  messageId: string;
  recipientAuthorId: string;
  target: string;
  kind: string;
  contentSha256: string;
}): string {
  if (!isAuthorMessageV3Target(input.target)) {
    throw new Error("Integrity Media author message v3 target is not recognized.");
  }

  if (!isAuthorMessageV3Kind(input.kind)) {
    throw new Error("Integrity Media author message v3 kind is not recognized.");
  }

  return [
    INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE_V3,
    input.timestamp,
    input.messageId,
    input.recipientAuthorId,
    input.target,
    input.kind,
    input.contentSha256,
  ].join("\n");
}

/** True only for the exact env value `true` after trim. Every other value stays on v1/v2. */
export function integrityMediaAuthorMessageV3Enabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[INTEGRITY_MEDIA_AUTHOR_MESSAGE_V3_ENV]?.trim() === "true";
}

function isAuthorMessageV3Target(
  value: string,
): value is IntegrityMediaAuthorMessageSignedTarget {
  return (AUTHOR_MESSAGE_V3_TARGETS as readonly string[]).includes(value);
}

function isAuthorMessageV3Kind(value: string): value is IntegrityMediaAuthorMessageSignedKind {
  return (AUTHOR_MESSAGE_V3_KINDS as readonly string[]).includes(value);
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
