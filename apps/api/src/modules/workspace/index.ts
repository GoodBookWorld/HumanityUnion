import { registerDomainEventHandler } from "../../infrastructure/integration/event-handler-registry.js";
import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import {
  handleActivityCreatedWorkspaceProjection,
  WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
} from "./application/activity-created.workspace-handler.js";
import {
  handleDiscussionCreatedWorkspaceProjection,
  WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID,
} from "./application/discussion-created.workspace-handler.js";
import {
  handleProposalCreatedWorkspaceProjection,
  WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID,
} from "./application/proposal-created.workspace-handler.js";
import {
  handleProposalSubmittedWorkspaceProjection,
  WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID,
} from "./application/proposal-submitted.workspace-handler.js";
import {
  handleDecisionOpenedWorkspaceProjection,
  WORKSPACE_DECISION_OPENED_CONSUMER_ID,
} from "./application/decision-opened.workspace-handler.js";
import {
  handleMemberRegisteredWorkspaceProjection,
  WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
} from "./application/member-registered.workspace-handler.js";

let workspaceHandlersRegistered = false;

export function resetWorkspaceProjectionHandlersForTests(): void {
  workspaceHandlersRegistered = false;
}

export function registerWorkspaceProjectionHandlers(): void {
  if (workspaceHandlersRegistered) {
    return;
  }

  registerDomainEventHandler({
    consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.memberRegistered,
    handle: handleMemberRegisteredWorkspaceProjection,
  });

  registerDomainEventHandler({
    consumerId: WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.activityCreated,
    handle: handleActivityCreatedWorkspaceProjection,
  });

  registerDomainEventHandler({
    consumerId: WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.discussionCreated,
    handle: handleDiscussionCreatedWorkspaceProjection,
  });

  registerDomainEventHandler({
    consumerId: WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.proposalCreated,
    handle: handleProposalCreatedWorkspaceProjection,
  });

  registerDomainEventHandler({
    consumerId: WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.proposalSubmitted,
    handle: handleProposalSubmittedWorkspaceProjection,
  });

  registerDomainEventHandler({
    consumerId: WORKSPACE_DECISION_OPENED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.decisionOpened,
    handle: handleDecisionOpenedWorkspaceProjection,
  });

  workspaceHandlersRegistered = true;
}

export { default as workspaceRouter } from "./api/workspace.routes.js";
export {
  getWorkspaceOverviewForMember,
  rebuildWorkspaceProjectionFromMemberRegistered,
} from "./application/workspace-query.service.js";
export {
  handleActivityCreatedWorkspaceProjection,
  validateActivityCreatedWorkspaceEnvelope,
  WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
} from "./application/activity-created.workspace-handler.js";
export {
  handleDiscussionCreatedWorkspaceProjection,
  validateDiscussionCreatedWorkspaceEnvelope,
  WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID,
} from "./application/discussion-created.workspace-handler.js";
export {
  handleProposalCreatedWorkspaceProjection,
  validateProposalCreatedWorkspaceEnvelope,
  WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID,
} from "./application/proposal-created.workspace-handler.js";
export {
  handleProposalSubmittedWorkspaceProjection,
  validateProposalSubmittedWorkspaceEnvelope,
  WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID,
} from "./application/proposal-submitted.workspace-handler.js";
export {
  handleDecisionOpenedWorkspaceProjection,
  validateDecisionOpenedWorkspaceEnvelope,
  WORKSPACE_DECISION_OPENED_CONSUMER_ID,
} from "./application/decision-opened.workspace-handler.js";
export {
  handleMemberRegisteredWorkspaceProjection,
  initializeWorkspaceFromMemberRegisteredEnvelope,
  validateMemberRegisteredWorkspaceEnvelope,
  WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
} from "./application/member-registered.workspace-handler.js";
export type {
  WorkspaceOverviewDto,
  WorkspaceParticipationSummary,
  WorkspaceProjectionRecord,
  WorkspaceProjectionStatus,
} from "./domain/workspace-projection.types.js";
export {
  applyActivityCreatedToWorkspaceProjection,
  applyDiscussionCreatedToWorkspaceProjection,
  applyProposalCreatedToWorkspaceProjection,
  applyProposalSubmittedToWorkspaceProjection,
  applyDecisionOpenedToWorkspaceProjection,
  deleteWorkspaceProjectionByMemberId,
  deleteWorkspaceProjectionsByMemberIdPrefix,
  findWorkspaceProjectionByMemberId,
  setForceWorkspaceActivityUpdateFailureForTests,
  setForceWorkspaceDiscussionUpdateFailureForTests,
  setForceWorkspaceProposalUpdateFailureForTests,
  setForceWorkspaceProposalSubmissionUpdateFailureForTests,
  setForceWorkspaceDecisionUpdateFailureForTests,
  setForceWorkspaceProjectionInsertFailureForTests,
} from "./infrastructure/workspace-projection.repository.js";
