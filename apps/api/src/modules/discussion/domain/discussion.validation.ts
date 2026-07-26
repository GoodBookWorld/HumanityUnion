import type { CreateDiscussionCommandInput } from "./discussion.types.js";
import { DiscussionValidationError } from "./discussion.errors.js";

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 200;
const OPENING_MESSAGE_MIN_LENGTH = 10;
const OPENING_MESSAGE_MAX_LENGTH = 5000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeText(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new DiscussionValidationError(`${fieldName} is required.`);
  }

  return normalized;
}

export function parseActivityId(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new DiscussionValidationError("activityId must be a valid identifier.");
  }

  return value.trim();
}

export function validateCreateDiscussionInput(
  input: Record<string, unknown>,
): CreateDiscussionCommandInput {
  if (typeof input.activityId !== "string") {
    throw new DiscussionValidationError("activityId is required.");
  }

  if (typeof input.title !== "string") {
    throw new DiscussionValidationError("title is required.");
  }

  if (typeof input.openingMessage !== "string") {
    throw new DiscussionValidationError("openingMessage is required.");
  }

  const activityId = parseActivityId(input.activityId);
  const title = normalizeText(input.title, "title");
  const openingMessage = normalizeText(input.openingMessage, "openingMessage");

  if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
    throw new DiscussionValidationError(
      `title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`,
    );
  }

  if (
    openingMessage.length < OPENING_MESSAGE_MIN_LENGTH ||
    openingMessage.length > OPENING_MESSAGE_MAX_LENGTH
  ) {
    throw new DiscussionValidationError(
      `openingMessage must be between ${OPENING_MESSAGE_MIN_LENGTH} and ${OPENING_MESSAGE_MAX_LENGTH} characters.`,
    );
  }

  return {
    activityId,
    title,
    openingMessage,
  };
}

export function assertNoTrustedCreateDiscussionFields(input: Record<string, unknown>): void {
  for (const forbidden of [
    "discussionId",
    "creatorMemberId",
    "status",
    "visibility",
    "aggregateVersion",
    "createdAt",
    "updatedAt",
  ]) {
    if (forbidden in input) {
      throw new DiscussionValidationError(`Client must not supply "${forbidden}".`);
    }
  }
}
