/**
 * TASK-038 — Capability 02 Integration Layer verification.
 * Run: npm run verify:capability02-integration
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CIVIC_NOTIFICATION_EVENT_REGISTRY, type CivicEntityType } from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const author: RequestIdentity = {
  participantId: "member-int-author",
  displayName: "Integration Author",
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

const SCRIPT_PATH = fileURLToPath(import.meta.url);

const EXPECTED_PIPELINE_STAGE_IDS = [
  "initiative",
  "analysis",
  "proposal",
  "revision",
  "decision_session",
  "collective_decision",
  "civic_action_package",
  "official_response",
  "civic_accountability",
  "commitment",
  "tracking",
  "public_impact",
  "archive",
] as const;

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
      displayName: author.displayName ?? "Integration Author",
      uniqueName: "integration-author",
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

async function buildPipelineContext(): Promise<{
  initiativeId: string;
  trackingId: string;
  impactId: string;
  decisionId: string;
  commitmentId: string;
  analysisId: string;
  proposalId: string;
  sessionId: string;
  capId: string;
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
  const { getCivicActionPackageForDecision } =
    await import("../modules/civic-action-package/civic-action-package.service.js");
  const {
    addCivicDeliveryRecipient,
    createCivicDeliveryDraft,
    listRecommendedCivicDeliveryRecipients,
    sendCivicDelivery,
  } = await import("../modules/civic-delivery/civic-delivery.service.js");
  const { createOfficialResponseDraft, publishOfficialResponse } =
    await import("../modules/official-response/official-response.service.js");

  const draft = createInitiativeDraft(steward, {
    title: "Integration Layer Initiative",
    description: "Initiative for integration verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(otherParticipant, {
    initiativeId: projected.initiativeId,
    title: "Integration Analysis",
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
  const decidedProposal = decideInitiativeImprovementProposal(
    steward,
    submittedProposal.proposalId,
    {
      decision: "accepted",
      decisionNote: "Accepted.",
    },
  );

  createInitiativeRevisionDraft(steward, projected.initiativeId);
  saveInitiativeRevisionDraft(steward, projected.initiativeId, {
    title: "Integration Layer Initiative (Revised)",
    description: "Revised.",
    revisionSummary: "Revision summary.",
    appliedProposalIds: [decidedProposal.proposalId],
  });
  publishInitiativeRevision(steward, projected.initiativeId);

  const sessionDraft = createDecisionSessionDraft(steward, {
    initiativeId: projected.initiativeId,
    title: "Integration Session",
    purpose: "Prepare decision.",
    decisionQuestion: "Proceed?",
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

  const responseDraft = createOfficialResponseDraft(steward, {
    capId: capPackage.capId,
    deliveryId: sent.delivery.deliveryId,
    recipientId: recipient.recipientId,
    organizationName: "City of Nelson",
    receivedAt: new Date().toISOString(),
    subject: "Official reply",
    summary: "Institution response summary.",
    responseReference: "REF-2026-INT",
    responseType: "official_letter",
  });
  publishOfficialResponse(steward, responseDraft.responseId);

  const commitmentDraft = createInitiativeImplementationCommitmentDraft(author, {
    initiativeId: projected.initiativeId,
    decisionId: decisionDraft.decisionId,
    commitmentTitle: "Integration Commitment",
    commitmentSummary: "Commitment summary.",
    commitmentScope: "Scope.",
  });
  const publishedCommitment = publishInitiativeImplementationCommitment(
    author,
    commitmentDraft.commitmentId,
  );

  const trackingDraft = createInitiativeImplementationTrackingDraft(author, {
    commitmentId: publishedCommitment.commitmentId,
    currentStage: "Completed",
    summary: "Tracking summary.",
  });
  activateInitiativeImplementationTracking(author, trackingDraft.trackingId);
  addImplementationTrackingUpdate(author, trackingDraft.trackingId, {
    title: "Update",
    summary: "Update summary.",
    evidence: "https://example.org/evidence",
  });
  completeInitiativeImplementationTracking(author, trackingDraft.trackingId);

  const impactDraft = createInitiativePublicImpactDraft(author, {
    trackingId: trackingDraft.trackingId,
    title: "Integration Impact",
    summary: "Impact summary.",
    observedImpact: "Observed impact.",
    affectedCommunity: "Nelson Community Garden",
    evidenceSummary: "Evidence summary.",
  });
  addPublicImpactEvidence(author, impactDraft.impactId, {
    title: "Evidence",
    description: "Evidence description.",
    referenceUrl: "https://example.org/evidence.pdf",
    referenceType: "document",
  });
  publishInitiativePublicImpact(author, impactDraft.impactId);
  verifyInitiativePublicImpact(steward, impactDraft.impactId);

  return {
    initiativeId: projected.initiativeId,
    trackingId: trackingDraft.trackingId,
    impactId: impactDraft.impactId,
    decisionId: decisionDraft.decisionId,
    commitmentId: publishedCommitment.commitmentId,
    analysisId: analysis.analysisId,
    proposalId: decidedProposal.proposalId,
    sessionId: sessionDraft.sessionId,
    capId: capPackage.capId,
  };
}

async function runVerification(): Promise<void> {
  const {
    buildIntegrationView,
    buildBreadcrumb,
    buildPipelineStatus,
    buildSearchMetadata,
    resolveRelatedRecords,
  } = await import("../modules/capability02-integration/capability02-integration.service.js");

  const serviceSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/capability02-integration/capability02-integration.service.ts",
    ),
    "utf-8",
  );

  assert(
    !serviceSource.includes("new Map<"),
    "Integration service must not duplicate entity storage",
  );

  await seedAuthors();
  const context = await buildPipelineContext();

  console.log("1. Related records resolve correctly");
  const initiativeRelated = resolveRelatedRecords("initiative", context.initiativeId);
  assert(initiativeRelated.length > 0, "Initiative related records resolve");
  assert(
    initiativeRelated.every((record) => record.publicUrl.startsWith("/")),
    "Related record URLs are valid",
  );

  console.log("2. Breadcrumb generation");
  const breadcrumb = buildBreadcrumb("implementation_tracking", context.trackingId);
  assert(breadcrumb.length >= 3, "Breadcrumb includes civic path");
  assert(breadcrumb[0]?.label === "Home", "Breadcrumb starts at Home");

  console.log("3. Pipeline widget");
  const pipeline = buildPipelineStatus(context.initiativeId);
  assert(
    pipeline.stages.length === EXPECTED_PIPELINE_STAGE_IDS.length,
    "Pipeline includes all civic stages",
  );
  assert(
    pipeline.stages.map((stage) => stage.id).join(",") === EXPECTED_PIPELINE_STAGE_IDS.join(","),
    "Pipeline stage order matches integration contract",
  );
  assert(
    pipeline.stages.find((stage) => stage.id === "civic_action_package")?.complete === true,
    "Pipeline civic_action_package stage complete",
  );
  assert(
    pipeline.stages.find((stage) => stage.id === "official_response")?.complete === true,
    "Pipeline official_response stage complete",
  );
  assert(
    pipeline.stages.find((stage) => stage.id === "civic_accountability")?.complete === true,
    "Pipeline civic_accountability stage complete",
  );
  assert(
    pipeline.stages.filter((stage) => stage.id !== "archive").every((stage) => stage.complete),
    "Pipeline complete through public impact before archive",
  );
  assert(!pipeline.stages.find((stage) => stage.id === "archive")?.complete, "Archive pending");
  assert(
    pipeline.currentStageId === "public_impact",
    "Current stage reflects latest completed work",
  );

  console.log("4. Context panel and integration view");
  const initiativeView = buildIntegrationView("initiative", context.initiativeId);
  assert(initiativeView !== null, "Initiative integration view resolves");
  if (!initiativeView) {
    throw new Error("Initiative integration view resolves");
  }
  assert(initiativeView.context.relatedSections.length > 0, "Context panel sections populated");
  assertNoPrivateFields(initiativeView, "Integration view");

  const trackingView = buildIntegrationView("implementation_tracking", context.trackingId);
  assert(trackingView !== null, "Tracking integration view resolves");
  if (!trackingView) {
    throw new Error("Tracking integration view resolves");
  }
  assert(
    trackingView.relatedRecords.some((record) => record.entityType === "public_impact"),
    "Tracking links to public impact",
  );

  console.log("5. Shared references and search metadata");
  const metadata = buildSearchMetadata("public_impact", context.impactId);
  assert(metadata !== null, "Search metadata contract resolves");
  if (!metadata) {
    throw new Error("Search metadata contract resolves");
  }
  assert(metadata.entityType === "public_impact", "Search metadata entity type");
  assert(metadata.publicUrl.startsWith("/public-impact/"), "Search metadata publicUrl set");

  console.log("6. Notification registry");
  assert(CIVIC_NOTIFICATION_EVENT_REGISTRY.length === 16, "Notification registry has 16 events");
  assert(
    CIVIC_NOTIFICATION_EVENT_REGISTRY.some(
      (event) => event.eventType === "official_response_received",
    ),
    "Official response received event registered",
  );
  assert(
    CIVIC_NOTIFICATION_EVENT_REGISTRY.some((event) => event.eventType === "archive_published"),
    "Archive published event registered",
  );

  console.log("7. Cross-entity integration after archive");
  const { createPublicCivicArchiveDraft, publishPublicCivicArchive } =
    await import("../modules/public-civic-archive/public-civic-archive.service.js");
  const archiveDraft = createPublicCivicArchiveDraft(author, {
    impactId: context.impactId,
    title: "Integration Archive",
    summary: "Archive summary.",
    lessonsLearned: {
      whatWorked: "Worked.",
      whatDidNotWork: "Did not.",
      recommendationsForFuture: "Recommend.",
      transferableExperience: "Transfer.",
    },
    knowledgeContribution: {
      socialBenefits: "Social.",
      environmentalBenefits: "Environmental.",
      economicBenefits: "Economic.",
      governanceBenefits: "Governance.",
      educationalBenefits: "Educational.",
      additionalObservations: "Observations.",
    },
  });
  publishPublicCivicArchive(steward, archiveDraft.archiveRecordId);

  const archivedPipeline = buildPipelineStatus(context.initiativeId);
  const archiveStageComplete = archivedPipeline.stages.find(
    (stage) => stage.id === "archive",
  )?.complete;
  assert(archiveStageComplete === true, "Archive stage completes pipeline");

  const archiveView = buildIntegrationView("civic_archive", archiveDraft.archiveRecordId);
  assert(archiveView !== null, "Archive integration view resolves");
  if (!archiveView) {
    throw new Error("Archive integration view resolves");
  }
  assert(
    archiveView.relatedRecords.length >= initiativeRelated.length - 1,
    "Archive exposes civic history references",
  );

  const entityChecks: Array<[CivicEntityType, string]> = [
    ["analysis", context.analysisId],
    ["improvement_proposal", context.proposalId],
    ["decision_session", context.sessionId],
    ["collective_decision", context.decisionId],
    ["implementation_commitment", context.commitmentId],
  ];

  for (const [entityType, entityId] of entityChecks) {
    const view = buildIntegrationView(entityType, entityId);
    assert(view !== null, `${entityType} integration view resolves`);
    if (!view) {
      throw new Error(`${entityType} integration view resolves`);
    }
    assert(view.breadcrumb.length >= 2, `${entityType} breadcrumb resolves`);
  }
}

async function main(): Promise<void> {
  await runVerification();
  console.log("All Capability 02 integration checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
