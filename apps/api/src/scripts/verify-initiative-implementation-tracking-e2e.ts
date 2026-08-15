/**
 * TASK-032 — Initiative Implementation Tracking foundation verification.
 * Run: npm run verify:initiative-implementation-tracking
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Member } from "@hu/types";
import {
  canTransitionInitiativeImplementationTracking,
  isInitiativeImplementationTrackingTerminal,
  SUGGESTED_IMPLEMENTATION_TRACKING_STAGES,
} from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";
import {
  assertVerificationSubprocessSucceeded,
  runVerificationSubprocess,
} from "./run-verification-subprocess.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const author: RequestIdentity = {
  participantId: "member-it-author",
  displayName: "Tracking Author",
};

const otherParticipant: RequestIdentity = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
};

const PRIVATE_FIELD_KEYS = ["participantId", "authorId", "memberId", "email", "stewardId"];

const PROJECT_MANAGEMENT_TERMS = [
  "projectBoard",
  "taskBoard",
  "kanban",
  "gantt",
  "progressPercent",
  "velocity",
  "burnDown",
  "burn-down",
  "issueTracker",
  "roadmap",
  "milestone",
  "sprint",
  "assignments",
];

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertThrows(fn: () => unknown, message: string): Promise<void> {
  try {
    await fn();
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

function createTestMember(id: string, displayName: string): Member {
  return {
    id,
    profile: {
      displayName,
      uniqueName: id.replace("member-", ""),
      languages: ["en"],
    },
    status: "active",
    verificationLevel: "email",
    roles: ["member"],
    fair: { personal: 0, community: 0, regional: 0, global: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function seedAuthor(): Promise<void> {
  const { seedMember } = await import("../modules/member/member.store.js");

  seedMember(createTestMember(author.participantId, author.displayName ?? "Tracking Author"));
}

interface PublishedCommitmentContext {
  initiativeId: string;
  decisionId: string;
  commitmentId: string;
}

async function buildPublishedCommitmentContext(): Promise<PublishedCommitmentContext> {
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
  const {
    createInitiativeCollectiveDecisionDraft,
    openInitiativeCollectiveDecision,
    closeInitiativeCollectiveDecision,
  } =
    await import("../modules/initiative-collective-decision/initiative-collective-decision.service.js");
  const {
    createInitiativeImplementationCommitmentDraft,
    publishInitiativeImplementationCommitment,
  } =
    await import("../modules/initiative-implementation-commitment/initiative-implementation-commitment.service.js");

  const draft = createInitiativeDraft(steward, {
    title: "Implementation Tracking E2E Initiative",
    description: "Initiative for implementation tracking verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = await createInitiativeCollaborativeAnalysisDraft(otherParticipant, {
    initiativeId: projected.initiativeId,
    title: "Implementation Tracking Analysis",
    summary: "Analysis for tracking path.",
    supportingEvidence: "Evidence.",
    risks: "Risk.",
    suggestedImprovements: "Improve.",
    references: "Ref.",
  });
  const publishedAnalysis = await publishInitiativeCollaborativeAnalysis(
    otherParticipant,
    analysisDraft.analysisId,
  );

  const proposalDraft = await createInitiativeImprovementProposalDraft(otherParticipant, {
    analysisId: publishedAnalysis.analysisId,
    targetSection: "Description",
    currentIssue: "Issue.",
    proposedChange: "Change.",
    rationale: "Rationale.",
    expectedImprovement: "Improvement.",
    references: "References.",
  });
  const submittedProposal = submitInitiativeImprovementProposal(
    otherParticipant,
    proposalDraft.proposalId,
  );
  const decidedProposal = decideInitiativeImprovementProposal(
    steward,
    submittedProposal.proposalId,
    {
      decision: "accepted",
      decisionNote: "Accepted for revision.",
    },
  );

  createInitiativeRevisionDraft(steward, projected.initiativeId);
  saveInitiativeRevisionDraft(steward, projected.initiativeId, {
    title: "Implementation Tracking E2E Initiative (Revised)",
    description: "Revised for implementation tracking.",
    revisionSummary: "Revision summary.",
    appliedProposalIds: [decidedProposal.proposalId],
  });
  publishInitiativeRevision(steward, projected.initiativeId);

  const sessionDraft = await createDecisionSessionDraft(steward, {
    initiativeId: projected.initiativeId,
    title: "Implementation Tracking Session",
    purpose: "Prepare society for collective decision.",
    decisionQuestion: "Should the community proceed with implementation?",
    opensAt: futureIsoDate(7),
    closesAt: futureIsoDate(21),
  });
  publishDecisionSession(steward, sessionDraft.sessionId);
  closeDecisionSession(steward, sessionDraft.sessionId);

  const decisionDraft = await createInitiativeCollectiveDecisionDraft(steward, {
    initiativeId: projected.initiativeId,
    decisionSessionId: sessionDraft.sessionId,
    participationScope: "community",
    closesAt: futureIsoDate(30),
  });
  openInitiativeCollectiveDecision(steward, decisionDraft.decisionId);
  await closeInitiativeCollectiveDecision(steward, decisionDraft.decisionId);

  const commitmentDraft = await createInitiativeImplementationCommitmentDraft(author, {
    initiativeId: projected.initiativeId,
    decisionId: decisionDraft.decisionId,
    commitmentTitle: "Garden Implementation Commitment",
    commitmentSummary: "Commit to steward the revised garden plan.",
    commitmentScope: "Site preparation and planting.",
  });
  const publishedCommitment = publishInitiativeImplementationCommitment(
    author,
    commitmentDraft.commitmentId,
  );

  return {
    initiativeId: projected.initiativeId,
    decisionId: decisionDraft.decisionId,
    commitmentId: publishedCommitment.commitmentId,
  };
}

async function runMainVerification(): Promise<void> {
  const {
    createInitiativeImplementationTrackingDraft,
    updateInitiativeImplementationTrackingDraft,
    activateInitiativeImplementationTracking,
    addImplementationTrackingUpdate,
    completeInitiativeImplementationTracking,
    archiveInitiativeImplementationTracking,
    listImplementationTrackingUpdates,
  } =
    await import("../modules/initiative-implementation-tracking/initiative-implementation-tracking.service.js");
  const { assessInitiativeImplementationTrackingEligibility } =
    await import("../modules/initiative-implementation-tracking/initiative-implementation-tracking-eligibility.js");
  const {
    computeInitiativeImplementationTrackingMetrics,
    getPublicInitiativeImplementationTracking,
    listPublicInitiativeImplementationTrackingsForCommitment,
    listPublicInitiativeImplementationTrackingsForInitiative,
  } =
    await import("../modules/initiative-implementation-tracking/public-initiative-implementation-tracking.projection.js");
  const { getUpdateById } =
    await import("../modules/initiative-implementation-tracking/initiative-implementation-tracking.store.js");
  const serviceModuleSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/initiative-implementation-tracking/initiative-implementation-tracking.service.ts",
    ),
    "utf-8",
  );
  const storeModuleSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/initiative-implementation-tracking/initiative-implementation-tracking.store.ts",
    ),
    "utf-8",
  );

  await seedAuthor();
  const context = await buildPublishedCommitmentContext();

  console.log("1. Domain transitions — draft, active, completed, archived");

  assert(
    canTransitionInitiativeImplementationTracking("draft", "active"),
    "draft should transition to active",
  );
  assert(
    canTransitionInitiativeImplementationTracking("active", "completed"),
    "active should transition to completed",
  );
  assert(
    canTransitionInitiativeImplementationTracking("draft", "archived"),
    "draft should transition to archived",
  );
  assert(
    canTransitionInitiativeImplementationTracking("active", "archived"),
    "active should transition to archived",
  );
  assert(
    !canTransitionInitiativeImplementationTracking("completed", "active"),
    "completed should be terminal",
  );
  assert(isInitiativeImplementationTrackingTerminal("archived"), "archived is terminal");

  console.log("2. Eligibility — requires published commitment by author");

  const eligibility = assessInitiativeImplementationTrackingEligibility(
    context.commitmentId,
    author.participantId,
  );
  assert(eligibility.eligible, "Published commitment author should be eligible");

  await assertThrows(
    async () =>
      assessInitiativeImplementationTrackingEligibility(
        context.commitmentId,
        otherParticipant.participantId,
      ).eligible ||
      (await createInitiativeImplementationTrackingDraft(otherParticipant, {
        commitmentId: context.commitmentId,
        currentStage: "Preparation",
        summary: "Unauthorized tracking.",
      })),
    "Non-author cannot begin tracking",
  );

  console.log("3. Lifecycle — draft → active → completed with evidence");

  const draft = await createInitiativeImplementationTrackingDraft(author, {
    commitmentId: context.commitmentId,
    currentStage: SUGGESTED_IMPLEMENTATION_TRACKING_STAGES[0],
    summary: "Public execution journal for garden implementation.",
  });
  assert(draft.status === "draft", "Tracking starts as draft");

  const updatedDraft = updateInitiativeImplementationTrackingDraft(author, draft.trackingId, {
    summary: "Updated journal summary before activation.",
    currentStage: "Custom Planning Stage",
  });
  assert(updatedDraft.currentStage === "Custom Planning Stage", "Custom stage allowed");

  const active = activateInitiativeImplementationTracking(author, draft.trackingId);
  assert(active.status === "active", "Tracking activated");
  assert(active.activatedAt !== undefined, "Active tracking has activatedAt");

  await assertThrows(
    () => completeInitiativeImplementationTracking(author, draft.trackingId),
    "Completion requires at least one execution update",
  );

  const firstUpdate = addImplementationTrackingUpdate(author, draft.trackingId, {
    title: "Site survey completed",
    summary: "Surveyed planting beds and irrigation lines.",
    evidence: "https://example.org/evidence/site-survey-report",
    references: ["https://example.org/reference/garden-plan"],
    currentStage: "Started",
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });
  const secondUpdate = addImplementationTrackingUpdate(author, draft.trackingId, {
    title: "Community work day",
    summary: "Volunteers prepared soil and marked beds.",
    evidence: "Photo documentation shared at community meeting.",
    references: [],
    currentStage: "In Progress",
  });

  const completed = completeInitiativeImplementationTracking(author, draft.trackingId);
  assert(completed.status === "completed", "Tracking completed with evidence");
  assert(completed.completedAt !== undefined, "Completed tracking has completedAt");

  console.log("4. Immutable execution history — newest first, nothing overwritten");

  const history = listImplementationTrackingUpdates(author, draft.trackingId);
  assert(history.length === 2, "Two immutable updates recorded");
  assert(history[0]?.updateId === secondUpdate.updateId, "Newest update first");
  assert(history[1]?.updateId === firstUpdate.updateId, "Older update preserved");

  const persistedFirst = getUpdateById(firstUpdate.updateId);
  assert(
    persistedFirst?.title === "Site survey completed",
    "First update remains unchanged after later updates",
  );
  assert(
    !storeModuleSource.includes("updateTrackingUpdate"),
    "Store has no update mutation for history",
  );
  assert(!storeModuleSource.includes("deleteTrackingUpdate"), "Store has no delete for history");

  console.log("5. Lifecycle — draft → archived");

  const archiveDraft = await createInitiativeImplementationTrackingDraft(author, {
    commitmentId: context.commitmentId,
    currentStage: "Preparation",
    summary: "Will be archived from draft.",
  });
  const archived = archiveInitiativeImplementationTracking(author, archiveDraft.trackingId);
  assert(archived.status === "archived", "Archived from draft");
  assert(archived.archivedAt !== undefined, "Archived tracking has archivedAt");

  console.log("6. Identity — author-only edit, activate, update, complete, archive");

  const authorDraft = await createInitiativeImplementationTrackingDraft(author, {
    commitmentId: context.commitmentId,
    currentStage: "Verification",
    summary: "Author-only tracking.",
  });

  await assertThrows(
    () =>
      updateInitiativeImplementationTrackingDraft(otherParticipant, authorDraft.trackingId, {
        summary: "Stolen edit",
      }),
    "Non-author cannot edit",
  );
  await assertThrows(
    () => activateInitiativeImplementationTracking(otherParticipant, authorDraft.trackingId),
    "Non-author cannot activate",
  );

  console.log("7. Public projection, privacy, and metrics");

  const publicDetail = await getPublicInitiativeImplementationTracking(draft.trackingId);
  assert(publicDetail !== null, "Completed tracking is public");
  if (!publicDetail) {
    throw new Error("Completed tracking is public");
  }
  assert(publicDetail.executionHistory.length === 2, "Public detail includes execution history");
  assertNoPrivateFields(publicDetail, "Public tracking detail");
  assertNoPrivateFields(publicDetail.executionHistory, "Public execution history");

  const publicList = await listPublicInitiativeImplementationTrackingsForInitiative(context.initiativeId);
  assert(publicList.length >= 2, "Initiative public list includes tracking records");
  assertNoPrivateFields(publicList, "Public tracking list");

  assert((await listPublicInitiativeImplementationTrackingsForCommitment(
    context.commitmentId,
  )).length >= 2, "Commitment public list includes tracking records");

  const metrics = computeInitiativeImplementationTrackingMetrics(context.initiativeId);
  assert(metrics.trackingCount >= 3, "trackingCount includes all records");
  assert(metrics.completedTrackingCount >= 1, "completedTrackingCount counted");
  assert(metrics.averageUpdatesPerTracking >= 0.5, "averageUpdatesPerTracking computed");
  assert(
    metrics.averageCompletionTimeMs === null || metrics.averageCompletionTimeMs >= 0,
    "averageCompletionTimeMs informational",
  );

  console.log("8. No project-management concepts in foundation layer");

  for (const term of PROJECT_MANAGEMENT_TERMS) {
    assert(!serviceModuleSource.includes(term), `Service must not include PM term: ${term}`);
    assert(!storeModuleSource.includes(term), `Store must not include PM term: ${term}`);
  }
}

function spawnReload(scriptName: string, args: string[], env: Record<string, string>): void {
  const reloadScriptPath = path.resolve(path.dirname(SCRIPT_PATH), scriptName);
  const result = runVerificationSubprocess(reloadScriptPath, args, {
    cwd: path.resolve(path.dirname(SCRIPT_PATH), "../.."),
    env: { ...process.env, ...env },
  });

  assertVerificationSubprocessSucceeded(result, scriptName);
}

async function runPersistenceVerification(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-implementation-tracking-e2e-"));
  const trackingPath = path.join(tempDir, "initiative-implementation-tracking.json");

  process.env.INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE = "file";
  process.env.INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE_PATH = trackingPath;
  process.env.INITIATIVE_PERSISTENCE = "memory";
  process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
  process.env.INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE = "memory";
  process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
  process.env.DECISION_SESSION_PERSISTENCE = "memory";
  process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "memory";
  process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE = "memory";

  await seedAuthor();
  const context = await buildPublishedCommitmentContext();
  const {
    createInitiativeImplementationTrackingDraft,
    activateInitiativeImplementationTracking,
    addImplementationTrackingUpdate,
    completeInitiativeImplementationTracking,
  } =
    await import("../modules/initiative-implementation-tracking/initiative-implementation-tracking.service.js");

  const draft = await createInitiativeImplementationTrackingDraft(author, {
    commitmentId: context.commitmentId,
    currentStage: "Started",
    summary: "Persistence tracking.",
  });
  activateInitiativeImplementationTracking(author, draft.trackingId);
  addImplementationTrackingUpdate(author, draft.trackingId, {
    title: "Persistence update",
    summary: "Evidence for persistence.",
    evidence: "https://example.org/evidence/persistence",
  });
  completeInitiativeImplementationTracking(author, draft.trackingId);

  const reloadEnv = {
    INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE: "file",
    INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE_PATH: trackingPath,
  };

  spawnReload(
    "verify-initiative-implementation-tracking-store-reload.ts",
    [draft.trackingId, "completed"],
    reloadEnv,
  );
  spawnReload(
    "verify-initiative-implementation-tracking-updates-reload.ts",
    [draft.trackingId, "1"],
    reloadEnv,
  );

  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log("9. Persistence — tracking status and immutable updates survive restart");
}

async function main(): Promise<void> {
  if (process.env.VERIFY_IMPLEMENTATION_TRACKING_PERSISTENCE === "1") {
    await runPersistenceVerification();
    console.log("Initiative Implementation Tracking persistence checks passed.");
    return;
  }

  await runMainVerification();

  // Recovery Task 16: run via the shared bounded-subprocess helper (direct
  // `process.execPath --import tsx`, never nested `npx`) instead of a raw,
  // unbounded `spawnSync("npx", ...)`. This process performs real Member
  // lookups (Mongo-backed) as part of the "Public projection, privacy, and
  // metrics" step, which used to leave an open MongoDB connection after all
  // assertions passed — keeping the process alive and this `spawnSync` call
  // blocked forever. Wrapping `main()` in `runVerificationScript` (below)
  // closes that connection deterministically; the timeout here is an
  // independent safety net.
  const persistenceResult = runVerificationSubprocess(SCRIPT_PATH, [], {
    env: {
      ...process.env,
      VERIFY_IMPLEMENTATION_TRACKING_PERSISTENCE: "1",
      INITIATIVE_PERSISTENCE: "memory",
      INITIATIVE_ANALYSIS_PERSISTENCE: "memory",
      INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE: "memory",
      INITIATIVE_VERSION_REVISION_PERSISTENCE: "memory",
      DECISION_SESSION_PERSISTENCE: "memory",
      INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE: "memory",
      INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE: "memory",
      INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE: "memory",
    },
  });

  // Preserve the pre-existing visible output of the persistence subprocess
  // even though output is now captured rather than inherited.
  if (persistenceResult.stdout) {
    process.stdout.write(persistenceResult.stdout);
  }

  assertVerificationSubprocessSucceeded(
    persistenceResult,
    "Initiative Implementation Tracking persistence verification",
  );

  console.log("All Initiative Implementation Tracking foundation checks passed.");
}

// Recovery Task 16: closes the shared MongoDB client (and other
// verification-only resources) deterministically after `main()` settles —
// see the comment above the persistence-subprocess call for why this was
// necessary to prevent an indefinite hang.
void runVerificationScript(main);
