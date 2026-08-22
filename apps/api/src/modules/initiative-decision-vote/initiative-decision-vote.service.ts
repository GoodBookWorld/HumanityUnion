import type {
  Initiative,
  InitiativeCollectiveDecision,
  InitiativeDecisionVote,
  InitiativeDecisionVoteChoiceExtended,
  TransitiveInitiativeAncestry,
} from "@hu/types";
import {
  resolveInitiativeLifecycleProfile,
  resolvePublicChoiceBallotMode,
  validateVotePayloadForBallotMode,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getMemberById } from "../member/member-access.js";
import { evaluateStoredDecisionParticipationEligibility } from "../participation-eligibility/participation-eligibility.service.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import {
  InitiativeAncestryMissingError,
  ParentArtifactNotFoundError,
  validateTransitiveInitiativeAncestry,
  type InitiativeExistenceChecker,
  type ParentArtifactInitiativeResolver,
} from "../../shared/initiative-ancestry/index.js";
import {
  castOrChangeInitiativeDecisionVote,
  getActiveVoteForParticipant,
  getActiveVoteForVisitor,
  recallInitiativeDecisionVoteForVoter,
} from "./initiative-decision-vote.store.js";
import { listEffectiveVotesForDecision } from "./list-effective-decision-votes.js";
import { assertCandidateBelongsToInitiative } from "../public-choice-candidate/public-choice-candidate.service.js";
import { listPublicChoiceCandidatesByInitiative } from "../public-choice-candidate/persistence/public-choice-candidate.repository.js";
import { buildBallotAggregates } from "./initiative-decision-vote-ballot-aggregates.js";
import { assertVotePayloadMatchesBallotMode } from "./initiative-decision-vote.validators.js";
import {
  resolveAuthenticatedPublicChoiceVoterCategory,
  visitorPublicChoiceVoterCategory,
} from "./resolve-public-choice-voter-category.js";

export { listEffectiveVotesForDecision } from "./list-effective-decision-votes.js";

export interface CastOrUpdateInitiativeDecisionVoteInput {
  choice: InitiativeDecisionVoteChoiceExtended;
  candidateId?: string;
}

/**
 * Initiative Ancestry — Recovery Task 12 (supersedes Task 10's module-local
 * approach; see git history for that prior implementation).
 *
 * Domain classification (unchanged since Task 10): `InitiativeDecisionVote`
 * has NO `initiativeId` field, and `CastOrUpdateInitiativeDecisionVoteInput`
 * carries only a `choice`. Vote remains **Model C — a participation
 * record**, not an independent civic aggregate root, not a member of
 * `CivicArtifactType`, and not independently Initiative-addressable. Its
 * canonical Initiative ancestry is derived entirely through its parent
 * Collective Decision, and the persisted shape correctly omits
 * `initiativeId`.
 *
 * Ancestry mechanism (Task 12): Recovery Task 11 pinned the executable
 * meaning of `CivicArtifactType`'s `"decision"` member to
 * `initiative-collective-decision` ONLY — explicitly excluding the legacy
 * Activity-scoped `decision` module — via
 * `CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE.decision` in
 * `packages/types/src/domain/initiative-ancestry.ts`. This module is the
 * **first production consumer** of `validateTransitiveInitiativeAncestry`:
 * `resolveVoteInitiativeAncestry` now calls it with
 * `{ parentArtifactType: "decision", parentArtifactId: decisionId }`,
 * using a Vote-local `ParentArtifactInitiativeResolver`
 * (`createVoteParentDecisionResolver`) that resolves exclusively through
 * `initiative-collective-decision.store.js` and imports nothing from
 * `apps/api/src/modules/decision`. If the shared validator is ever invoked
 * with a `parentArtifactType` other than `"decision"`, this resolver fails
 * explicitly (`{ found: false }`) rather than silently resolving another
 * module — unreachable in production, since this module always supplies
 * the literal `"decision"`.
 *
 * Single resolution (Part 5): both the parent resolver and the Initiative
 * existence checker capture their resolved object into a box on first call,
 * so the Collective Decision and Initiative are each looked up exactly
 * once per cast, and reused afterward by `assertDecisionAcceptsVotes` /
 * `evaluateVoteEligibility` — Decision Session is still never looked up
 * (unchanged since Task 10, since Collective Decision's own fields are
 * sufficient for voting eligibility).
 *
 * Error-message compatibility (Part 7): two of the shared validator's
 * failure modes — `ParentArtifactNotFoundError` (decision id resolves to no
 * record) and `InitiativeAncestryMissingError` (no decision id supplied at
 * all) — both mean "the Collective Decision could not be identified," which
 * this module has always surfaced as the plain, widely-conventional
 * `"Collective decision not found."` message used throughout the API (see
 * `initiative-collective-decision.service.ts`,
 * `civic-action-package.service.ts`, etc.). `resolveVoteInitiativeAncestry`
 * translates both back to that exact message so the existing route's
 * "not found" -> 404 substring heuristic and response body remain
 * unchanged, without any route-file changes. `InitiativeIdMalformedError`
 * and `InitiativeNotFoundError` are unchanged in type and message from
 * Task 10 (both already handled by the route's explicit `instanceof`
 * mappings). `ParentArtifactMissingInitiativeAncestryError` (an empty
 * `decision.initiativeId`) is new and left untranslated — it is more
 * architecturally accurate than Task 10's `InitiativeAncestryMissingError`
 * for this exact case, remains an HTTP 400 via the route's existing
 * default, and is unreachable for any Collective Decision created through
 * the real service (Task 09 validates Initiative ancestry at creation).
 */
