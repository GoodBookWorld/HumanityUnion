/**
 * TASK-042 — Civic Accountability Foundation verification.
 * Run: npm run verify:civic-accountability
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

const otherParticipant: RequestIdentity = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
};

const PRIVATE_FIELD_KEYS = [
  "participantId",
  "recordedByParticipantId",
  "createdByParticipantId",
  "verifiedByParticipantId",
  "senderParticipantId",
  "authorId",
  "memberId",
  "email",
  "stewardId",
  "providerMetadata",
  "messageHeaders",
  "rawSource",
];

const FORBIDDEN_TERMS = [
  "InstitutionProfile",
  "institutionProfile",
  "reputationScore",
  "sentiment",
  "crmEngine",
  "openai",
  "gpt",
  "mailboxEngine",
  "nodemailer",
  "escalationEngine",
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
  deliveryId: string;
  recipientId: string;
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
  const {
    addCivicDeliveryRecipient,
    createCivicDeliveryDraft,
    listRecommendedCivicDeliveryRecipients,
    sendCivicDelivery,
  } = await import("../modules/civic-delivery/civic-delivery.service.js");

  const draft = createInitiativeDraft(steward, {
    title: "Civic Accountability Initiative",
    description: "Initiative for civic accountability verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(otherParticipant, {
    initiativeId: projected.initiativeId,
    title: "Accountability Analysis",
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
    title: "Civic Accountability Initiative (Revised)",
    description: "Revised.",
    revisionSummary: "Revision summary.",
    appliedProposalIds: [submittedProposal.proposalId],
  });
  publishInitiativeRevision(steward, projected.initiativeId);

  const sessionDraft = createDecisionSessionDraft(steward, {
    initiativeId: projected.initiativeId,
    title: "Accountability Session",
    purpose: "Prepare decision.",
    decisionQuestion: "Should civic accountability proceed?",
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

  const deliveryDraft = createCivicDeliveryDraft(steward, { capId: capPackage.capId });
  const recommendations = listRecommendedCivicDeliveryRecipients(capPackage.capId);
  const recommended = recommendations[0];

  if (!recommended) {
    throw new Error("Recommendation missing");
  }

  addCivicDeliveryRecipient(steward, deliveryDraft.deliveryId, {
    name: recommended.name,
    organization: recommended.organization,
    recipientType: recommended.recipientType,
    email: recommended.email,
    reason: recommended.reason,
    source: "recommended",
  });

  const sent = await sendCivicDelivery(steward, deliveryDraft.deliveryId);
  const recipient = sent.recipients[0];

  if (!recipient) {
    throw new Error("Recipient missing after delivery");
  }

  return {
    capId: capPackage.capId,
    initiativeId: projected.initiativeId,
    decisionId: decisionDraft.decisionId,
    deliveryId: sent.delivery.deliveryId,
    recipientId: recipient.recipientId,
  };
}

async function runVerification(): Promise<void> {
  const { addCivicAccountabilityEvent, archiveCivicAccountability, closeCivicAccountability } =
    await import("../modules/civic-accountability/civic-accountability.service.js");
  const {
    assertPublicProjectionHasNoPrivateFields,
    computeCivicAccountabilityMetrics,
    getPublicCivicAccountability,
    listPublicCivicAccountabilitiesForCap,
  } = await import("../modules/civic-accountability/civic-accountability.projection.js");
  const { getAccountabilityByCapId, getAccountabilityById, listEventsByAccountabilityId } =
    await import("../modules/civic-accountability/civic-accountability.store.js");
  const { buildIntegrationView, buildPipelineStatus } =
    await import("../modules/capability02-integration/capability02-integration.service.js");
  const { createOfficialResponseDraft, publishOfficialResponse } =
    await import("../modules/official-response/official-response.service.js");
  const { getPersistenceMode } =
    await import("../modules/civic-accountability/civic-accountability.store.js");
  const routesSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/civic-accountability/civic-accountability.routes.ts",
    ),
    "utf-8",
  );
  const serviceSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/civic-accountability/civic-accountability.service.ts",
    ),
    "utf-8",
  );
  const storeSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/civic-accountability/civic-accountability.store.ts",
    ),
    "utf-8",
  );

  for (const term of FORBIDDEN_TERMS) {
    assert(!serviceSource.includes(term), `Service must not include ${term}`);
    assert(!storeSource.includes(term), `Store must not include ${term}`);
  }

  assert(
    storeSource.includes("resolveCivicAccountabilityPersistenceAdapter"),
    "Store uses persistence adapter pattern",
  );
  assert(getPersistenceMode() === "memory", "Memory persistence mode active");
  assert(!routesSource.includes(".patch("), "No event update API");
  assert(!routesSource.includes(".delete("), "No event delete API");

  const context = await buildCapContext();

  console.log("1. Accountability starts from civic delivery");
  const fromDelivery = getAccountabilityByCapId(context.capId);
  assert(fromDelivery !== null, "Delivery auto-start created accountability");
  assert(fromDelivery?.status === "active", "Accountability starts active");
  assert(fromDelivery?.deliveryId === context.deliveryId, "Delivery linked");

  console.log("2. Accountability enriches from official response publish");
  const responseDraft = createOfficialResponseDraft(steward, {
    capId: context.capId,
    deliveryId: context.deliveryId,
    recipientId: context.recipientId,
    organizationName: "City of Nelson",
    receivedAt: new Date().toISOString(),
    subject: "Official reply",
    summary: "Institution response summary.",
    responseReference: "REF-2026-042",
    responseType: "official_letter",
  });
  const published = publishOfficialResponse(steward, responseDraft.responseId);
  const fromResponse = getAccountabilityByCapId(context.capId);
  assert(fromResponse?.responseId === published.responseId, "Response linked on publish");

  const accountability = fromDelivery;
  if (!accountability) {
    throw new Error("Accountability missing");
  }

  console.log("3. Eligible recorder can add event");
  const firstEvent = addCivicAccountabilityEvent(steward, accountability.accountabilityId, {
    eventType: "institution_action_reported",
    title: "Council meeting held",
    summary: "The institution reported action at a public meeting.",
    evidenceReference: "MINUTES-2026-01",
    occurredAt: new Date().toISOString(),
  });
  assert(firstEvent.event.eventType === "institution_action_reported", "Event recorded");

  console.log("4. Unauthorized participant cannot add event");
  let unauthorizedFailed = false;
  try {
    addCivicAccountabilityEvent(otherParticipant, accountability.accountabilityId, {
      eventType: "other",
      title: "Blocked",
      summary: "Should fail.",
      occurredAt: new Date().toISOString(),
    });
  } catch {
    unauthorizedFailed = true;
  }
  assert(unauthorizedFailed, "Unauthorized participant rejected");

  console.log("5. Events are immutable");
  assert(listEventsByAccountabilityId(accountability.accountabilityId).length === 1, "One event");

  addCivicAccountabilityEvent(steward, accountability.accountabilityId, {
    eventType: "no_response_observed",
    title: "No response observed",
    summary: "No institutional response within the expected period.",
    occurredAt: new Date(Date.now() - 86_400_000).toISOString(),
  });
  const timeline = listEventsByAccountabilityId(accountability.accountabilityId);
  assert(timeline[0]?.eventType === "institution_action_reported", "Timeline newest first");

  console.log("6. Closed accountability rejects new events");
  closeCivicAccountability(steward, accountability.accountabilityId);
  let closedRejected = false;
  try {
    addCivicAccountabilityEvent(steward, accountability.accountabilityId, {
      eventType: "other",
      title: "After close",
      summary: "Should fail.",
      occurredAt: new Date().toISOString(),
    });
  } catch {
    closedRejected = true;
  }
  assert(closedRejected, "Closed accountability rejects events");

  console.log("7. Archived hidden from default public lists");
  archiveCivicAccountability(steward, accountability.accountabilityId);
  const publicList = listPublicCivicAccountabilitiesForCap(context.capId);
  assert(publicList.length === 0, "Archived accountability hidden from default list");
  const archivedProjection = getPublicCivicAccountability(accountability.accountabilityId);
  assert(archivedProjection !== null, "Archived accountability accessible by direct link");

  console.log("8. Public projection privacy");
  if (!archivedProjection) {
    throw new Error("Archived projection missing");
  }
  assertNoPrivateFields(archivedProjection, "Public accountability projection");
  assert(assertPublicProjectionHasNoPrivateFields(archivedProjection), "Privacy guard");

  console.log("9. Metrics");
  const metrics = computeCivicAccountabilityMetrics();
  assert(metrics.accountabilityCount >= 1, "accountabilityCount");
  assert(metrics.eventCount >= 2, "eventCount");
  assert(metrics.institutionActionReportedCount >= 1, "institutionActionReportedCount");
  assert(metrics.noResponseObservedCount >= 1, "noResponseObservedCount");
  assert(metrics.archivedAccountabilityCount >= 1, "archivedAccountabilityCount");

  console.log("10. Integration layer and notification registry");
  assert(CIVIC_NOTIFICATION_EVENT_REGISTRY.length === 16, "Notification registry has 16 events");
  assert(
    CIVIC_NOTIFICATION_EVENT_REGISTRY.some(
      (event) => event.eventType === "civic_accountability_event_added",
    ),
    "civic_accountability_event_added registered",
  );
  assert(
    CIVIC_NOTIFICATION_EVENT_REGISTRY.some(
      (event) => event.eventType === "civic_accountability_closed",
    ),
    "civic_accountability_closed registered",
  );

  const integrationView = buildIntegrationView(
    "civic_accountability",
    accountability.accountabilityId,
  );
  assert(integrationView !== null, "Integration view resolves");
  if (!integrationView) {
    throw new Error("Integration view resolves");
  }
  assert(
    integrationView.relatedRecords.some((record) => record.entityType === "civic_action_package"),
    "Accountability links to CAP",
  );
  assertNoPrivateFields(integrationView, "Integration view");

  const pipeline = buildPipelineStatus(context.initiativeId);
  const stage = pipeline.stages.find((item) => item.id === "civic_accountability");
  assert(stage?.complete === true, "Pipeline civic_accountability stage complete");

  assert(
    getAccountabilityById(accountability.accountabilityId)?.status === "archived",
    "Final status archived",
  );
}

async function main(): Promise<void> {
  await runVerification();
  console.log("All Civic Accountability checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
