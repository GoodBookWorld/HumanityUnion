/**
 * TASK-031 — Initiative Implementation Commitment foundation verification.
 * Run: npm run verify:initiative-implementation-commitment
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Member } from "@hu/types";
import {
  canTransitionInitiativeImplementationCommitment,
  isInitiativeImplementationCommitmentTerminal,
} from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const authorA: RequestIdentity = {
  participantId: "member-ic-author-a",
  displayName: "Commitment Author A",
};

const authorB: RequestIdentity = {
  participantId: "member-ic-author-b",
  displayName: "Commitment Author B",
};

const otherParticipant: RequestIdentity = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
};

const PRIVATE_FIELD_KEYS = ["participantId", "authorId", "memberId", "email", "stewardId"];

const TRACKING_TERMS = [
  "progressPercent",
  "taskStatus",
  "milestone",
  "projectBoard",
  "executionDashboard",
  "implementationTracking",
  "trackProgress",
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

async function seedAuthors(): Promise<void> {
  const { seedMember } = await import("../modules/member/member.store.js");

  seedMember(createTestMember(authorA.participantId, authorA.displayName ?? "Author A"));
  seedMember(createTestMember(authorB.participantId, authorB.displayName ?? "Author B"));
}

interface ClosedDecisionContext {
  initiativeId: string;
  decisionId: string;
}

async function buildClosedDecisionContext(): Promise<ClosedDecisionContext> {
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

  const draft = createInitiativeDraft(steward, {
    title: "Implementation Commitment E2E Initiative",
    description: "Initiative for implementation commitment verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(otherParticipant, {
    initiativeId: projected.initiativeId,
    title: "Implementation Commitment Analysis",
    summary: "Analysis for implementation commitment path.",
    supportingEvidence: "Evidence.",
    risks: "Risk.",
    suggestedImprovements: "Improve.",
    references: "Ref.",
  });
  const publishedAnalysis = publishInitiativeCollaborativeAnalysis(
    otherParticipant,
    analysisDraft.analysisId,
  );

  const proposalDraft = createInitiativeImprovementProposalDraft(otherParticipant, {
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
    title: "Implementation Commitment E2E Initiative (Revised)",
    description: "Revised for implementation commitment.",
    revisionSummary: "Revision summary.",
    appliedProposalIds: [decidedProposal.proposalId],
  });
  publishInitiativeRevision(steward, projected.initiativeId);

  const sessionDraft = createDecisionSessionDraft(steward, {
    initiativeId: projected.initiativeId,
    title: "Implementation Commitment Session",
    purpose: "Prepare society for collective decision.",
    decisionQuestion: "Should the community proceed with implementation?",
    opensAt: futureIsoDate(7),
    closesAt: futureIsoDate(21),
  });
  publishDecisionSession(steward, sessionDraft.sessionId);
  closeDecisionSession(steward, sessionDraft.sessionId);

  const decisionDraft = createInitiativeCollectiveDecisionDraft(steward, {
    initiativeId: projected.initiativeId,
    decisionSessionId: sessionDraft.sessionId,
    participationScope: "community",
    closesAt: futureIsoDate(30),
  });
  openInitiativeCollectiveDecision(steward, decisionDraft.decisionId);
  closeInitiativeCollectiveDecision(steward, decisionDraft.decisionId);

  return {
    initiativeId: projected.initiativeId,
    decisionId: decisionDraft.decisionId,
  };
}

async function runMainVerification(): Promise<void> {
  const {
    createInitiativeImplementationCommitmentDraft,
    updateInitiativeImplementationCommitmentDraft,
    publishInitiativeImplementationCommitment,
    withdrawInitiativeImplementationCommitment,
    completeInitiativeImplementationCommitment,
  } =
    await import("../modules/initiative-implementation-commitment/initiative-implementation-commitment.service.js");
  const { assessInitiativeImplementationCommitmentEligibility } =
    await import("../modules/initiative-implementation-commitment/initiative-implementation-commitment-eligibility.js");
  const {
    computeInitiativeImplementationCommitmentMetrics,
    getPublicInitiativeImplementationCommitment,
    listPublicInitiativeImplementationCommitmentsForDecision,
    listPublicInitiativeImplementationCommitmentsForInitiative,
  } =
    await import("../modules/initiative-implementation-commitment/public-initiative-implementation-commitment.projection.js");
  const serviceModuleSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/initiative-implementation-commitment/initiative-implementation-commitment.service.ts",
    ),
    "utf-8",
  );
  const storeModuleSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/initiative-implementation-commitment/initiative-implementation-commitment.store.ts",
    ),
    "utf-8",
  );

  await seedAuthors();
  const context = await buildClosedDecisionContext();

  console.log("1. Domain transitions — draft, published, withdrawn, completed");

  assert(
    canTransitionInitiativeImplementationCommitment("draft", "published"),
    "draft should transition to published",
  );
  assert(
    canTransitionInitiativeImplementationCommitment("published", "withdrawn"),
    "published should transition to withdrawn",
  );
  assert(
    canTransitionInitiativeImplementationCommitment("published", "completed"),
    "published should transition to completed",
  );
  assert(
    !canTransitionInitiativeImplementationCommitment("completed", "published"),
    "completed should be terminal",
  );
  assert(isInitiativeImplementationCommitmentTerminal("withdrawn"), "withdrawn is terminal");
  assert(isInitiativeImplementationCommitmentTerminal("completed"), "completed is terminal");

  console.log("2. Eligibility — requires closed collective decision");

  const eligibility = assessInitiativeImplementationCommitmentEligibility(
    context.initiativeId,
    context.decisionId,
  );
  assert(eligibility.eligible, "Closed collective decision should enable commitments");

  console.log("3. Lifecycle — draft → published → completed");

  const draft = createInitiativeImplementationCommitmentDraft(authorA, {
    initiativeId: context.initiativeId,
    decisionId: context.decisionId,
    organizationName: "Nelson Garden Collective",
    commitmentTitle: "Community Garden Implementation",
    commitmentSummary: "We commit to steward the revised garden plan.",
    commitmentScope: "Site preparation and planting in Nelson Community Garden.",
    expectedStartDate: futureIsoDate(30),
    expectedCompletionDate: futureIsoDate(120),
  });
  assert(draft.status === "draft", "Commitment starts as draft");

  const updatedDraft = updateInitiativeImplementationCommitmentDraft(authorA, draft.commitmentId, {
    commitmentSummary: "Updated summary before publish.",
  });
  assert(
    updatedDraft.commitmentSummary === "Updated summary before publish.",
    "Author can edit draft",
  );

  const published = publishInitiativeImplementationCommitment(authorA, draft.commitmentId);
  assert(published.status === "published", "Published commitment");
  assert(published.publishedAt !== undefined, "Published commitment has publishedAt");

  assertThrows(
    () =>
      updateInitiativeImplementationCommitmentDraft(authorA, draft.commitmentId, {
        commitmentTitle: "Changed after publish",
      }),
    "Published commitment cannot be edited",
  );

  const completed = completeInitiativeImplementationCommitment(authorA, draft.commitmentId);
  assert(completed.status === "completed", "Completed commitment");
  assert(completed.completedAt !== undefined, "Completed commitment has completedAt");

  console.log("4. Lifecycle — draft → withdrawn");

  const withdrawDraft = createInitiativeImplementationCommitmentDraft(authorA, {
    initiativeId: context.initiativeId,
    decisionId: context.decisionId,
    commitmentTitle: "Withdrawn Commitment",
    commitmentSummary: "Will be withdrawn before publish.",
    commitmentScope: "Pilot phase only.",
  });
  const withdrawn = withdrawInitiativeImplementationCommitment(authorA, withdrawDraft.commitmentId);
  assert(withdrawn.status === "withdrawn", "Withdrawn from draft");
  assert(withdrawn.withdrawnAt !== undefined, "Withdrawn commitment has withdrawnAt");

  console.log("5. Identity — author-only edit, publish, withdraw");

  const authorDraft = createInitiativeImplementationCommitmentDraft(authorB, {
    initiativeId: context.initiativeId,
    decisionId: context.decisionId,
    commitmentTitle: "Author B Commitment",
    commitmentSummary: "Independent organization commitment.",
    commitmentScope: "Outreach and education.",
    organizationName: "Kootenay Civic Lab",
  });

  assertThrows(
    () =>
      updateInitiativeImplementationCommitmentDraft(otherParticipant, authorDraft.commitmentId, {
        commitmentTitle: "Stolen edit",
      }),
    "Non-author cannot edit",
  );
  assertThrows(
    () => publishInitiativeImplementationCommitment(otherParticipant, authorDraft.commitmentId),
    "Non-author cannot publish",
  );
  assertThrows(
    () => withdrawInitiativeImplementationCommitment(otherParticipant, authorDraft.commitmentId),
    "Non-author cannot withdraw",
  );

  const publishedB = publishInitiativeImplementationCommitment(authorB, authorDraft.commitmentId);
  assert(publishedB.organizationName === "Kootenay Civic Lab", "Organization name preserved");

  console.log("6. Relationship — one decision, many commitments");

  assert(
    listPublicInitiativeImplementationCommitmentsForDecision(context.decisionId).length >= 2,
    "Multiple independent commitments on one decision",
  );

  console.log("7. Public projection and privacy");

  const publicDetail = getPublicInitiativeImplementationCommitment(draft.commitmentId);
  assert(publicDetail !== null, "Completed commitment is public");
  if (!publicDetail) {
    throw new Error("Completed commitment is public");
  }
  assert(publicDetail.authorDisplayName === "Commitment Author A", "Author display name resolved");
  assertNoPrivateFields(publicDetail, "Public commitment detail");

  const publicList = listPublicInitiativeImplementationCommitmentsForInitiative(
    context.initiativeId,
  );
  assert(publicList.length >= 2, "Initiative public list includes commitments");
  assertNoPrivateFields(publicList, "Public commitment list");

  assert(
    getPublicInitiativeImplementationCommitment(withdrawDraft.commitmentId) !== null,
    "Withdrawn commitment remains publicly visible",
  );

  console.log("8. Metrics readiness");

  const metrics = computeInitiativeImplementationCommitmentMetrics(context.initiativeId);
  assert(metrics.commitmentCount >= 3, "commitmentCount includes drafts and public states");
  assert(metrics.publishedCommitments >= 1, "publishedCommitments counted");
  assert(metrics.completedCommitments >= 1, "completedCommitments counted");
  assert(metrics.withdrawnCommitments >= 1, "withdrawnCommitments counted");

  console.log("9. No implementation tracking in foundation layer");

  for (const term of TRACKING_TERMS) {
    assert(!serviceModuleSource.includes(term), `Service must not include tracking term: ${term}`);
    assert(!storeModuleSource.includes(term), `Store must not include tracking term: ${term}`);
  }
}

function spawnReload(scriptName: string, args: string[], env: Record<string, string>): void {
  const reloadScriptPath = path.resolve(path.dirname(SCRIPT_PATH), scriptName);
  const result = spawnSync("npx", ["tsx", reloadScriptPath, ...args], {
    cwd: path.resolve(path.dirname(SCRIPT_PATH), "../.."),
    env: { ...process.env, ...env },
    stdio: "pipe",
    encoding: "utf-8",
  });

  assert(result.status === 0, `Reload verification failed for ${scriptName}`);
}

async function runPersistenceVerification(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-implementation-commitment-e2e-"));
  const commitmentPath = path.join(tempDir, "initiative-implementation-commitments.json");

  process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE = "file";
  process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE_PATH = commitmentPath;
  process.env.INITIATIVE_PERSISTENCE = "memory";
  process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
  process.env.INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE = "memory";
  process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
  process.env.DECISION_SESSION_PERSISTENCE = "memory";
  process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "memory";

  const { publishInitiativeImplementationCommitment } =
    await import("../modules/initiative-implementation-commitment/initiative-implementation-commitment.service.js");

  await seedAuthors();
  const context = await buildClosedDecisionContext();
  const { createInitiativeImplementationCommitmentDraft } =
    await import("../modules/initiative-implementation-commitment/initiative-implementation-commitment.service.js");

  const draft = createInitiativeImplementationCommitmentDraft(authorA, {
    initiativeId: context.initiativeId,
    decisionId: context.decisionId,
    commitmentTitle: "Persistence Commitment",
    commitmentSummary: "Survives restart.",
    commitmentScope: "Persistence verification.",
  });
  publishInitiativeImplementationCommitment(authorA, draft.commitmentId);

  const reloadEnv = {
    INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE: "file",
    INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE_PATH: commitmentPath,
  };

  spawnReload(
    "verify-initiative-implementation-commitment-store-reload.ts",
    [draft.commitmentId, "published"],
    reloadEnv,
  );

  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log("10. Persistence — commitment status survives restart");
}

async function main(): Promise<void> {
  if (process.env.VERIFY_IMPLEMENTATION_COMMITMENT_PERSISTENCE === "1") {
    await runPersistenceVerification();
    console.log("Initiative Implementation Commitment persistence checks passed.");
    return;
  }

  await runMainVerification();

  const persistenceResult = spawnSync("npx", ["tsx", SCRIPT_PATH], {
    cwd: path.resolve(path.dirname(SCRIPT_PATH), "../.."),
    env: {
      ...process.env,
      VERIFY_IMPLEMENTATION_COMMITMENT_PERSISTENCE: "1",
      INITIATIVE_PERSISTENCE: "memory",
      INITIATIVE_ANALYSIS_PERSISTENCE: "memory",
      INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE: "memory",
      INITIATIVE_VERSION_REVISION_PERSISTENCE: "memory",
      DECISION_SESSION_PERSISTENCE: "memory",
      INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE: "memory",
      INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE: "memory",
    },
    stdio: "inherit",
  });

  assert(persistenceResult.status === 0, "Persistence verification subprocess failed");

  console.log("All Initiative Implementation Commitment foundation checks passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