export interface InitiativeDecisionVoteAncestryDependencies {
  readonly getDecision: (decisionId: string) => InitiativeCollectiveDecision | null;
  readonly getInitiative: (initiativeId: string) => Initiative | null;
}

const defaultInitiativeDecisionVoteAncestryDependencies: InitiativeDecisionVoteAncestryDependencies =
  {
    getDecision: getDecisionById,
    getInitiative: getInitiativeById,
  };

/**
 * Production `ParentArtifactInitiativeResolver` for Vote's sole supported
 * transitive parent type, canonical `"decision"`
 * (= `initiative-collective-decision`, per Recovery Task 11). Captures the
 * resolved Collective Decision into `resolvedDecisionBox` so the caller can
 * reuse it after ancestry succeeds instead of looking it up again.
 *
 * Exported so its "fail explicitly for any non-decision parent type" and
 * single-resolution capture behavior can be tested directly, since
 * `resolveVoteInitiativeAncestry` always supplies the literal `"decision"`
 * and can never exercise those branches itself.
 */
export function createVoteParentDecisionResolver(
  getDecision: InitiativeDecisionVoteAncestryDependencies["getDecision"],
  resolvedDecisionBox: { value: InitiativeCollectiveDecision | null },
): ParentArtifactInitiativeResolver {
  return {
    resolveParentInitiativeId(parentArtifactType, parentArtifactId) {
      if (parentArtifactType !== "decision") {
        // Fail explicitly instead of silently resolving another module.
        // Unreachable in production: this adapter is only ever invoked
        // (below) with the literal "decision" parent type.
        return { found: false };
      }

      const decision = getDecision(parentArtifactId);
      resolvedDecisionBox.value = decision;

      return decision ? { found: true, initiativeId: decision.initiativeId } : { found: false };
    },
  };
}

/**
 * Production `InitiativeExistenceChecker` for Vote. Captures the resolved
 * Initiative into `resolvedInitiativeBox` so voter eligibility can reuse it
 * afterward instead of calling `getInitiativeById` again.
 *
 * Exported for the same direct-testability reason as
 * {@link createVoteParentDecisionResolver}.
 */
