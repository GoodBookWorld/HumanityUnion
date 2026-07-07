/**
 * TASK-039 — Civic Action Package verification.
 * Run: npm run verify:civic-action-package
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CIVIC_NOTIFICATION_EVENT_REGISTRY } from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const author: RequestIdentity = {
  participantId: "member-cap-author",
  displayName: "CAP Author",
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
  "voteId",
];

const FORBIDDEN_TERMS = [
  "sendEmail",
  "nodemailer",
  "recipientSelection",
  "institutionProfile",
  "InstitutionProfile",
];

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
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

async function seedAuthors(): Promise<void> {
  const { seedMember } = await import("../modules/member/member.store.js");

  seedMember({
    id: author.participantId,
    profile: {
      displayName: author.displayName ?? "CAP Author",
      uniqueName: "cap-author",
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
  });
}

async function buildClosedDecisionContext(): Promise<{
  initiativeId: string;
  decisionId: string;
}> {
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
    title: "Civic Action Package Initiative",
    description: "Initiative for CAP verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(otherParticipant, {
    initiativeId: projected.initiativeId,
    title: "CAP Analysis",
    summary: "Analysis summary.",
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
  decideInitiativeImprovementProposal(steward, submittedProposal.proposalId, {
    decision: "accepted",
    decisionNote: "Accepted.",
  });

  createInitiativeRevisionDraft(steward, projected.initiativeId);
  saveInitiativeRevisionDraft(steward, projected.initiativeId, {
    title: "Civic Action Package Initiative (Revised)",
    description: "Revised.",
    revisionSummary: "Revision summary.",
    appliedProposalIds: [submittedProposal.proposalId],
  });
  publishInitiativeRevision(steward, projected.initiativeId);

  const sessionDraft = createDecisionSessionDraft(steward, {
    initiativeId: projected.initiativeId,
    title: "CAP Session",
    purpose: "Prepare decision.",
    decisionQuestion: "Should the community proceed with civic action?",
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

async function runVerification(): Promise<void> {
  const { generateCivicActionPackageForDecision } =
    await import("../modules/civic-action-package/civic-action-package.service.js");
  const {
    assertPublicProjectionHasNoPrivateFields,
    computeCivicActionPackageMetrics,
    getPublicCivicActionPackage,
    getPublicCivicActionPackageForDecision,
    listPublicCivicActionPackagesForInitiative,
  } = await import("../modules/civic-action-package/civic-action-package.projection.js");
  const { buildIntegrationView } =
    await import("../modules/capability02-integration/capability02-integration.service.js");

  const serviceSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/civic-action-package/civic-action-package.service.ts",
    ),
    "utf-8",
  );
  const storeSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/civic-action-package/civic-action-package.store.ts",
    ),
    "utf-8",
  );

  for (const term of FORBIDDEN_TERMS) {
    assert(!serviceSource.includes(term), `Service must not include ${term}`);
  }

  assert(
    storeSource.includes("resolveCivicActionPackagePersistenceAdapter"),
    "Store uses persistence adapter pattern",
  );

  await seedAuthors();
  const context = await buildClosedDecisionContext();

  console.log("1. CAP generated from closed decision");
  const generated = generateCivicActionPackageForDecision(context.decisionId);
  assert(generated.status === "issued", "CAP is issued");
  assert(generated.decisionId === context.decisionId, "CAP links to decision");
  assert(generated.capNumber >= 1, "CAP number assigned");

  console.log("2. One CAP per decision and idempotent generation");
  const second = generateCivicActionPackageForDecision(context.decisionId);
  assert(second.capId === generated.capId, "Idempotent generation returns same CAP");

  console.log("3. Public projection and privacy");
  const projection = getPublicCivicActionPackage(generated.capId);
  assert(projection !== null, "Public projection resolves");
  if (!projection) {
    throw new Error("Public projection resolves");
  }
  assert(projection.decisionQuestion.length > 0, "Decision question exposed");
  assert(projection.transparencyNote.length > 0, "Transparency note exposed");
  assert(projection.references.initiativeUrl.startsWith("/initiatives/public/"), "Initiative URL");
  assert(
    projection.references.decisionUrl.startsWith("/collective-decisions/public/"),
    "Decision URL",
  );
  assertNoPrivateFields(projection, "Public CAP projection");
  assert(assertPublicProjectionHasNoPrivateFields(projection), "Projection privacy guard");

  console.log("4. Public API projections");
  const byDecision = getPublicCivicActionPackageForDecision(context.decisionId);
  assert(byDecision?.capId === generated.capId, "Decision lookup resolves CAP");
  const byInitiative = listPublicCivicActionPackagesForInitiative(context.initiativeId);
  assert(byInitiative.length === 1, "Initiative lists one CAP");
  assert(byInitiative[0]?.capId === generated.capId, "Initiative list contains CAP");

  console.log("5. Metrics readiness");
  const metrics = computeCivicActionPackageMetrics();
  assert(metrics.capCount >= 1, "capCount");
  assert(metrics.issuedCapCount >= 1, "issuedCapCount");
  assert(metrics.archivedCapCount === 0, "archivedCapCount starts at zero");

  console.log("6. Integration layer");
  assert(
    CIVIC_NOTIFICATION_EVENT_REGISTRY.some(
      (event) => event.eventType === "civic_action_package_issued",
    ),
    "Notification registry includes civic_action_package_issued",
  );
  const integrationView = buildIntegrationView("civic_action_package", generated.capId);
  assert(integrationView !== null, "Integration view for CAP");
  assertNoPrivateFields(integrationView, "Integration view");

  console.log("7. Reference-only content — no duplicated entity payloads");
  assert(generated.content.initiativeTitle.length > 0, "Initiative reference title");
  assert(generated.content.collaborativeAnalysesCount >= 1, "Analyses count");
  assert(generated.content.revisionCount >= 1, "Revision count");
  assert(
    !JSON.stringify(projection).includes('"lessonsLearned"'),
    "No archive payload duplication",
  );
}

async function main(): Promise<void> {
  await runVerification();
  console.log("All Civic Action Package checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
