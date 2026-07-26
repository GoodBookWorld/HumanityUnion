import {
  ACTIVITY_TYPES,
  ACTIVITY_VISIBILITY_LEVELS,
  type ActivityType,
  type ActivityVisibility,
  type CreateActivityCommandInput,
} from "./activity.types.js";
import { ActivityValidationError } from "./activity.errors.js";

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MIN_LENGTH = 10;
const DESCRIPTION_MAX_LENGTH = 5000;

function normalizeText(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new ActivityValidationError(`${fieldName} is required.`);
  }

  return normalized;
}

export function parseActivityType(value: unknown): ActivityType {
  if (typeof value !== "string" || !ACTIVITY_TYPES.includes(value as ActivityType)) {
    throw new ActivityValidationError(
      `activityType must be one of: ${ACTIVITY_TYPES.join(", ")}.`,
    );
  }

  return value as ActivityType;
}

export function parseActivityVisibility(value: unknown): ActivityVisibility {
  if (
    typeof value !== "string" ||
    !ACTIVITY_VISIBILITY_LEVELS.includes(value as ActivityVisibility)
  ) {
    throw new ActivityValidationError(
      `visibility must be one of: ${ACTIVITY_VISIBILITY_LEVELS.join(", ")}.`,
    );
  }

  return value as ActivityVisibility;
}

export function validateCreateActivityInput(input: Record<string, unknown>): CreateActivityCommandInput {
  if (typeof input.title !== "string") {
    throw new ActivityValidationError("title is required.");
  }

  if (typeof input.description !== "string") {
    throw new ActivityValidationError("description is required.");
  }

  const title = normalizeText(input.title, "title");
  const description = normalizeText(input.description, "description");

  if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
    throw new ActivityValidationError(
      `title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`,
    );
  }

  if (description.length < DESCRIPTION_MIN_LENGTH || description.length > DESCRIPTION_MAX_LENGTH) {
    throw new ActivityValidationError(
      `description must be between ${DESCRIPTION_MIN_LENGTH} and ${DESCRIPTION_MAX_LENGTH} characters.`,
    );
  }

  return {
    title,
    description,
    activityType: parseActivityType(input.activityType),
    visibility: parseActivityVisibility(input.visibility),
  };
}

export function assertNoTrustedCreateActivityFields(input: Record<string, unknown>): void {
  for (const forbidden of [
    "activityId",
    "creatorMemberId",
    "status",
    "aggregateVersion",
    "createdAt",
    "updatedAt",
  ]) {
    if (forbidden in input) {
      throw new ActivityValidationError(`Client must not supply "${forbidden}".`);
    }
  }
}
