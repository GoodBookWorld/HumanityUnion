import type { CreateProposalCommandInput, SubmitProposalCommandInput } from "./proposal.types.js";
import { ProposalValidationError } from "./proposal.errors.js";

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 200;
const SUMMARY_MIN_LENGTH = 10;
const SUMMARY_MAX_LENGTH = 500;
const PROPOSAL_TEXT_MIN_LENGTH = 10;
const PROPOSAL_TEXT_MAX_LENGTH = 10000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeText(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new ProposalValidationError(`${fieldName} is required.`);
  }

  return normalized;
}

export function parseUuid(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new ProposalValidationError(`${fieldName} must be a valid identifier.`);
  }

  return value.trim();
}

export function validateCreateProposalInput(
  input: Record<string, unknown>,
): CreateProposalCommandInput {
  if (typeof input.activityId !== "string") {
    throw new ProposalValidationError("activityId is required.");
  }

  if (typeof input.title !== "string") {
    throw new ProposalValidationError("title is required.");
  }

  if (typeof input.summary !== "string") {
    throw new ProposalValidationError("summary is required.");
  }

  if (typeof input.proposalText !== "string") {
    throw new ProposalValidationError("proposalText is required.");
  }

  const activityId = parseUuid(input.activityId, "activityId");
  const title = normalizeText(input.title, "title");
  const summary = normalizeText(input.summary, "summary");
  const proposalText = normalizeText(input.proposalText, "proposalText");

  let discussionId: string | undefined;

  if (input.discussionId !== undefined && input.discussionId !== null) {
    if (typeof input.discussionId !== "string") {
      throw new ProposalValidationError("discussionId must be a valid identifier.");
    }

    discussionId = parseUuid(input.discussionId, "discussionId");
  }

  if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
    throw new ProposalValidationError(
      `title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`,
    );
  }

  if (summary.length < SUMMARY_MIN_LENGTH || summary.length > SUMMARY_MAX_LENGTH) {
    throw new ProposalValidationError(
      `summary must be between ${SUMMARY_MIN_LENGTH} and ${SUMMARY_MAX_LENGTH} characters.`,
    );
  }

  if (
    proposalText.length < PROPOSAL_TEXT_MIN_LENGTH ||
    proposalText.length > PROPOSAL_TEXT_MAX_LENGTH
  ) {
    throw new ProposalValidationError(
      `proposalText must be between ${PROPOSAL_TEXT_MIN_LENGTH} and ${PROPOSAL_TEXT_MAX_LENGTH} characters.`,
    );
  }

  return {
    activityId,
    ...(discussionId ? { discussionId } : {}),
    title,
    summary,
    proposalText,
  };
}

export function assertNoTrustedCreateProposalFields(input: Record<string, unknown>): void {
  for (const forbidden of [
    "proposalId",
    "creatorMemberId",
    "status",
    "visibility",
    "aggregateVersion",
    "createdAt",
    "updatedAt",
  ]) {
    if (forbidden in input) {
      throw new ProposalValidationError(`Client must not supply "${forbidden}".`);
    }
  }
}

export function validateSubmitProposalCommand(proposalId: string): SubmitProposalCommandInput {
  return {
    proposalId: parseUuid(proposalId, "proposalId"),
  };
}

export function assertNoTrustedSubmitProposalFields(input: Record<string, unknown>): void {
  for (const forbidden of [
    "proposalId",
    "creatorMemberId",
    "status",
    "visibility",
    "aggregateVersion",
    "createdAt",
    "updatedAt",
    "submittedAt",
    "activityId",
    "discussionId",
    "title",
    "summary",
    "proposalText",
  ]) {
    if (forbidden in input) {
      throw new ProposalValidationError(`Client must not supply "${forbidden}".`);
    }
  }
}
