/**
 * TASK-037 — Public Civic Archive verification.
 * Run: npm run verify:civic-archive
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Member } from "@hu/types";
import { canTransitionPublicCivicArchive, isPublicCivicArchiveTerminal } from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const author: RequestIdentity = {
  participantId: "member-ca-author",
  displayName: "Archive Author",
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

const SOCIAL_TERMS = [
  "likeCount",
  "followerCount",
  "reputationScore",
  "leaderboard",
  "reactionCount",
  "commentCount",
  "ratingAverage",
  "openai",
  "gpt",
  "aiSummary",
  "recommendationEngine",
];

const SAMPLE_LESSONS = {
  whatWorked: "Community stewardship and transparent evidence sharing.",
  whatDidNotWork: "Initial outreach timing was too compressed.",
  recommendationsForFuture: "Start stakeholder mapping before implementation activation.",
  transferableExperience:
    "Small communities can sustain civic gardens with shared maintenance roles.",
};

const SAMPLE_KNOWLEDGE = {
  socialBenefits: "Increased neighbourhood cooperation around shared food access.",
  environmentalBenefits: "Two maintained garden beds with verified soil improvement.",
  economicBenefits: "Reduced reliance on imported produce for participating households.",
  governanceBenefits: "Clear public accountability through verified civic records.",
  educationalBenefits: "Residents learned seasonal planting and maintenance practices.",
  additionalObservations: "Future initiatives should document maintenance roles explicitly.",
};

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
      country: "Canada",
      region: "British Columbia",
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

  seedMember(createTestMember(author.participantId, author.displayName ?? "Archive Author"));
}

interface VerifiedImpactContext {
  initiativeId: string;
  trackingId: string;
  impactId: string;
  decisionId: string;
  commitmentId: string;
}

async function buildVerifiedImpactContext(): Promise<VerifiedImpactContext> {
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
  const {
    createInitiativePublicImpactDraft,
    addPublicImpactEvidence,
    publishInitiativePublicImpact,
    verifyInitiativePublicImpact,
  } = await import("../modules/initiative-public-impact/initiative-public-impact.service.js");

  const draft = createInitiativeDraft(steward, {
    title: "Civic Archive E2E Initiative",
    description: "Initiative preserved in the civic archive.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(otherParticipant, {
    initiativeId: projected.initiativeId,
    title: "Archive Analysis",
    summary: "Analysis for archive path.",
    supportingEvidence: "Evidence.",
    risks: "Risk.",
    suggestedImprovements: "Improve.",
    references: "Ref.",
  });
  publishInitiativeCollaborativeAnalysis(otherParticipant, analysisDraft.analysisId);

  const proposalDraft = createInitiativeImprovementProposalDraft(otherParticipant, {
    analysisId: analysisDraft.analysisId,
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
    title: "Civic Archive E2E Initiative (Revised)",
    description: "Revised for civic archive.",
    revisionSummary: "Revision summary.",
    appliedProposalIds: [decidedProposal.proposalId],
  });
  publishInitiativeRevision(steward, projected.initiativeId);

  const sessionDraft = createDecisionSessionDraft(steward, {
    initiativeId: projected.initiativeId,
    title: "Archive Session",
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
    commitmentTitle: "Archive Implementation Commitment",
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

  const impactDraft = createInitiativePublicImpactDraft(author, {
    trackingId: trackingDraft.trackingId,
    title: "Community Garden Outcome",
    summary: "Observable change from the garden implementation.",
    observedImpact: "Two new community garden beds are actively maintained by residents.",
    affectedCommunity: "Nelson Community Garden",
    evidenceSummary: "Council letter and community documentation.",
  });
  addPublicImpactEvidence(author, impactDraft.impactId, {
    title: "Council confirmation letter",
    description: "Official letter confirming garden beds are operational.",
    referenceUrl: "https://example.org/evidence/council-letter.pdf",
    referenceType: "official_letter",
  });
  publishInitiativePublicImpact(author, impactDraft.impactId);
  verifyInitiativePublicImpact(steward, impactDraft.impactId);

  return {
    initiativeId: projected.initiativeId,
    trackingId: trackingDraft.trackingId,
    impactId: impactDraft.impactId,
    decisionId: decisionDraft.decisionId,
    commitmentId: publishedCommitment.commitmentId,
  };
}

async function runMainVerification(): Promise<void> {
  const {
    createPublicCivicArchiveDraft,
    updatePublicCivicArchiveDraft,
    publishPublicCivicArchive,
  } = await import("../modules/public-civic-archive/public-civic-archive.service.js");
  const { assessPublicCivicArchiveEligibility } =
    await import("../modules/public-civic-archive/public-civic-archive-eligibility.js");
  const {
    computePublicCivicArchiveMetrics,
    getPublicCivicArchive,
    getLatestPublishedPublicCivicArchiveForInitiative,
    getPublishedPublicCivicArchiveForImpact,
    listPublicCivicArchiveForInitiative,
    listPublicCivicArchiveIndex,
  } = await import("../modules/public-civic-archive/public-civic-archive.projection.js");
  const serviceModuleSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/public-civic-archive/public-civic-archive.service.ts",
    ),
    "utf-8",
  );
  const storeModuleSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/public-civic-archive/public-civic-archive.store.ts",
    ),
    "utf-8",
  );

  await seedAuthors();
  const context = await buildVerifiedImpactContext();

  console.log(
    "1. Eligibility — verified impact, projected initiative, closed decision, completed tracking",
  );

  const eligibility = assessPublicCivicArchiveEligibility(context.impactId, author.participantId);
  assert(eligibility.eligible, "Verified impact author should be eligible");

  assertThrows(
    () =>
      createPublicCivicArchiveDraft(otherParticipant, {
        impactId: context.impactId,
        title: "Unauthorized archive",
        summary: "Should fail.",
        lessonsLearned: SAMPLE_LESSONS,
        knowledgeContribution: SAMPLE_KNOWLEDGE,
      }),
    "Non-author cannot create archive draft",
  );

  console.log("2. Lifecycle — draft → published and immutability");

  assert(canTransitionPublicCivicArchive("draft", "published"), "draft should publish");
  assert(isPublicCivicArchiveTerminal("published"), "published is terminal");

  const draft = createPublicCivicArchiveDraft(author, {
    impactId: context.impactId,
    title: "Nelson Community Garden Civic Archive",
    summary: "Permanent record of the completed garden civic cycle.",
    lessonsLearned: SAMPLE_LESSONS,
    knowledgeContribution: SAMPLE_KNOWLEDGE,
  });
  assert(draft.status === "draft", "Archive starts as draft");
  assert(draft.references.decisionId === context.decisionId, "References include decision");
  assert(draft.references.commitmentId === context.commitmentId, "References include commitment");
  assert(draft.references.trackingId === context.trackingId, "References include tracking");
  assert(draft.references.impactId === context.impactId, "References include impact");

  updatePublicCivicArchiveDraft(author, draft.archiveRecordId, {
    summary: "Updated archive summary before publication.",
  });

  assertThrows(
    () =>
      createPublicCivicArchiveDraft(author, {
        impactId: context.impactId,
        title: "Duplicate draft",
        summary: "Should fail while draft already exists.",
        lessonsLearned: SAMPLE_LESSONS,
        knowledgeContribution: SAMPLE_KNOWLEDGE,
      }),
    "Duplicate draft blocked while draft exists",
  );

  assertThrows(
    () => publishPublicCivicArchive(author, draft.archiveRecordId),
    "Author cannot publish archive",
  );

  const published = publishPublicCivicArchive(steward, draft.archiveRecordId);
  assert(published.status === "published", "Steward published archive");
  assert(published.archivedVersion === 1, "First archive version is 1");
  assert(published.archivedAt !== undefined, "Published archive has archivedAt");

  assertThrows(
    () =>
      updatePublicCivicArchiveDraft(author, draft.archiveRecordId, {
        title: "Changed after publish",
      }),
    "Published archive cannot be edited",
  );

  const correctionDraft = createPublicCivicArchiveDraft(author, {
    impactId: context.impactId,
    title: "Nelson Community Garden Civic Archive (Correction)",
    summary: "Corrected permanent record after steward review.",
    lessonsLearned: SAMPLE_LESSONS,
    knowledgeContribution: SAMPLE_KNOWLEDGE,
  });
  const correctionPublished = publishPublicCivicArchive(steward, correctionDraft.archiveRecordId);
  assert(correctionPublished.archivedVersion === 2, "Correction creates archive version 2");

  console.log("3. Reference integrity — correction preserves upstream references");
  assert(
    correctionPublished.references.decisionId === context.decisionId,
    "Correction preserves decision reference",
  );
  assert(
    correctionPublished.references.impactId === context.impactId,
    "Correction preserves impact reference",
  );

  console.log("4. Public projection, privacy, and metrics");

  const publicDetail = getPublicCivicArchive(draft.archiveRecordId);
  assert(publicDetail !== null, "Published archive is public");
  if (!publicDetail) {
    throw new Error("Published archive is public");
  }
  assert(publicDetail.historicalTimeline.length >= 3, "Historical timeline populated");
  assertNoPrivateFields(publicDetail, "Public archive detail");
  assertNoPrivateFields(publicDetail.references, "Public archive references");

  const impactArchive = getPublishedPublicCivicArchiveForImpact(context.impactId);
  assert(
    impactArchive?.archiveRecordId === correctionPublished.archiveRecordId,
    "Impact archive lookup returns latest version",
  );

  const initiativeArchive = getLatestPublishedPublicCivicArchiveForInitiative(context.initiativeId);
  assert(
    initiativeArchive?.archiveRecordId === correctionPublished.archiveRecordId,
    "Initiative archive lookup returns latest version",
  );

  const initiativeList = listPublicCivicArchiveForInitiative(context.initiativeId);
  assert(initiativeList.length === 2, "Initiative archive list contains both published versions");

  const index = listPublicCivicArchiveIndex({ search: "Garden" });
  assert(
    index.some((record) => record.archiveRecordId === draft.archiveRecordId),
    "Index search works",
  );

  const metrics = computePublicCivicArchiveMetrics();
  assert(metrics.archiveRecordCount >= 1, "archiveRecordCount computed");
  assert(metrics.countriesRepresented >= 1, "countriesRepresented computed");
  assert(metrics.verifiedImpactCount >= 1, "verifiedImpactCount computed");

  console.log("5. Archive index filters");

  const filtered = listPublicCivicArchiveIndex({
    country: published.country,
    activityArea: published.activityArea,
  });
  assert(filtered.length >= 1, "Index filters return records");

  console.log("6. No social features or AI judgement in foundation layer");

  for (const term of SOCIAL_TERMS) {
    assert(!serviceModuleSource.includes(term), `Service must not include social term: ${term}`);
    assert(!storeModuleSource.includes(term), `Store must not include social term: ${term}`);
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-civic-archive-e2e-"));
  const archivePath = path.join(tempDir, "public-civic-archive.json");

  process.env.PUBLIC_CIVIC_ARCHIVE_PERSISTENCE = "file";
  process.env.PUBLIC_CIVIC_ARCHIVE_PERSISTENCE_PATH = archivePath;
  process.env.INITIATIVE_PERSISTENCE = "memory";
  process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
  process.env.INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE = "memory";
  process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
  process.env.DECISION_SESSION_PERSISTENCE = "memory";
  process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "memory";
  process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE = "memory";
  process.env.INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE = "memory";
  process.env.INITIATIVE_PUBLIC_IMPACT_PERSISTENCE = "memory";

  await seedAuthors();
  const context = await buildVerifiedImpactContext();
  const { createPublicCivicArchiveDraft, publishPublicCivicArchive } =
    await import("../modules/public-civic-archive/public-civic-archive.service.js");

  const draft = createPublicCivicArchiveDraft(author, {
    impactId: context.impactId,
    title: "Persistence Archive",
    summary: "Survives restart.",
    lessonsLearned: SAMPLE_LESSONS,
    knowledgeContribution: SAMPLE_KNOWLEDGE,
  });
  publishPublicCivicArchive(steward, draft.archiveRecordId);

  spawnReload("verify-public-civic-archive-store-reload.ts", [draft.archiveRecordId, "published"], {
    PUBLIC_CIVIC_ARCHIVE_PERSISTENCE: "file",
    PUBLIC_CIVIC_ARCHIVE_PERSISTENCE_PATH: archivePath,
  });

  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log("7. Persistence — archive status survives restart");
}

async function main(): Promise<void> {
  if (process.env.VERIFY_CIVIC_ARCHIVE_PERSISTENCE === "1") {
    await runPersistenceVerification();
    console.log("Public Civic Archive persistence checks passed.");
    return;
  }

  await runMainVerification();

  const persistenceResult = spawnSync("npx", ["tsx", SCRIPT_PATH], {
    cwd: path.resolve(path.dirname(SCRIPT_PATH), "../.."),
    env: {
      ...process.env,
      VERIFY_CIVIC_ARCHIVE_PERSISTENCE: "1",
      INITIATIVE_PERSISTENCE: "memory",
      INITIATIVE_ANALYSIS_PERSISTENCE: "memory",
      INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE: "memory",
      INITIATIVE_VERSION_REVISION_PERSISTENCE: "memory",
      DECISION_SESSION_PERSISTENCE: "memory",
      INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE: "memory",
      INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE: "memory",
      INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE: "memory",
      INITIATIVE_PUBLIC_IMPACT_PERSISTENCE: "memory",
      PUBLIC_CIVIC_ARCHIVE_PERSISTENCE: "memory",
    },
    stdio: "inherit",
  });

  assert(persistenceResult.status === 0, "Persistence verification subprocess failed");

  console.log("All Public Civic Archive checks passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