export function createVoteInitiativeExistenceChecker(
  getInitiative: InitiativeDecisionVoteAncestryDependencies["getInitiative"],
  resolvedInitiativeBox: { value: Initiative | null },
): InitiativeExistenceChecker {
  return {
    initiativeExists(initiativeId) {
      const initiative = getInitiative(initiativeId);
      resolvedInitiativeBox.value = initiative;
      return initiative !== null;
    },
  };
}

/**
 * Exported (in addition to being used internally by
 * `castOrUpdateInitiativeDecisionVote`) so ancestry enforcement can be
 * tested in isolation, without requiring the real, MongoDB-backed Member
 * lookup that the rest of vote casting (`evaluateVoteEligibility`) depends
 * on and that this task does not bring under dependency injection.
 */
export async function resolveVoteInitiativeAncestry(
  decisionId: string,
  deps: InitiativeDecisionVoteAncestryDependencies,
): Promise<{
  decision: InitiativeCollectiveDecision;
  initiative: Initiative;
  ancestry: TransitiveInitiativeAncestry;
}> {
  const resolvedDecisionBox: { value: InitiativeCollectiveDecision | null } = { value: null };
  const resolvedInitiativeBox: { value: Initiative | null } = { value: null };

  let ancestry: TransitiveInitiativeAncestry;

  try {
    ancestry = await validateTransitiveInitiativeAncestry(
      { parentArtifactType: "decision", parentArtifactId: decisionId },
      {
        ...createVoteParentDecisionResolver(deps.getDecision, resolvedDecisionBox),
        ...createVoteInitiativeExistenceChecker(deps.getInitiative, resolvedInitiativeBox),
      },
    );
  } catch (error) {
    if (
      error instanceof ParentArtifactNotFoundError ||
      error instanceof InitiativeAncestryMissingError
    ) {
      throw new Error("Collective decision not found.");
    }

    throw error;
  }

  const decision = resolvedDecisionBox.value;
  const initiative = resolvedInitiativeBox.value;

  if (!decision) {
    // Unreachable: the resolver only reports found:true after storing a
    // non-null decision in the box.
    throw new Error("Collective decision not found.");
  }

  if (!initiative) {
    // Unreachable in practice (see module doc comment above); defensive
    // guard only, matching the pattern used by Tasks 08-10.
    throw new Error("Initiative not found.");
  }

  return { decision, initiative, ancestry };
}

function assertDecisionAcceptsVotes(decision: InitiativeCollectiveDecision): void {
  if (decision.status !== "opened") {
    throw new Error("Collective decision is not open for voting.");
  }

  const now = Date.parse(new Date().toISOString());

  if (!decision.openedAt || Date.parse(decision.openedAt) > now) {
    throw new Error("Collective decision voting window is not open yet.");
  }

  if (Date.parse(decision.closesAt) < now) {
    throw new Error("Collective decision voting window has closed.");
  }
}

async function evaluateVoteEligibility(
  decision: InitiativeCollectiveDecision,
  initiative: Initiative,
  identity: RequestIdentity,
) {
  const member = await getMemberById(identity.participantId);

  return evaluateStoredDecisionParticipationEligibility({
    participantId: identity.participantId,
    isRegistered: member !== null,
    participantStatus: member?.status ?? "unregistered",
    decisionParticipationScope: decision.participationScope,
    initiativeCommunitySlug: initiative.metadata.communitySlug,
    decisionStatus: decision.status,
    openedAt: decision.openedAt,
    closesAt: decision.closesAt,
    currentTime: new Date().toISOString(),
    priorVoteExists: false,
  });
}

/**
 * Fix 07A — PUBLIC_CHOICE candidate Select/Recall does NOT require Participation Area.
 * STANDARD ternary voting still uses evaluateVoteEligibility (area required).
 */
