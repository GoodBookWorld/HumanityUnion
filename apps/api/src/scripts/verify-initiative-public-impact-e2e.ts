/**
 * TASK-033 — Initiative Public Impact foundation verification.
 * Run: npm run verify:public-impact
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Member } from "@hu/types";
import { canTransitionInitiativePublicImpact, isInitiativePublicImpactTerminal } from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const author: RequestIdentity = {
  participantId: "member-pi-author",
  displayName: "Impact Author",
};

const otherParticipant: RequestIdentity = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
};

const PRIVATE_FIELD_KEYS = [
  "participantId",
  "authorId",
  "memberId",
  "email",
  "stewardId",
  "verifierId",
];

const SCORING_TERMS = [
  "impactScore",
  "impactRating",
  "successPercentage",
  "socialCredit",
  "reputationScore",
  "impactIndex",
  "esgMetric",
  "sdgCalculation",
  "openai",
  "gpt",
  "aiJudgement",
  "aiImpact",
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

async function seedAuthor(): Promise<void> {
  const { seedMember } = await import("../modules/member/member.store.js");

  seedMember(createTestMember(author.participantId, author.displayName ?? "Impact Author"));
}

interface CompletedTrackingContext {
  initiativeId: string;
  trackingId: string;
}

async function buildCompletedTrackingContext(): Promise<CompletedTrackingContext> {
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
  const {
    createInitiativeImplementationTrackingDraft,
    activateInitiativeImplementationTracking,
    addImplementationTrackingUpdate,
    completeInitiativeImplementationTracking,
  } =
    await import("../modules/initiative-implementation-tracking/initiative-implementation-tracking.service.js");

  const draft = createInitiativeDraft(steward, {
    title: "Public Impact E2E Initiative",
    description: "Initiative for public impact verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(otherParticipant, {
    initiativeId: projected.initiativeId,
    title: "Public Impact Analysis",
    summary: "Analysis for public impact path.",
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
    title: "Public Impact E2E Initiative (Revised)",
    description: "Revised for public impact.",
    revisionSummary: "Revision summary.",
    appliedProposalIds: [decidedProposal.proposalId],
  });
  publishInitiativeRevision(steward, projected.initiativeId);

  const sessionDraft = createDecisionSessionDraft(steward, {
    initiativeId: projected.initiativeId,
    title: "Public Impact Session",
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

  const commitmentDraft = createInitiativeImplementationCommitmentDraft(author, {
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

  const trackingDraft = createInitiativeImplementationTrackingDraft(author, {
    commitmentId: publishedCommitment.commitmentId,
    currentStage: "Completed",
    summary: "Garden implementation completed.",
  });
  activateInitiativeImplementationTracking(author, trackingDraft.trackingId);
  addImplementationTrackingUpdate(author, trackingDraft.trackingId, {
    title: "Completion update",
    summary: "Garden beds planted and irrigation verified.",
    evidence: "https://example.org/evidence/garden-completion",
  });
  completeInitiativeImplementationTracking(author, trackingDraft.trackingId);

  return {
    initiativeId: projected.initiativeId,
    trackingId: trackingDraft.trackingId,
  };
}

async function runMainVerification(): Promise<void> {
  const {
    createInitiativePublicImpactDraft,
    updateInitiativePublicImpactDraft,
    addPublicImpactEvidence,
    publishInitiativePublicImpact,
    verifyInitiativePublicImpact,
    archiveInitiativePublicImpact,
    listPublicImpactEvidence,
  } = await import("../modules/initiative-public-impact/initiative-public-impact.service.js");
  const { assessInitiativePublicImpactEligibility } =
    await import("../modules/initiative-public-impact/initiative-public-impact-eligibility.js");
  const {
    computeInitiativePublicImpactMetrics,
    getPublicInitiativePublicImpact,
    listPublicInitiativePublicImpactsForInitiative,
    listPublicInitiativePublicImpactsForTracking,
  } =
    await import("../modules/initiative-public-impact/public-initiative-public-impact.projection.js");
  const { getEvidenceById } =
    await import("../modules/initiative-public-impact/initiative-public-impact.store.js");
  const serviceModuleSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/initiative-public-impact/initiative-public-impact.service.ts",
    ),
    "utf-8",
  );
  const storeModuleSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/initiative-public-impact/initiative-public-impact.store.ts",
    ),
    "utf-8",
  );

  await seedAuthor();
  const context = await buildCompletedTrackingContext();

  console.log("1. Domain transitions — draft, published, verified, archived");

  assert(
    canTransitionInitiativePublicImpact("draft", "published"),
    "draft should transition to published",
  );
  assert(
    canTransitionInitiativePublicImpact("published", "verified"),
    "published should transition to verified",
  );
  assert(
    canTransitionInitiativePublicImpact("draft", "archived"),
    "draft should transition to archived",
  );
  assert(
    canTransitionInitiativePublicImpact("published", "archived"),
    "published should transition to archived",
  );
  assert(!canTransitionInitiativePublicImpact("verified", "published"), "verified is terminal");
  assert(isInitiativePublicImpactTerminal("archived"), "archived is terminal");

  console.log("2. Eligibility — requires completed tracking by author");

  const eligibility = assessInitiativePublicImpactEligibility(
    context.trackingId,
    author.participantId,
  );
  assert(eligibility.eligible, "Completed tracking author should be eligible");

  assertThrows(
    () =>
      createInitiativePublicImpactDraft(otherParticipant, {
        trackingId: context.trackingId,
        title: "Unauthorized impact",
        summary: "Should fail.",
        observedImpact: "None.",
        affectedCommunity: "None.",
        evidenceSummary: "None.",
      }),
    "Non-author cannot create public impact",
  );

  console.log("3. Lifecycle — draft → published → verified with evidence");

  const draft = createInitiativePublicImpactDraft(author, {
    trackingId: context.trackingId,
    title: "Community Garden Outcome",
    summary: "Observable change from the garden implementation.",
    observedImpact: "Two new community garden beds are actively maintained by residents.",
    affectedCommunity: "Nelson Community Garden",
    evidenceSummary: "Council letter and community documentation.",
  });
  assert(draft.status === "draft", "Impact starts as draft");

  updateInitiativePublicImpactDraft(author, draft.impactId, {
    summary: "Updated observable outcome summary before publishing.",
  });

  assertThrows(
    () => publishInitiativePublicImpact(author, draft.impactId),
    "Publish requires at least one evidence entry",
  );

  const firstEvidence = addPublicImpactEvidence(author, draft.impactId, {
    title: "Council confirmation letter",
    description: "Official letter confirming garden beds are operational.",
    referenceUrl: "https://example.org/evidence/council-letter.pdf",
    referenceType: "official_letter",
  });

  const published = publishInitiativePublicImpact(author, draft.impactId);
  assert(published.status === "published", "Impact published");
  assert(published.publishedAt !== undefined, "Published impact has publishedAt");

  assertThrows(
    () =>
      updateInitiativePublicImpactDraft(author, draft.impactId, {
        title: "Changed after publish",
      }),
    "Published impact cannot be edited",
  );

  assertThrows(
    () => verifyInitiativePublicImpact(author, draft.impactId),
    "Author cannot verify own impact",
  );

  const verified = verifyInitiativePublicImpact(steward, draft.impactId);
  assert(verified.status === "verified", "Steward verified impact");
  assert(verified.verifiedAt !== undefined, "Verified impact has verifiedAt");

  console.log("4. Immutable evidence history — newest first, expandable later");

  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

  const secondEvidence = addPublicImpactEvidence(author, draft.impactId, {
    title: "Community attendance dataset",
    description: "Monthly participation records for garden maintenance.",
    referenceUrl: "https://example.org/evidence/participation.csv",
    referenceType: "dataset",
  });

  const history = listPublicImpactEvidence(author, draft.impactId);
  assert(history.length === 2, "Two immutable evidence entries recorded");
  assert(history[0]?.evidenceId === secondEvidence.evidenceId, "Newest evidence first");

  const persistedFirst = getEvidenceById(firstEvidence.evidenceId);
  assert(
    persistedFirst?.title === "Council confirmation letter",
    "First evidence remains unchanged",
  );
  assert(!storeModuleSource.includes("updateEvidence"), "Store has no evidence mutation");
  assert(!storeModuleSource.includes("deleteEvidence"), "Store has no evidence deletion");

  console.log("5. Lifecycle — draft → archived and published → archived");

  const archiveDraft = createInitiativePublicImpactDraft(author, {
    trackingId: context.trackingId,
    title: "Archived Draft Impact",
    summary: "Will be archived from draft.",
    observedImpact: "Draft only.",
    affectedCommunity: "Nelson Community Garden",
    evidenceSummary: "Draft evidence summary.",
  });
  const archivedFromDraft = archiveInitiativePublicImpact(author, archiveDraft.impactId);
  assert(archivedFromDraft.status === "archived", "Archived from draft");

  const publishThenArchiveDraft = createInitiativePublicImpactDraft(author, {
    trackingId: context.trackingId,
    title: "Published Then Archived",
    summary: "Published impact archived by author.",
    observedImpact: "Temporary public record.",
    affectedCommunity: "Nelson Community Garden",
    evidenceSummary: "Supporting references.",
  });
  addPublicImpactEvidence(author, publishThenArchiveDraft.impactId, {
    title: "Website reference",
    description: "Public website documenting the outcome.",
    referenceUrl: "https://example.org/outcome",
    referenceType: "website",
  });
  publishInitiativePublicImpact(author, publishThenArchiveDraft.impactId);
  const archivedFromPublished = archiveInitiativePublicImpact(
    author,
    publishThenArchiveDraft.impactId,
  );
  assert(archivedFromPublished.status === "archived", "Archived from published");

  console.log("6. Identity — author publish/archive; steward verify");

  assertThrows(
    () => publishInitiativePublicImpact(otherParticipant, draft.impactId),
    "Non-author cannot publish",
  );
  assertThrows(
    () => archiveInitiativePublicImpact(otherParticipant, draft.impactId),
    "Non-author cannot archive verified impact",
  );

  console.log("7. Public projection, privacy, and metrics");

  const publicDetail = getPublicInitiativePublicImpact(draft.impactId);
  assert(publicDetail !== null, "Verified impact is public");
  if (!publicDetail) {
    throw new Error("Verified impact is public");
  }
  assert(publicDetail.evidence.length === 2, "Public detail includes evidence list");
  assertNoPrivateFields(publicDetail, "Public impact detail");
  assertNoPrivateFields(publicDetail.evidence, "Public evidence list");

  const publicList = listPublicInitiativePublicImpactsForInitiative(context.initiativeId);
  assert(publicList.length >= 2, "Initiative public list includes impact records");
  assertNoPrivateFields(publicList, "Public impact list");

  const trackingList = listPublicInitiativePublicImpactsForTracking(context.trackingId);
  assert(trackingList.length >= 2, "Tracking public list includes impact records");

  const metrics = computeInitiativePublicImpactMetrics(context.initiativeId);
  assert(metrics.impactCount >= 3, "impactCount includes all records");
  assert(metrics.verifiedImpactCount >= 1, "verifiedImpactCount counted");
  assert(
    metrics.publishedImpactCount + metrics.verifiedImpactCount >= 1,
    "published or verified impacts counted",
  );
  assert(metrics.averageEvidencePerImpact >= 0.5, "averageEvidencePerImpact computed");

  console.log("8. No scoring, ratings, or AI judgement in foundation layer");

  for (const term of SCORING_TERMS) {
    assert(!serviceModuleSource.includes(term), `Service must not include scoring term: ${term}`);
    assert(!storeModuleSource.includes(term), `Store must not include scoring term: ${term}`);
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-public-impact-e2e-"));
  const impactPath = path.join(tempDir, "initiative-public-impact.json");

  process.env.INITIATIVE_PUBLIC_IMPACT_PERSISTENCE = "file";
  process.env.INITIATIVE_PUBLIC_IMPACT_PERSISTENCE_PATH = impactPath;
  process.env.INITIATIVE_PERSISTENCE = "memory";
  process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
  process.env.INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE = "memory";
  process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
  process.env.DECISION_SESSION_PERSISTENCE = "memory";
  process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "memory";
  process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE = "memory";
  process.env.INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE = "memory";

  await seedAuthor();
  const context = await buildCompletedTrackingContext();
  const {
    createInitiativePublicImpactDraft,
    addPublicImpactEvidence,
    publishInitiativePublicImpact,
    verifyInitiativePublicImpact,
  } = await import("../modules/initiative-public-impact/initiative-public-impact.service.js");

  const draft = createInitiativePublicImpactDraft(author, {
    trackingId: context.trackingId,
    title: "Persistence Impact",
    summary: "Survives restart.",
    observedImpact: "Observable change persisted.",
    affectedCommunity: "Nelson Community Garden",
    evidenceSummary: "Persistence evidence summary.",
  });
  addPublicImpactEvidence(author, draft.impactId, {
    title: "Persistence evidence",
    description: "Evidence for persistence verification.",
    referenceType: "document",
  });
  publishInitiativePublicImpact(author, draft.impactId);
  verifyInitiativePublicImpact(steward, draft.impactId);

  const reloadEnv = {
    INITIATIVE_PUBLIC_IMPACT_PERSISTENCE: "file",
    INITIATIVE_PUBLIC_IMPACT_PERSISTENCE_PATH: impactPath,
  };

  spawnReload(
    "verify-initiative-public-impact-store-reload.ts",
    [draft.impactId, "verified"],
    reloadEnv,
  );
  spawnReload(
    "verify-initiative-public-impact-evidence-reload.ts",
    [draft.impactId, "1"],
    reloadEnv,
  );

  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log("9. Persistence — impact status and immutable evidence survive restart");
}

async function main(): Promise<void> {
  if (process.env.VERIFY_PUBLIC_IMPACT_PERSISTENCE === "1") {
    await runPersistenceVerification();
    console.log("Initiative Public Impact persistence checks passed.");
    return;
  }

  await runMainVerification();

  const persistenceResult = spawnSync("npx", ["tsx", SCRIPT_PATH], {
    cwd: path.resolve(path.dirname(SCRIPT_PATH), "../.."),
    env: {
      ...process.env,
      VERIFY_PUBLIC_IMPACT_PERSISTENCE: "1",
      INITIATIVE_PERSISTENCE: "memory",
      INITIATIVE_ANALYSIS_PERSISTENCE: "memory",
      INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE: "memory",
      INITIATIVE_VERSION_REVISION_PERSISTENCE: "memory",
      DECISION_SESSION_PERSISTENCE: "memory",
      INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE: "memory",
      INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE: "memory",
      INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE: "memory",
      INITIATIVE_PUBLIC_IMPACT_PERSISTENCE: "memory",
    },
    stdio: "inherit",
  });

  assert(persistenceResult.status === 0, "Persistence verification subprocess failed");

  console.log("All Initiative Public Impact foundation checks passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
