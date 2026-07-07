/**
 * TASK-040 — Civic Delivery Workflow verification.
 * Run: npm run verify:civic-delivery
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const otherParticipant: RequestIdentity = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
};

const PRIVATE_FIELD_KEYS = [
  "participantId",
  "senderParticipantId",
  "authorId",
  "memberId",
  "email",
  "stewardId",
  "voteId",
];

const FORBIDDEN_TERMS = [
  "InstitutionProfile",
  "institutionProfile",
  "incomingReply",
  "mailboxEngine",
  "nodemailer",
  "createTransport",
  "bulkCampaign",
  "openai",
  "gpt",
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

async function buildCapContext(): Promise<{
  capId: string;
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
  const { getCivicActionPackageForDecision } =
    await import("../modules/civic-action-package/civic-action-package.service.js");

  const draft = createInitiativeDraft(steward, {
    title: "Civic Delivery Initiative",
    description: "Initiative for civic delivery verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(otherParticipant, {
    initiativeId: projected.initiativeId,
    title: "Delivery Analysis",
    summary: "Analysis summary.",
    supportingEvidence: "Evidence.",
    risks: "Risk.",
    suggestedImprovements: "Improve.",
    references: "Ref.",
  });
  const analysis = publishInitiativeCollaborativeAnalysis(
    otherParticipant,
    analysisDraft.analysisId,
  );

  const proposalDraft = createInitiativeImprovementProposalDraft(otherParticipant, {
    analysisId: analysis.analysisId,
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
    title: "Civic Delivery Initiative (Revised)",
    description: "Revised.",
    revisionSummary: "Revision summary.",
    appliedProposalIds: [submittedProposal.proposalId],
  });
  publishInitiativeRevision(steward, projected.initiativeId);

  const sessionDraft = createDecisionSessionDraft(steward, {
    initiativeId: projected.initiativeId,
    title: "Delivery Session",
    purpose: "Prepare decision.",
    decisionQuestion: "Should civic delivery proceed?",
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

  const capPackage = getCivicActionPackageForDecision(decisionDraft.decisionId);

  if (!capPackage) {
    throw new Error("Civic Action Package was not generated.");
  }

  return {
    capId: capPackage.capId,
    initiativeId: projected.initiativeId,
    decisionId: decisionDraft.decisionId,
  };
}

async function runVerification(): Promise<void> {
  const {
    addCivicDeliveryRecipient,
    createCivicDeliveryDraft,
    listRecommendedCivicDeliveryRecipients,
    sendCivicDelivery,
  } = await import("../modules/civic-delivery/civic-delivery.service.js");
  const {
    assertPublicProjectionHasNoPrivateFields,
    computeCivicDeliveryMetrics,
    getPublicCivicDelivery,
    listPublicCivicDeliveriesForCap,
  } = await import("../modules/civic-delivery/civic-delivery.projection.js");
  const { getCapById } =
    await import("../modules/civic-action-package/civic-action-package.store.js");

  const serviceSource = fs.readFileSync(
    path.resolve(path.dirname(SCRIPT_PATH), "../modules/civic-delivery/civic-delivery.service.ts"),
    "utf-8",
  );
  const providerSource = fs.readFileSync(
    path.resolve(path.dirname(SCRIPT_PATH), "../modules/civic-delivery/civic-delivery-provider.ts"),
    "utf-8",
  );
  const storeSource = fs.readFileSync(
    path.resolve(path.dirname(SCRIPT_PATH), "../modules/civic-delivery/civic-delivery.store.ts"),
    "utf-8",
  );

  for (const term of FORBIDDEN_TERMS) {
    assert(!serviceSource.includes(term), `Service must not include ${term}`);
    assert(!providerSource.includes(term), `Provider must not include ${term}`);
  }

  assert(
    storeSource.includes("resolveCivicDeliveryPersistenceAdapter"),
    "Store uses persistence adapter pattern",
  );
  assert(providerSource.includes("DevSimulatedCivicDeliveryProvider"), "Dev provider implemented");

  const context = await buildCapContext();

  console.log("1. Delivery draft created for CAP");
  const draft = createCivicDeliveryDraft(steward, { capId: context.capId });
  assert(draft.status === "draft", "Delivery starts as draft");
  assert(draft.capId === context.capId, "Delivery links to CAP");

  const duplicateDraft = createCivicDeliveryDraft(steward, { capId: context.capId });
  assert(duplicateDraft.deliveryId === draft.deliveryId, "Draft creation is idempotent per sender");

  console.log("2. Recommended recipients generated");
  const recommendations = listRecommendedCivicDeliveryRecipients(context.capId);
  assert(recommendations.length >= 3, "Rule-based recommendations generated");
  assert(
    recommendations.every((recipient) => recipient.source === "recommended"),
    "Recommendations are marked recommended",
  );

  console.log("3. User-added and recommended recipient selection");
  const recommended = recommendations[0];
  if (!recommended) {
    throw new Error("Recommendation missing");
  }

  addCivicDeliveryRecipient(steward, draft.deliveryId, {
    name: recommended.name,
    organization: recommended.organization,
    recipientType: recommended.recipientType,
    email: recommended.email,
    reason: recommended.reason,
    source: "recommended",
  });

  addCivicDeliveryRecipient(steward, draft.deliveryId, {
    name: "Custom Civic Contact",
    recipientType: "other",
    email: "custom-recipient@example.org",
    reason: "User-selected recipient for civic transparency.",
    source: "user_added",
  });

  console.log("4. One CAP delivered to many recipients without CAP duplication");
  const capBefore = getCapById(context.capId);
  const sent = await sendCivicDelivery(steward, draft.deliveryId);
  const capAfter = getCapById(context.capId);

  assert(capBefore?.capId === capAfter?.capId, "CAP is not duplicated on delivery");
  assert(sent.delivery.status === "sent", "Delivery marked sent");
  assert(sent.delivery.deliveryMode === "dev_simulated", "Dev simulated delivery mode");
  assert(sent.recipients.length === 2, "Two recipients delivered");
  assert(
    sent.recipients.every((recipient) => recipient.deliveryStatus === "sent"),
    "Recipients marked sent",
  );

  console.log("5. Public delivery log projection");
  const publicList = listPublicCivicDeliveriesForCap(context.capId);
  assert(publicList.length === 1, "Public delivery list for CAP");
  const publicDetail = getPublicCivicDelivery(draft.deliveryId);
  assert(publicDetail !== null, "Public delivery detail resolves");
  if (!publicDetail) {
    throw new Error("Public delivery detail resolves");
  }
  assert(publicDetail.recipients.length === 2, "Public log includes recipients");
  assertNoPrivateFields(publicDetail, "Public delivery projection");
  assert(assertPublicProjectionHasNoPrivateFields(publicDetail), "Projection privacy guard");

  console.log("6. Metrics readiness");
  const metrics = computeCivicDeliveryMetrics();
  assert(metrics.deliveryCount >= 1, "deliveryCount");
  assert(metrics.sentDeliveryCount >= 1, "sentDeliveryCount");
  assert(metrics.recipientCount >= 2, "recipientCount");
  assert(metrics.sentRecipientCount >= 2, "sentRecipientCount");
  assert(metrics.recommendedRecipientCount >= 1, "recommendedRecipientCount");
  assert(metrics.userAddedRecipientCount >= 1, "userAddedRecipientCount");
}

async function main(): Promise<void> {
  await runVerification();
  console.log("All Civic Delivery checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