async function assertPublicChoiceAuthenticatedVoter(participantId: string): Promise<{
  transparencyCohort: "verified" | "unverified";
}> {
  const member = await getMemberById(participantId);
  if (member && member.status !== "active") {
    throw new Error("Participant must be active to participate in collective decisions.");
  }

  return { transparencyCohort: "unverified" };
}

/**
 * Pack 02B — PUBLIC_CHOICE and STANDARD share durable Mongo Decision Vote.
 * VISITOR_TO_PARTICIPANT_VOTE_RECONCILIATION_GAP=YES — identities never auto-merged.
 */
export async function castOrUpdateInitiativeDecisionVote(
  identity: RequestIdentity,
  decisionId: string,
  input: CastOrUpdateInitiativeDecisionVoteInput,
  deps: InitiativeDecisionVoteAncestryDependencies = defaultInitiativeDecisionVoteAncestryDependencies,
): Promise<InitiativeDecisionVote> {
  const { decision, initiative } = await resolveVoteInitiativeAncestry(decisionId, deps);
  assertDecisionAcceptsVotes(decision);

  const lifecycle = resolveInitiativeLifecycleProfile(initiative.lifecycleProfile);
  if (lifecycle === "PUBLIC_CHOICE") {
    return castPublicChoiceParticipantVote({
      decision,
      initiative,
      participantId: identity.participantId,
      choice: input.choice,
      candidateId: input.candidateId,
    });
  }

  if (input.choice === "candidate" || input.candidateId) {
    throw new Error("Candidate ballots are only valid for PUBLIC_CHOICE.");
  }

  const eligibility = await evaluateVoteEligibility(decision, initiative, identity);

  if (!eligibility.eligible) {
    throw new Error(eligibility.explanation);
  }

  return castOrChangeInitiativeDecisionVote({
    decisionId,
    participantId: identity.participantId,
    initiativeId: initiative.initiativeId,
    choice: input.choice,
    transparencyCohort: eligibility.transparencyCohort,
  });
}

async function castPublicChoiceParticipantVote(args: {
  decision: InitiativeCollectiveDecision;
  initiative: Initiative;
  participantId: string;
  choice: InitiativeDecisionVoteChoiceExtended;
  candidateId?: string;
}): Promise<InitiativeDecisionVote> {
  const ballotMode = resolvePublicChoiceBallotMode(args.initiative.metadata.ballotMode);
  assertVotePayloadMatchesBallotMode(ballotMode, {
    choice: args.choice,
    candidateId: args.candidateId,
  });

  if (ballotMode === "SELECT_ONE_CANDIDATE" && args.choice === "candidate" && args.candidateId) {
    await assertCandidateBelongsToInitiative(args.initiative.initiativeId, args.candidateId);
  }

  const { transparencyCohort } = await assertPublicChoiceAuthenticatedVoter(args.participantId);

  return castOrChangeInitiativeDecisionVote({
    decisionId: args.decision.decisionId,
    initiativeId: args.initiative.initiativeId,
    participantId: args.participantId,
    choice: args.choice,
    candidateId: args.candidateId,
    voterCategory: await resolveAuthenticatedPublicChoiceVoterCategory(args.participantId),
    transparencyCohort,
  });
}

export async function castOrUpdateVisitorInitiativeDecisionVote(
  visitorKey: string,
  decisionId: string,
  input: CastOrUpdateInitiativeDecisionVoteInput,
  deps: InitiativeDecisionVoteAncestryDependencies = defaultInitiativeDecisionVoteAncestryDependencies,
): Promise<InitiativeDecisionVote> {
  const key = visitorKey.trim();
  if (!key || key.length < 8 || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error("Malformed visitor identity.");
  }

  const { decision, initiative } = await resolveVoteInitiativeAncestry(decisionId, deps);
  assertDecisionAcceptsVotes(decision);

  const lifecycle = resolveInitiativeLifecycleProfile(initiative.lifecycleProfile);
  if (lifecycle !== "PUBLIC_CHOICE") {
    throw new Error("Visitor voting is only available for PUBLIC_CHOICE.");
  }

  const ballotMode = resolvePublicChoiceBallotMode(initiative.metadata.ballotMode);
  assertVotePayloadMatchesBallotMode(ballotMode, {
    choice: input.choice,
    candidateId: input.candidateId,
  });

  if (ballotMode === "SELECT_ONE_CANDIDATE" && input.choice === "candidate" && input.candidateId) {
    await assertCandidateBelongsToInitiative(initiative.initiativeId, input.candidateId);
  }

  return castOrChangeInitiativeDecisionVote({
    decisionId: decision.decisionId,
    initiativeId: initiative.initiativeId,
    visitorKey: key,
    choice: input.choice,
    candidateId: input.candidateId,
    voterCategory: visitorPublicChoiceVoterCategory(),
    transparencyCohort: "unverified",
  });
}

