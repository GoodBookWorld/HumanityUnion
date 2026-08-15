import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../infrastructure/events/event-envelope.js";
import { enqueueDomainEvent } from "../../infrastructure/outbox/outbox.repository.js";

export async function emitBlogPostSubmittedForReview(input: {
  postId: string;
  authorParticipantId: string;
  actorParticipantId: string;
}): Promise<void> {
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
