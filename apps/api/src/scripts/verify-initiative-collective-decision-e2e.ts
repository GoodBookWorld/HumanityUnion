/**
 * TASK-026 — Initiative Collective Decision domain foundation verification.
 * Run: npm run verify:initiative-collective-decision
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { InitiativeCollectiveDecisionStatus } from "@hu/types";
import {
  canTransitionInitiativeCollectiveDecision,
  isInitiativeCollectiveDecisionTerminal,
} from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const participantA: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const participantB: RequestIdentity = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
};

const PRIVATE_FIELD_KEYS = ["authorId", "stewardId", "memberId", "email", "participantId"];

const VOTING_TERMS = [
  "ballot",
  "castVote",
  "collectVotes",
  "ParticipantVote",
  "voteStorage",
  "tally",
];

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn: () => unknown, message: string): void {
  try {
    fn();
    throw new Error(`Expected failure: ${message}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Expected failure:")) {
      throw error;
    }
  }
}

function assertNoPrivateFields(value: unknown, label: string): void {
  const serialized = JSON.stringify(value);

  for (const key of PRIVATE_FIELD_KEYS) {
    assert(!serialized.includes(`"${key}"`), `${label} leaked private field: ${key}`);
  }
}

function futureIsoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

interface EligibleCollectiveDecisionContext {
  initiativeId: string;
  decisionSessionId: string;
}

async function buildEligibleCollectiveDecisionContext(): Promise<EligibleCollectiveDecisionContext> {
  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { createInitiativeCollaborativeAnalysisDraft, publishInitiativeCollaborativeAnalysis } =
    await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js");
  const {
    createInitiativeImprovementProposalDraft,
    submitInitiativeImprovementProposal,
    decideInitiativeImprovementProposal,
  } =
    await import("../modules/initiative-improvement-proposal/initiative-improvement-proposal.service.js");
  const { createInitiativeRevisionDraft, saveInitiativeRevisionDraft, publishInitiativeRevision } =
    await import("../modules/initiative-version-revision/initiative-version-revision.service.js");
  const { createDecisionSessionDraft, publishDecisionSession, closeDecisionSession } =
    await import("../modules/decision-session/decision-session.service.js");

  const draft = createInitiativeDraft(participantA, {
    title: "E2E Collective Decision Initiative",
    description: "Initiative for collective decision verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });

  const projected = publishInitiative(participantA, draft.initiativeId);
  assert(projected.lifecyclePhase === "projected", "Initiative should be projected");

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(participantB, {
    initiativeId: projected.initiativeId,
    title: "E2E Collective Decision Analysis",
    summary: "Analysis supporting collective decision eligibility.",
    supportingEvidence: "Community input supports structured public decisions.",
    risks: "Timing coordination required.",
    suggestedImprovements: "Clarify decision scope.",
    references: "Participation records.",
  });

  const publishedAnalysis = publishInitiativeCollaborativeAnalysis(
    participantB,
    analysisDraft.analysisId,
  );

  const proposalDraft = createInitiativeImprovementProposalDraft(participantB, {
    analysisId: publishedAnalysis.analysisId,
    targetSection: "Description",
    currentIssue: "Decision scope unclear.",
    proposedChange: "Add explicit decision scope section.",
    rationale: "Improves informed public decisions.",
    expectedImprovement: "Clearer decision question framing.",
    references: "Steward feedback.",
  });

  const submittedProposal = submitInitiativeImprovementProposal(
    participantB,
    proposalDraft.proposalId,
  );

  const decidedProposal = decideInitiativeImprovementProposal(
    participantA,
    submittedProposal.proposalId,
    {
      decision: "accepted",
      decisionNote: "Scope clarification accepted for revision.",
    },
  );

  createInitiativeRevisionDraft(participantA, projected.initiativeId);

  saveInitiativeRevisionDraft(participantA, projected.initiativeId, {
    title: "E2E Collective Decision Initiative (Revised)",
    description: "Revised initiative ready for collective decision.",
    revisionSummary: "Added decision scope based on accepted proposal.",
    appliedProposalIds: [decidedProposal.proposalId],
  });

  publishInitiativeRevision(participantA, projected.initiativeId);

  const sessionDraft = createDecisionSessionDraft(participantA, {
    initiativeId: projected.initiativeId,
    title: "E2E Decision Session for Collective Decision",
    purpose: "Prepare society for the collective decision.",
    decisionQuestion: "Should the community proceed with the revised garden plan?",
    opensAt: futureIsoDate(7),
    closesAt: futureIsoDate(21),
  });

  publishDecisionSession(participantA, sessionDraft.sessionId);
  const closedSession = closeDecisionSession(participantA, sessionDraft.sessionId);
  assert(closedSession.status === "closed", "Decision session must be closed");

  return {
    initiativeId: projected.initiativeId,
    decisionSessionId: sessionDraft.sessionId,
  };
}

async function runMainVerification(): Promise<void> {
  const {
    createInitiativeCollectiveDecisionDraft,
    openInitiativeCollectiveDecision,
    closeInitiativeCollectiveDecision,
    cancelInitiativeCollectiveDecision,
    getInitiativeCollectiveDecisionEligibility,
  } =
    await import("../modules/initiative-collective-decision/initiative-collective-decision.service.js");
  const {
    getPublicInitiativeCollectiveDecision,
    listPublicInitiativeCollectiveDecisionsForInitiative,
    computeInitiativeCollectiveDecisionMetrics,
  } =
    await import("../modules/initiative-collective-decision/public-initiative-collective-decision.projection.js");
  const { createDecisionSessionDraft, publishDecisionSession, closeDecisionSession } =
    await import("../modules/decision-session/decision-session.service.js");
  const serviceModuleSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/initiative-collective-decision/initiative-collective-decision.service.ts",
    ),
    "utf-8",
  );
  const storeModuleSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/initiative-collective-decision/initiative-collective-decision.store.ts",
    ),
    "utf-8",
  );

  console.log("1. Domain transitions — approved lifecycle only");

  assert(
    canTransitionInitiativeCollectiveDecision("draft", "opened"),
    "draft should transition to opened",
  );
  assert(
    canTransitionInitiativeCollectiveDecision("opened", "closed"),
    "opened should transition to closed",
  );
  assert(
    canTransitionInitiativeCollectiveDecision("draft", "cancelled"),
    "draft should transition to cancelled",
  );
  assert(
    canTransitionInitiativeCollectiveDecision("opened", "cancelled"),
    "opened should transition to cancelled",
  );
  assert(
    !canTransitionInitiativeCollectiveDecision("closed", "opened"),
    "closed should be terminal",
  );
  assert(
    !canTransitionInitiativeCollectiveDecision("cancelled", "opened"),
    "cancelled should be terminal",
  );
  assert(isInitiativeCollectiveDecisionTerminal("closed"), "closed is terminal");
  assert(isInitiativeCollectiveDecisionTerminal("cancelled"), "cancelled is terminal");

  console.log("2. Eligibility — requires closed decision session");

  const eligible = await buildEligibleCollectiveDecisionContext();

  const openSession = createDecisionSessionDraft(participantA, {
    initiativeId: eligible.initiativeId,
    title: "Open Session",
    purpose: "Still open.",
    decisionQuestion: "Open session question?",
    opensAt: futureIsoDate(7),
    closesAt: futureIsoDate(14),
  });
  publishDecisionSession(participantA, openSession.sessionId);

  const openEligibility = getInitiativeCollectiveDecisionEligibility(
    eligible.initiativeId,
    openSession.sessionId,
  );
  assert(!openEligibility.eligible, "Published but open session should be ineligible");
  assert(
    openEligibility.reasons.some((reason) => reason.includes("closed")),
    "Open session should require closed status",
  );

  assertThrows(
    () =>
      createInitiativeCollectiveDecisionDraft(participantA, {
        initiativeId: eligible.initiativeId,
        decisionSessionId: openSession.sessionId,
        participationScope: "community",
        closesAt: futureIsoDate(30),
      }),
    "Open decision session must reject collective decision creation",
  );

  console.log("3. Eligibility — closed session allows draft creation");

  const eligibility = getInitiativeCollectiveDecisionEligibility(
    eligible.initiativeId,
    eligible.decisionSessionId,
  );
  assert(eligibility.eligible, "Closed decision session should be eligible");

  const decisionDraft = createInitiativeCollectiveDecisionDraft(participantA, {
    initiativeId: eligible.initiativeId,
    decisionSessionId: eligible.decisionSessionId,
    participationScope: "community",
    closesAt: futureIsoDate(30),
  });

  assert(decisionDraft.status === "draft", "Created decision should be draft");
  assert(decisionDraft.sequenceNumber === 1, "First decision should have sequence 1");
  assert(decisionDraft.question.length > 0, "Question should come from decision session");
  assert(decisionDraft.participationScope === "community", "Participation scope should persist");

  console.log("4. Lifecycle — draft → opened → closed");

  const opened = openInitiativeCollectiveDecision(participantA, decisionDraft.decisionId);
  assert(opened.status === "opened", "Opened decision status");
  assert(opened.openedAt !== undefined, "Opened decision should have openedAt");

  const closed = closeInitiativeCollectiveDecision(participantA, decisionDraft.decisionId);
  assert(closed.status === "closed", "Closed decision status");
  assert(closed.closedAt !== undefined, "Closed decision should have closedAt");

  assertThrows(
    () => openInitiativeCollectiveDecision(participantA, decisionDraft.decisionId),
    "Closed decision cannot reopen",
  );
  assertThrows(
    () => cancelInitiativeCollectiveDecision(participantA, decisionDraft.decisionId),
    "Closed decision cannot cancel",
  );

  console.log("5. Lifecycle — draft → cancelled");

  const cancelSession = createDecisionSessionDraft(participantA, {
    initiativeId: eligible.initiativeId,
    title: "Cancel Draft Session",
    purpose: "Session for draft cancel path.",
    decisionQuestion: "Should we cancel from draft?",
    opensAt: futureIsoDate(8),
    closesAt: futureIsoDate(18),
  });
  publishDecisionSession(participantA, cancelSession.sessionId);
  closeDecisionSession(participantA, cancelSession.sessionId);

  const cancelDraft = createInitiativeCollectiveDecisionDraft(participantA, {
    initiativeId: eligible.initiativeId,
    decisionSessionId: cancelSession.sessionId,
    participationScope: "world",
    closesAt: futureIsoDate(45),
  });

  const cancelledFromDraft = cancelInitiativeCollectiveDecision(
    participantA,
    cancelDraft.decisionId,
  );
  assert(cancelledFromDraft.status === "cancelled", "Cancelled from draft");
  assert(
    cancelledFromDraft.cancelledAt !== undefined,
    "Cancelled decision should have cancelledAt",
  );

  console.log("6. Lifecycle — opened → cancelled");

  const reopenSession = createDecisionSessionDraft(participantA, {
    initiativeId: eligible.initiativeId,
    title: "Cancel Path Session",
    purpose: "Session for open cancel path.",
    decisionQuestion: "Should we cancel after opening?",
    opensAt: futureIsoDate(10),
    closesAt: futureIsoDate(20),
  });
  publishDecisionSession(participantA, reopenSession.sessionId);
  closeDecisionSession(participantA, reopenSession.sessionId);

  const openCancelDraft = createInitiativeCollectiveDecisionDraft(participantA, {
    initiativeId: eligible.initiativeId,
    decisionSessionId: reopenSession.sessionId,
    participationScope: "region",
    closesAt: futureIsoDate(60),
  });
  openInitiativeCollectiveDecision(participantA, openCancelDraft.decisionId);

  const cancelledFromOpened = cancelInitiativeCollectiveDecision(
    participantA,
    openCancelDraft.decisionId,
  );
  assert(cancelledFromOpened.status === "cancelled", "Cancelled from opened");

  console.log("7. Identity — only steward may open, close, cancel");

  const ownershipSession = createDecisionSessionDraft(participantA, {
    initiativeId: eligible.initiativeId,
    title: "Ownership Session",
    purpose: "Ownership verification.",
    decisionQuestion: "Ownership question?",
    opensAt: futureIsoDate(12),
    closesAt: futureIsoDate(22),
  });
  publishDecisionSession(participantA, ownershipSession.sessionId);
  closeDecisionSession(participantA, ownershipSession.sessionId);

  const ownedDraft = createInitiativeCollectiveDecisionDraft(participantA, {
    initiativeId: eligible.initiativeId,
    decisionSessionId: ownershipSession.sessionId,
    participationScope: "country",
    closesAt: futureIsoDate(35),
  });

  assertThrows(
    () => openInitiativeCollectiveDecision(participantB, ownedDraft.decisionId),
    "Non-steward cannot open",
  );
  openInitiativeCollectiveDecision(participantA, ownedDraft.decisionId);
  assertThrows(
    () => closeInitiativeCollectiveDecision(participantB, ownedDraft.decisionId),
    "Non-steward cannot close",
  );
  assertThrows(
    () => cancelInitiativeCollectiveDecision(participantB, ownedDraft.decisionId),
    "Non-steward cannot cancel",
  );

  console.log("8. Public projections — draft hidden, opened/closed/cancelled visible");

  assert(
    getPublicInitiativeCollectiveDecision(ownedDraft.decisionId) !== null,
    "Opened decision should be publicly visible",
  );

  const publicOpened = getPublicInitiativeCollectiveDecision(ownedDraft.decisionId);
  assert(publicOpened !== null, "Opened public projection required");
  if (!publicOpened) {
    throw new Error("Opened public projection required");
  }

  assert(publicOpened.stewardDisplayName.length > 0, "Public projection should show steward name");
  assert(publicOpened.statistics.totalVotesCast === 0, "Statistics structure should be empty");
  assert(publicOpened.outcome === null, "Opened decision should not expose outcome yet");
  assertNoPrivateFields(publicOpened, "Public collective decision projection");

  console.log("9. Metrics readiness");

  const metrics = computeInitiativeCollectiveDecisionMetrics(eligible.initiativeId);
  assert(metrics.decisionCount >= 4, "Metrics should count all decisions");
  assert(metrics.openedCount >= 1, "Metrics should count opened decisions");
  assert(metrics.closedCount >= 1, "Metrics should count closed decisions");
  assert(metrics.cancelledCount >= 2, "Metrics should count cancelled decisions");

  closeInitiativeCollectiveDecision(participantA, ownedDraft.decisionId);
  const publicClosed = getPublicInitiativeCollectiveDecision(ownedDraft.decisionId);
  assert(publicClosed !== null, "Closed decision should remain public");
  if (!publicClosed) {
    throw new Error("Closed public projection required");
  }
  assert(publicClosed.outcome !== null, "Closed decision should expose outcome structure");
  assert(publicClosed.outcome?.outcome === "inconclusive", "Empty outcome remains inconclusive");

  const publicList = listPublicInitiativeCollectiveDecisionsForInitiative(eligible.initiativeId);
  assert(publicList.length >= 3, "Public list should include opened/closed/cancelled decisions");
  assertNoPrivateFields(publicList, "Public collective decision list");

  console.log("10. No voting — domain foundation only");

  for (const term of VOTING_TERMS) {
    assert(!serviceModuleSource.includes(term), `Service module must not include ${term}`);
    assert(!storeModuleSource.includes(term), `Store module must not include ${term}`);
  }
}

function assertDecisionReloadsFromFile(
  decisionId: string,
  expectedStatus: InitiativeCollectiveDecisionStatus,
  filePath: string,
): void {
  const reloadScriptPath = path.resolve(
    path.dirname(SCRIPT_PATH),
    "verify-initiative-collective-decision-store-reload.ts",
  );
  const result = spawnSync("npx", ["tsx", reloadScriptPath, decisionId, expectedStatus], {
    cwd: path.resolve(path.dirname(SCRIPT_PATH), "../.."),
    env: {
      ...process.env,
      INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE: "file",
      INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE_PATH: filePath,
    },
    stdio: "pipe",
    encoding: "utf-8",
  });

  assert(result.status === 0, `Decision should reload as ${expectedStatus} after API restart`);
}

async function runPersistenceVerification(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-collective-decision-e2e-"));
  const persistencePath = path.join(tempDir, "initiative-collective-decisions.json");

  process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "file";
  process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE_PATH = persistencePath;

  const { createFileInitiativeCollectiveDecisionPersistenceAdapter } =
    await import("../modules/initiative-collective-decision/persistence/initiative-collective-decision-file.persistence.js");
  const {
    createInitiativeCollectiveDecisionDraft,
    openInitiativeCollectiveDecision,
    closeInitiativeCollectiveDecision,
    cancelInitiativeCollectiveDecision,
  } =
    await import("../modules/initiative-collective-decision/initiative-collective-decision.service.js");

  const eligible = await buildEligibleCollectiveDecisionContext();

  const draft = createInitiativeCollectiveDecisionDraft(participantA, {
    initiativeId: eligible.initiativeId,
    decisionSessionId: eligible.decisionSessionId,
    participationScope: "community",
    closesAt: futureIsoDate(30),
  });

  const adapterAfterDraft = createFileInitiativeCollectiveDecisionPersistenceAdapter();
  assert(
    adapterAfterDraft.load().decisions[draft.decisionId]?.status === "draft",
    "Draft should persist to file",
  );
  assertDecisionReloadsFromFile(draft.decisionId, "draft", persistencePath);

  openInitiativeCollectiveDecision(participantA, draft.decisionId);
  assert(
    createFileInitiativeCollectiveDecisionPersistenceAdapter().load().decisions[draft.decisionId]
      ?.status === "opened",
    "Opened state should persist to file",
  );
  assertDecisionReloadsFromFile(draft.decisionId, "opened", persistencePath);

  closeInitiativeCollectiveDecision(participantA, draft.decisionId);
  assert(
    createFileInitiativeCollectiveDecisionPersistenceAdapter().load().decisions[draft.decisionId]
      ?.status === "closed",
    "Closed state should persist to file",
  );
  assertDecisionReloadsFromFile(draft.decisionId, "closed", persistencePath);

  const cancelSession = await buildEligibleCollectiveDecisionContext();
  const cancelDraft = createInitiativeCollectiveDecisionDraft(participantA, {
    initiativeId: cancelSession.initiativeId,
    decisionSessionId: cancelSession.decisionSessionId,
    participationScope: "world",
    closesAt: futureIsoDate(40),
  });
  cancelInitiativeCollectiveDecision(participantA, cancelDraft.decisionId);
  assert(
    createFileInitiativeCollectiveDecisionPersistenceAdapter().load().decisions[
      cancelDraft.decisionId
    ]?.status === "cancelled",
    "Cancelled state should persist to file",
  );
  assertDecisionReloadsFromFile(cancelDraft.decisionId, "cancelled", persistencePath);

  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log("11. Persistence — draft, opened, closed, cancelled survive API restart");
}

async function main(): Promise<void> {
  if (process.env.VERIFY_INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE === "1") {
    await runPersistenceVerification();
    console.log("Initiative Collective Decision persistence checks passed.");
    return;
  }

  await runMainVerification();

  const persistenceResult = spawnSync("npx", ["tsx", SCRIPT_PATH], {
    env: {
      ...process.env,
      VERIFY_INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE: "1",
      INITIATIVE_PERSISTENCE: "memory",
      INITIATIVE_ANALYSIS_PERSISTENCE: "memory",
      INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE: "memory",
      INITIATIVE_VERSION_REVISION_PERSISTENCE: "memory",
      DECISION_SESSION_PERSISTENCE: "memory",
      INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE: "memory",
    },
    stdio: "inherit",
  });

  assert(persistenceResult.status === 0, "Persistence verification subprocess failed");

  console.log("All Initiative Collective Decision E2E checks passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`E2E verification FAILED: ${message}`);
  process.exit(1);
});
