/**
 * TASK-041 — Official Response Engine verification.
 * Run: npm run verify:official-response
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
  "verifiedByParticipantId",
  "senderParticipantId",
  "authorId",
  "memberId",
  "email",
  "stewardId",
  "providerMetadata",
  "messageHeaders",
  "rawSource",
  "replyToken",
  "messageId",
];

const FORBIDDEN_TERMS = [
  "mailboxEngine",
  "incomingMailbox",
  "nodemailer",
  "createTransport",
  "IMAP",
  "POP3",
  "Google Workspace",
  "Microsoft Exchange",
  "openai",
  "gpt",
  "sentiment",
  "reputationScore",
  "ocr",
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

async function buildDeliveryContext(): Promise<{
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
    title: "Official Response Initiative",
    description: "Initiative for official response verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(otherParticipant, {
    initiativeId: projected.initiativeId,
    title: "Response Analysis",
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
    title: "Official Response Initiative (Revised)",
    description: "Revised.",
    revisionSummary: "Revision summary.",
    appliedProposalIds: [submittedProposal.proposalId],
  });
  publishInitiativeRevision(steward, projected.initiativeId);

  const sessionDraft = createDecisionSessionDraft(steward, {
    initiativeId: projected.initiativeId,
    title: "Response Session",
    purpose: "Prepare decision.",
    decisionQuestion: "Should official responses proceed?",
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
  const {
    createOfficialResponseDraft,
    publishOfficialResponse,
    verifyOfficialResponse,
    archiveOfficialResponse,
  } = await import("../modules/official-response/official-response.service.js");
  const {
    assertPublicProjectionHasNoPrivateFields,
    computeOfficialResponseMetrics,
    getPublicOfficialResponse,
    listPublicOfficialResponsesForCap,
    listPublicOfficialResponsesForInitiative,
  } = await import("../modules/official-response/official-response.projection.js");
  const { getOfficialResponseIdentity, ensureOfficialResponseIdentity } =
    await import("../modules/official-response/official-response-identity.js");
  const { buildIntegrationView, buildPipelineStatus } =
    await import("../modules/capability02-integration/capability02-integration.service.js");
  const { getPersistenceMode } =
    await import("../modules/official-response/official-response.store.js");

  const serviceSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/official-response/official-response.service.ts",
    ),
    "utf-8",
  );
  const storeSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/official-response/official-response.store.ts",
    ),
    "utf-8",
  );
  const identitySource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/official-response/official-response-identity.ts",
    ),
    "utf-8",
  );

  for (const term of FORBIDDEN_TERMS) {
    assert(!serviceSource.includes(term), `Service must not include ${term}`);
    assert(!storeSource.includes(term), `Store must not include ${term}`);
    assert(!identitySource.includes(term), `Identity module must not include ${term}`);
  }

  assert(
    storeSource.includes("resolveOfficialResponsePersistenceAdapter"),
    "Store uses persistence adapter pattern",
  );
  assert(getPersistenceMode() === "memory", "Memory persistence mode active");

  const context = await buildDeliveryContext();

  console.log("1. Reply identity architecture (no mailbox)");
  ensureOfficialResponseIdentity(context.capId);
  const identity = getOfficialResponseIdentity(context.capId);
  assert(identity !== null, "Reply identity created for CAP");
  if (!identity) {
    throw new Error("Reply identity created for CAP");
  }
  assert(identity.replyIdentifier.startsWith("CAP-"), "Reply identifier uses CAP prefix");
  assert(!identitySource.includes("smtp"), "No SMTP in identity module");

  console.log("2. Draft response created with response numbering");
  const draft = createOfficialResponseDraft(steward, {
    capId: context.capId,
    deliveryId: context.deliveryId,
    recipientId: context.recipientId,
    organizationName: "City of Nelson",
    receivedAt: new Date().toISOString(),
    subject: "Official reply",
    summary: "The institution acknowledges receipt of the Civic Action Package.",
    responseReference: "REF-2026-001",
    responseType: "official_letter",
    rawSource: "PRIVATE RAW BODY",
    messageHeaders: { "X-Test": "private" },
    providerMetadata: { internal: true },
  });
  assert(draft.publicationStatus === "draft", "Response starts as draft");
  assert(draft.verificationState === "pending", "Verification starts pending");
  assert(/^RESP-\d{4}-\d{6}$/.test(draft.responseNumber), "Response number format");

  const secondDraft = createOfficialResponseDraft(steward, {
    capId: context.capId,
    deliveryId: context.deliveryId,
    recipientId: context.recipientId,
    organizationName: "City of Nelson",
    receivedAt: new Date(Date.now() - 86_400_000).toISOString(),
    subject: "Earlier reply",
    summary: "Earlier institutional response for timeline ordering.",
    responseReference: "REF-2026-000",
    responseType: "email",
  });
  assert(secondDraft.responseNumber !== draft.responseNumber, "Response numbers are unique");

  console.log("3. Publish and verification lifecycle");
  const published = publishOfficialResponse(steward, draft.responseId);
  assert(published.publicationStatus === "published", "Response published");
  assert(published.publishedAt !== undefined, "Published timestamp set");

  let authorVerifyFailed = false;
  try {
    verifyOfficialResponse(otherParticipant, published.responseId, "verified");
  } catch {
    authorVerifyFailed = true;
  }
  assert(authorVerifyFailed, "Non-steward cannot verify");

  const verified = verifyOfficialResponse(steward, published.responseId, "verified");
  assert(verified.verificationState === "verified", "Steward verified response");
  assert(verified.verifiedAt !== undefined, "Verified timestamp set");

  publishOfficialResponse(steward, secondDraft.responseId);
  verifyOfficialResponse(steward, secondDraft.responseId, "unable_to_verify");

  console.log("4. Timeline ordering (newest first)");
  const timeline = listPublicOfficialResponsesForCap(context.capId);
  assert(timeline.length === 2, "Timeline lists published responses");
  assert(
    timeline[0]?.responseId === draft.responseId,
    "Newest response appears first by receivedAt",
  );

  console.log("5. Public projection and privacy");
  const projection = getPublicOfficialResponse(draft.responseId);
  assert(projection !== null, "Public detail projection resolves");
  if (!projection) {
    throw new Error("Public detail projection resolves");
  }
  assert(projection.references.capUrl.includes(context.capId), "CAP reference link");
  assertNoPrivateFields(projection, "Public response projection");
  assert(assertPublicProjectionHasNoPrivateFields(projection), "Projection privacy guard");

  const initiativeTimeline = listPublicOfficialResponsesForInitiative(context.initiativeId);
  assert(initiativeTimeline.length === 2, "Initiative timeline lists responses");

  console.log("6. Metrics");
  const metrics = computeOfficialResponseMetrics();
  assert(metrics.responseCount === 2, "responseCount");
  assert(metrics.verifiedResponseCount === 1, "verifiedResponseCount");
  assert(metrics.unableToVerifyCount === 1, "unableToVerifyCount");
  assert(metrics.pendingResponseCount === 0, "pendingResponseCount");
  assert(metrics.recipientCoverage === 1, "recipientCoverage");
  assert(metrics.responseTypes.official_letter === 1, "responseTypes.official_letter");
  assert(metrics.responseTypes.email === 1, "responseTypes.email");

  console.log("7. Integration layer and notification registry");
  assert(CIVIC_NOTIFICATION_EVENT_REGISTRY.length === 14, "Notification registry has 14 events");
  assert(
    CIVIC_NOTIFICATION_EVENT_REGISTRY.some(
      (event) => event.eventType === "official_response_received",
    ),
    "official_response_received registered",
  );
  assert(
    CIVIC_NOTIFICATION_EVENT_REGISTRY.some(
      (event) => event.eventType === "official_response_verified",
    ),
    "official_response_verified registered",
  );

  const integrationView = buildIntegrationView("official_response", draft.responseId);
  assert(integrationView !== null, "Integration view for official response");
  if (!integrationView) {
    throw new Error("Integration view for official response");
  }
  assert(
    integrationView.relatedRecords.some((record) => record.entityType === "civic_action_package"),
    "Response links to CAP",
  );
  assert(
    integrationView.context.relatedSections.some((section) => section.id === "official-responses"),
    "Context includes official responses section when applicable",
  );
  assertNoPrivateFields(integrationView, "Integration view");

  const pipeline = buildPipelineStatus(context.initiativeId);
  const responseStage = pipeline.stages.find((stage) => stage.id === "official_response");
  assert(responseStage?.complete === true, "Pipeline official_response stage complete");

  console.log("8. Archive transition");
  const archived = archiveOfficialResponse(steward, draft.responseId);
  assert(archived.publicationStatus === "archived", "Response archived by steward");
}

async function main(): Promise<void> {
  await runVerification();
  console.log("All Official Response Engine checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
