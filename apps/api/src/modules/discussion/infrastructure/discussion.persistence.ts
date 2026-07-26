import type { Document } from "mongodb";

import type { ActivityVisibility } from "../../activity/domain/activity.types.js";
import type { DiscussionDetailDto, DiscussionRecord, DiscussionStatus } from "../domain/discussion.types.js";

export interface DiscussionMongoDocument extends Document {
  discussionId: string;
  activityId: string;
  creatorMemberId: string;
  title: string;
  openingMessage: string;
  status: DiscussionStatus;
  visibility: ActivityVisibility;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export function toDiscussionMongoDocument(record: DiscussionRecord): DiscussionMongoDocument {
  return {
    discussionId: record.discussionId,
    activityId: record.activityId,
    creatorMemberId: record.creatorMemberId,
    title: record.title,
    openingMessage: record.openingMessage,
    status: record.status,
    visibility: record.visibility,
    aggregateVersion: record.aggregateVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function fromDiscussionMongoDocument(document: DiscussionMongoDocument): DiscussionRecord {
  return {
    discussionId: document.discussionId,
    activityId: document.activityId,
    creatorMemberId: document.creatorMemberId,
    title: document.title,
    openingMessage: document.openingMessage,
    status: document.status,
    visibility: document.visibility,
    aggregateVersion: document.aggregateVersion,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function toDiscussionDetailDto(record: DiscussionRecord): DiscussionDetailDto {
  return {
    discussionId: record.discussionId,
    activityId: record.activityId,
    creatorMemberId: record.creatorMemberId,
    title: record.title,
    openingMessage: record.openingMessage,
    status: record.status,
    visibility: record.visibility,
    aggregateVersion: record.aggregateVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
