export { default as discussionRouter } from "./api/discussion.routes.js";
export { createDiscussion } from "./application/create-discussion.service.js";
export { getDiscussionByIdForMember } from "./application/discussion-query.service.js";
export {
  buildDiscussionCreatedEventId,
  createDiscussionCreatedEvent,
  type DiscussionCreatedPayload,
} from "./domain/discussion-created.event.js";
export {
  DiscussionActivityNotFoundError,
  DiscussionForbiddenError,
  DiscussionMemberNotRegisteredError,
  DiscussionNotFoundError,
  DiscussionPersistenceError,
  DiscussionTransactionError,
  DiscussionValidationError,
} from "./domain/discussion.errors.js";
export { buildDiscussionAggregateForCreate } from "./domain/create-discussion.aggregate.js";
export type {
  CreateDiscussionCommandInput,
  CreateDiscussionResult,
  DiscussionDetailDto,
  DiscussionRecord,
  DiscussionStatus,
} from "./domain/discussion.types.js";
export {
  assertNoTrustedCreateDiscussionFields,
  validateCreateDiscussionInput,
} from "./domain/discussion.validation.js";
export {
  countDiscussions,
  deleteDiscussionsByCreatorMemberIdPrefix,
  deleteDiscussionsByDiscussionIdPrefix,
  findDiscussionById,
  insertDiscussion,
} from "./infrastructure/discussion.repository.js";
export {
  fromDiscussionMongoDocument,
  toDiscussionDetailDto,
  toDiscussionMongoDocument,
  type DiscussionMongoDocument,
} from "./infrastructure/discussion.persistence.js";
