import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../infrastructure/events/event-envelope.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { enqueueDomainEvent } from "../../infrastructure/outbox/outbox.repository.js";

function skipBlogEventsWithoutMongoInTests(): boolean {
  return process.env.NODE_TEST_ENV === "true" && !isMongoConfigured();
}

let blogPublishEmitCount = 0;

export function resetBlogPublishEmitCountForTests(): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Blog publish emit counters are available only when NODE_TEST_ENV=true.");
  }
  blogPublishEmitCount = 0;
}

export function blogPublishEmitCountForTests(): number {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Blog publish emit counters are available only when NODE_TEST_ENV=true.");
  }
  return blogPublishEmitCount;
}

export async function emitBlogPostSubmittedForReview(input: {
  postId: string;
  authorParticipantId: string;
  actorParticipantId: string;
}): Promise<void> {
  if (skipBlogEventsWithoutMongoInTests()) {
    return;
  }
  await enqueueDomainEvent(
    createDomainEvent({
      eventName: CATALOGUE_EVENTS.blogPostSubmittedForReview,
      aggregateType: "BlogPost",
      aggregateId: input.postId,
      actorId: input.actorParticipantId,
      payload: {
        postId: input.postId,
        authorParticipantId: input.authorParticipantId,
        submittedByParticipantId: input.actorParticipantId,
      },
    }),
  );
}

export async function emitBlogPostChangesRequested(input: {
  postId: string;
  authorParticipantId: string;
  reviewedByParticipantId: string;
}): Promise<void> {
  await enqueueDomainEvent(
    createDomainEvent({
      eventName: CATALOGUE_EVENTS.blogPostChangesRequested,
      aggregateType: "BlogPost",
      aggregateId: input.postId,
      actorId: input.reviewedByParticipantId,
      payload: {
        postId: input.postId,
        authorParticipantId: input.authorParticipantId,
        reviewedByParticipantId: input.reviewedByParticipantId,
      },
    }),
  );
}

export async function emitBlogPostPublished(input: {
  postId: string;
  authorParticipantId: string;
  publishedByParticipantId: string;
  publishedVersion: number;
  slug: string;
  afterSafetyReview?: boolean;
  safetyOutcome?: string | null;
  reviewNote?: string;
}): Promise<void> {
  if (process.env.NODE_TEST_ENV === "true") {
    blogPublishEmitCount += 1;
  }
  if (skipBlogEventsWithoutMongoInTests()) {
    return;
  }
  await enqueueDomainEvent(
    createDomainEvent({
      eventName: CATALOGUE_EVENTS.blogPostPublished,
      aggregateType: "BlogPost",
      aggregateId: input.postId,
      actorId: input.publishedByParticipantId,
      payload: {
        postId: input.postId,
        authorParticipantId: input.authorParticipantId,
        publishedByParticipantId: input.publishedByParticipantId,
        publishedVersion: input.publishedVersion,
        slug: input.slug,
        afterSafetyReview: input.afterSafetyReview ?? false,
        safetyOutcome: input.safetyOutcome ?? null,
        reviewNote: input.reviewNote,
      },
    }),
  );
}

export async function emitBlogPostEditoriallyDeclined(input: {
  postId: string;
  authorParticipantId: string;
  reviewedByParticipantId: string;
}): Promise<void> {
  await enqueueDomainEvent(
    createDomainEvent({
      eventName: CATALOGUE_EVENTS.blogPostEditoriallyDeclined,
      aggregateType: "BlogPost",
      aggregateId: input.postId,
      actorId: input.reviewedByParticipantId,
      payload: {
        postId: input.postId,
        authorParticipantId: input.authorParticipantId,
        reviewedByParticipantId: input.reviewedByParticipantId,
      },
    }),
  );
}

export async function emitBlogPostArchived(input: {
  postId: string;
  authorParticipantId: string;
  archivedByParticipantId: string;
}): Promise<void> {
  await enqueueDomainEvent(
    createDomainEvent({
      eventName: CATALOGUE_EVENTS.blogPostArchived,
      aggregateType: "BlogPost",
      aggregateId: input.postId,
      actorId: input.archivedByParticipantId,
      payload: {
        postId: input.postId,
        authorParticipantId: input.authorParticipantId,
        archivedByParticipantId: input.archivedByParticipantId,
      },
    }),
  );
}

export async function emitBlogAuthorCapabilityGranted(input: {
  participantId: string;
  capabilities: readonly string[];
  grantedByParticipantId: string;
}): Promise<void> {
  await enqueueDomainEvent(
    createDomainEvent({
      eventName: CATALOGUE_EVENTS.blogAuthorCapabilityGranted,
      aggregateType: "BlogCapabilityGrant",
      aggregateId: input.participantId,
      actorId: input.grantedByParticipantId,
      payload: {
        participantId: input.participantId,
        capabilities: [...input.capabilities],
        grantedByParticipantId: input.grantedByParticipantId,
      },
    }),
  );
}
