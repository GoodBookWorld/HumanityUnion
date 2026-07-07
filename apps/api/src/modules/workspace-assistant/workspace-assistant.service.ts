import type { WorkspaceAssistantContextSnapshot } from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";

import { generateWorkspaceAssistantResponse } from "./workspace-assistant-safety-guard.js";

export interface WorkspaceAssistantRouteBody {
  participantId?: string;
  initiativeId: string;
  currentSection: string;
  requestedAction: {
    capability: string;
    label: string;
  };
  userPrompt?: string;
  contextSnapshot: WorkspaceAssistantContextSnapshot;
  timestamp: string;
}

export function respondToWorkspaceAssistant(
  identity: RequestIdentity,
  body: WorkspaceAssistantRouteBody,
) {
  if (body.participantId && body.participantId !== identity.participantId) {
    throw new Error("participantId cannot be supplied by the client.");
  }

  const initiative = getInitiativeById(body.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return generateWorkspaceAssistantResponse({
    participantId: identity.participantId,
    initiativeId: body.initiativeId,
    currentSection: body.currentSection,
    requestedAction: body.requestedAction,
    userPrompt: body.userPrompt,
    contextSnapshot: body.contextSnapshot,
    timestamp: body.timestamp,
  });
}
