import type { DecisionSession } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getCurrentPublishedVersion } from "../initiative-version-revision/initiative-version-revision.store.js";
import {
  assertDecisionSessionEligible,
  assessDecisionSessionEligibility,
} from "./decision-session-eligibility.js";
import { buildDecisionSessionPackageReferences } from "./decision-session-package.js";
import {
  createSession,
  getSessionById,
  listSessionsByInitiative,
  listSessionsBySteward,
  updateSession,
} from "./decision-session.store.js";
import {
  type CreateDecisionSessionDraftInput,
  type SaveDecisionSessionDraftInput,
  validateDecisionSessionForPublication,
} from "./decision-session.validators.js";

function getOwnedSession(sessionId: string, identity: RequestIdentity): DecisionSession {
  const session = getSessionById(sessionId);

  if (!session) {
    throw new Error("Decision session not found.");
  }

  if (session.stewardId !== identity.participantId) {
    throw new Error("You do not have access to this decision session.");
  }

  return session;
}

function assertDraftStatus(session: DecisionSession): void {
  if (session.status !== "draft") {
    throw new Error("Only draft decision sessions can be edited or published from this workflow.");
  }
}

function assertPublishedStatus(session: DecisionSession): void {
  if (session.status !== "published") {
    throw new Error("Only published decision sessions can be closed.");
  }
}

function assertArchivableStatus(session: DecisionSession): void {
  if (session.status === "archived") {
    throw new Error("Decision session is already archived.");
  }
}

export function getDecisionSessionEligibility(initiativeId: string) {
  return assessDecisionSessionEligibility(initiativeId);
}

export function listMyDecisionSessions(identity: RequestIdentity): DecisionSession[] {
  return listSessionsBySteward(identity.participantId);
}

export function listMyDecisionSessionsForInitiative(
  identity: RequestIdentity,
  initiativeId: string,
): DecisionSession[] {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return listSessionsByInitiative(initiativeId).filter(
    (session) => session.stewardId === identity.participantId,
  );
}

export function getMyDecisionSession(
  identity: RequestIdentity,
  sessionId: string,
): DecisionSession {
  return getOwnedSession(sessionId, identity);
}

export function createDecisionSessionDraft(
  identity: RequestIdentity,
  input: CreateDecisionSessionDraftInput,
): DecisionSession {
  const { initiativeVersion } = assertDecisionSessionEligible(input.initiativeId);
  const initiative = getInitiativeById(input.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  if (Date.parse(input.closesAt) <= Date.parse(input.opensAt)) {
    throw new Error("Closing date must be after opening date.");
  }

  const now = new Date().toISOString();

  const session: DecisionSession = {
    sessionId: `decision-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    initiativeId: input.initiativeId,
    initiativeVersion,
    stewardId: identity.participantId,
    title: input.title,
    purpose: input.purpose,
    decisionQuestion: input.decisionQuestion,
    status: "draft",
    opensAt: input.opensAt,
    closesAt: input.closesAt,
    createdAt: now,
    updatedAt: now,
  };

  return createSession(session);
}

export function saveDecisionSessionDraft(
  identity: RequestIdentity,
  sessionId: string,
  input: SaveDecisionSessionDraftInput,
): DecisionSession {
  const session = getOwnedSession(sessionId, identity);

  assertDraftStatus(session);

  const opensAt = input.opensAt ?? session.opensAt;
  const closesAt = input.closesAt ?? session.closesAt;

  if (Date.parse(closesAt) <= Date.parse(opensAt)) {
    throw new Error("Closing date must be after opening date.");
  }

  const updated = updateSession(sessionId, input);

  if (!updated) {
    throw new Error("Decision session not found.");
  }

  return updated;
}

export function publishDecisionSession(
  identity: RequestIdentity,
  sessionId: string,
): DecisionSession {
  const session = getOwnedSession(sessionId, identity);

  assertDraftStatus(session);
  validateDecisionSessionForPublication(session);

  assertDecisionSessionEligible(session.initiativeId);

  const publishedAt = new Date().toISOString();
  const packageReferences = buildDecisionSessionPackageReferences(session.initiativeId);

  const updated = updateSession(sessionId, {
    status: "published",
    publishedAt,
    initiativeVersion: getCurrentPublishedVersion(session.initiativeId),
    packageReferences,
  });

  if (!updated) {
    throw new Error("Decision session not found.");
  }

  return updated;
}

export function closeDecisionSession(
  identity: RequestIdentity,
  sessionId: string,
): DecisionSession {
  const session = getOwnedSession(sessionId, identity);

  assertPublishedStatus(session);

  const updated = updateSession(sessionId, {
    status: "closed",
    closedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Decision session not found.");
  }

  return updated;
}

export function archiveDecisionSession(
  identity: RequestIdentity,
  sessionId: string,
): DecisionSession {
  const session = getOwnedSession(sessionId, identity);

  assertArchivableStatus(session);

  const updated = updateSession(sessionId, {
    status: "archived",
  });

  if (!updated) {
    throw new Error("Decision session not found.");
  }

  return updated;
}
