import type { DecisionSession, DecisionSessionEligibility, DirectInitiativeAncestry, Initiative } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getCurrentPublishedVersion } from "../initiative-version-revision/initiative-version-revision.store.js";
import { validateDirectInitiativeAncestry } from "../../shared/initiative-ancestry/index.js";
import {
  assertDecisionSessionEligible,
  assessDecisionSessionEligibility,
  assessDecisionSessionEligibilityForInitiative,
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
import { getPetitionByInitiativeId } from "../petition/petition.store.js";

/**
 * Initiative Ancestry — Recovery Task 08.
 *
 * `CreateDecisionSessionDraftInput` carries a direct, independent
 * `initiativeId` (unlike Initiative Improvement Proposal, whose
 * `initiativeId` is derived from a mandatory Analysis reference — Recovery
 * Task 07). `DecisionSession` itself stores this `initiativeId` directly
 * (see `@hu/types` `DecisionSession`). Decision Session creation does not
 * accept or store any independent Improvement Proposal, Collaborative
 * Analysis, or other upstream-artifact identifier: eligibility is instead an
 * aggregate, Initiative-scoped business rule (at least one *published*
 * Collaborative Analysis and one *steward-reviewed* Improvement Proposal
 * must exist for the Initiative — see `decision-session-eligibility.ts`).
 * Because both artifact lists are looked up by the same, already-validated
 * `initiativeId`, cross-artifact Initiative consistency is guaranteed
 * structurally: there is no independently supplied Analysis/Proposal
 * identifier that a caller could use to reference an artifact belonging to
 * a different Initiative. Consequently:
 *
 * - Ancestry is DIRECT (`validateDirectInitiativeAncestry`), not transitive.
 *   `validateTransitiveInitiativeAncestry` does not apply to this module's
 *   actual contract and is not used here.
 * - There is no "Improvement Proposal validation" or "multiple upstream
 *   artifact consistency" boundary to add beyond the existing,
 *   Initiative-scoped eligibility rule, which this task leaves behaviorally
 *   unchanged.
 *
 * As of this task, `createDecisionSessionDraft` — not the Express route — is
 * the enforcement boundary: it validates that the Initiative exists (via the
 * shared `validateDirectInitiativeAncestry`) before applying the
 * module-specific eligibility rule and before any persistence is attempted.
 * The resolved Initiative is reused for both the eligibility check and the
 * ownership check, so a successful creation performs exactly one Initiative
 * lookup (previously two: one inside `assertDecisionSessionEligible` and a
 * second, redundant `getInitiativeById` call in this function).
 *
 * Decision Session does not own the Initiative lifecycle, Improvement
 * Proposal content lifecycle, Collective Decision aggregate, implementation,
 * or public impact. Persistence is unchanged: sessions continue to store a
 * plain `initiativeId` string, not a nested ancestry object.
 */
export interface DecisionSessionAncestryDependencies {
  readonly getInitiative: (initiativeId: string) => Initiative | null;
  readonly assessEligibility: (initiative: Initiative) => Promise<DecisionSessionEligibility>;
}

const defaultDecisionSessionAncestryDependencies: DecisionSessionAncestryDependencies = {
  getInitiative: getInitiativeById,
  assessEligibility: assessDecisionSessionEligibilityForInitiative,
};

async function assertEligibleInitiativeAncestry(
  initiativeId: string,
  deps: DecisionSessionAncestryDependencies,
): Promise<{
  ancestry: DirectInitiativeAncestry;
  initiative: Initiative;
  initiativeVersion: number;
}> {
  const resolvedInitiativeBox: { value: Initiative | null } = { value: null };

  // Enforcement boundary: confirms the Initiative exists and is well-formed
  // before any persistence, regardless of caller.
  const ancestry = await validateDirectInitiativeAncestry(
    { initiativeId },
    {
      initiativeExists(id) {
        resolvedInitiativeBox.value = deps.getInitiative(id);
        return resolvedInitiativeBox.value !== null;
      },
    },
  );

  const initiative = resolvedInitiativeBox.value;

  if (!initiative) {
    // Unreachable: validateDirectInitiativeAncestry only resolves once
    // initiativeExists() returned true, which only happens when
    // resolvedInitiativeBox.value was set to a non-null Initiative.
    throw new Error("Initiative not found.");
  }

  // Module-specific eligibility rule, reusing the already-resolved
  // Initiative so no second lookup is performed.
  const eligibility = await deps.assessEligibility(initiative);

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons[0] ?? "Initiative is not eligible for a decision session.");
  }

  return { ancestry, initiative, initiativeVersion: eligibility.initiativeVersion };
}

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

export async function getDecisionSessionEligibility(
  initiativeId: string,
): Promise<DecisionSessionEligibility> {
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

export async function createDecisionSessionDraft(
  identity: RequestIdentity,
  input: CreateDecisionSessionDraftInput,
  deps: DecisionSessionAncestryDependencies = defaultDecisionSessionAncestryDependencies,
): Promise<DecisionSession> {
  const { ancestry, initiative, initiativeVersion } = await assertEligibleInitiativeAncestry(
    input.initiativeId,
    deps,
  );

  assertInitiativeOwnership(initiative, identity);

  if (Date.parse(input.closesAt) <= Date.parse(input.opensAt)) {
    throw new Error("Closing date must be after opening date.");
  }

  const now = new Date().toISOString();

  const session: DecisionSession = {
    sessionId: `decision-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    // Persisted initiativeId is sourced from the validated ancestry result,
    // not directly from the unchecked input.
    initiativeId: ancestry.initiativeId,
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

export async function publishDecisionSession(
  identity: RequestIdentity,
  sessionId: string,
): Promise<DecisionSession> {
  const session = getOwnedSession(sessionId, identity);

  assertDraftStatus(session);
  validateDecisionSessionForPublication(session);

  await assertDecisionSessionEligible(session.initiativeId);

  const publishedAt = new Date().toISOString();
  // Initiative Lifecycle — Part F, Section 11: the Published Petition this
  // session's decision is built on top of, frozen into the same
  // reference-only package as Revisions/Analyses/Proposals.
  const publishedPetition = await getPetitionByInitiativeId(session.initiativeId);
  const packageReferences = {
    ...buildDecisionSessionPackageReferences(session.initiativeId),
    petitionId: publishedPetition?.petitionId ?? null,
  };

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