export async function getMyInitiativeDecisionVote(
  identity: RequestIdentity,
  decisionId: string,
): Promise<InitiativeDecisionVote | null> {
  const decision = getDecisionById(decisionId);

  if (!decision) {
    throw new Error("Collective decision not found.");
  }

  return getActiveVoteForParticipant(decisionId, identity.participantId);
}

export async function getVisitorInitiativeDecisionVote(
  visitorKey: string,
  decisionId: string,
): Promise<InitiativeDecisionVote | null> {
  const decision = getDecisionById(decisionId);
  if (!decision) {
    throw new Error("Collective decision not found.");
  }
  return getActiveVoteForVisitor(decisionId, visitorKey.trim());
}

/** Pack 04 — Recall current effective vote (participant or visitor). */
export async function recallInitiativeDecisionVote(
  identity: RequestIdentity,
  decisionId: string,
  deps: InitiativeDecisionVoteAncestryDependencies = defaultInitiativeDecisionVoteAncestryDependencies,
): Promise<void> {
  const { decision } = await resolveVoteInitiativeAncestry(decisionId, deps);
  assertDecisionAcceptsVotes(decision);

  const removed = await recallInitiativeDecisionVoteForVoter({
    decisionId,
    participantId: identity.participantId,
  });
  if (!removed) {
    throw new Error("No vote to recall.");
  }
}

export async function recallVisitorInitiativeDecisionVote(
  visitorKey: string,
  decisionId: string,
  deps: InitiativeDecisionVoteAncestryDependencies = defaultInitiativeDecisionVoteAncestryDependencies,
): Promise<void> {
  const key = visitorKey.trim();
  if (!key || key.length < 8 || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error("Malformed visitor identity.");
  }

  const { decision, initiative } = await resolveVoteInitiativeAncestry(decisionId, deps);
  assertDecisionAcceptsVotes(decision);

  const lifecycle = resolveInitiativeLifecycleProfile(initiative.lifecycleProfile);
  if (lifecycle !== "PUBLIC_CHOICE") {
    throw new Error("Visitor voting is only available for PUBLIC_CHOICE.");
  }

  const removed = await recallInitiativeDecisionVoteForVoter({
    decisionId,
    visitorKey: key,
  });
  if (!removed) {
    throw new Error("No vote to recall.");
  }
}

/** Pack 02B — durable repository is the sole aggregation authority. */

export async function computePublicChoiceBallotAggregatesForDecision(
  decisionId: string,
  initiative: Initiative,
) {
  const votes = await listEffectiveVotesForDecision(decisionId);
  const ballotMode = resolvePublicChoiceBallotMode(initiative.metadata.ballotMode);
  const candidateIds =
    ballotMode === "SELECT_ONE_CANDIDATE"
      ? (await listPublicChoiceCandidatesByInitiative(initiative.initiativeId)).map(
          (c) => c.candidateId,
        )
      : [];
  return buildBallotAggregates({ ballotMode, votes, candidateIds });
}

// Re-export for callers that still import validate helpers from this module surface.
export { validateVotePayloadForBallotMode };
