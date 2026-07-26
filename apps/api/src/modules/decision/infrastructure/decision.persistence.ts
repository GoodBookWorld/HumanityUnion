import type { Document } from "mongodb";

import type { ActivityVisibility } from "../../activity/domain/activity.types.js";
import type { DecisionDetailDto, DecisionRecord, DecisionStatus } from "../domain/decision.types.js";

export interface DecisionMongoDocument extends Document {
  decisionId: string;
  proposalId: string;
  activityId: string;
  creatorMemberId: string;
  title: string;
  status: DecisionStatus;
  visibility: ActivityVisibility;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export function toDecisionMongoDocument(record: DecisionRecord): DecisionMongoDocument {
  return {
    decisionId: record.decisionId,
    proposalId: record.proposalId,
    activityId: record.activityId,
    creatorMemberId: record.creatorMemberId,
    title: record.title,
    status: record.status,
    visibility: record.visibility,
    aggregateVersion: record.aggregateVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function fromDecisionMongoDocument(document: DecisionMongoDocument): DecisionRecord {
  return {
    decisionId: document.decisionId,
    proposalId: document.proposalId,
    activityId: document.activityId,
    creatorMemberId: document.creatorMemberId,
    title: document.title,
    status: document.status,
    visibility: document.visibility,
    aggregateVersion: document.aggregateVersion,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function toDecisionDetailDto(record: DecisionRecord): DecisionDetailDto {
  return {
    decisionId: record.decisionId,
    proposalId: record.proposalId,
    activityId: record.activityId,
    creatorMemberId: record.creatorMemberId,
    title: record.title,
    status: record.status,
    visibility: record.visibility,
    aggregateVersion: record.aggregateVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
