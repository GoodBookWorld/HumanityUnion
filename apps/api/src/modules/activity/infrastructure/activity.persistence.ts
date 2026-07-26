import type { Document } from "mongodb";

import type { ActivityDetailDto, ActivityRecord } from "../domain/activity.types.js";

export interface ActivityMongoDocument extends Document {
  activityId: string;
  creatorMemberId: string;
  title: string;
  description: string;
  activityType: ActivityRecord["activityType"];
  visibility: ActivityRecord["visibility"];
  status: ActivityRecord["status"];
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export function toActivityMongoDocument(record: ActivityRecord): ActivityMongoDocument {
  return {
    activityId: record.activityId,
    creatorMemberId: record.creatorMemberId,
    title: record.title,
    description: record.description,
    activityType: record.activityType,
    visibility: record.visibility,
    status: record.status,
    aggregateVersion: record.aggregateVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function fromActivityMongoDocument(document: ActivityMongoDocument): ActivityRecord {
  return {
    activityId: document.activityId,
    creatorMemberId: document.creatorMemberId,
    title: document.title,
    description: document.description,
    activityType: document.activityType,
    visibility: document.visibility,
    status: document.status,
    aggregateVersion: document.aggregateVersion,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function toActivityDetailDto(record: ActivityRecord): ActivityDetailDto {
  return {
    activityId: record.activityId,
    creatorMemberId: record.creatorMemberId,
    title: record.title,
    description: record.description,
    activityType: record.activityType,
    visibility: record.visibility,
    status: record.status,
    aggregateVersion: record.aggregateVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
