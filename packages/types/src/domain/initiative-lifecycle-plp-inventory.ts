/**
 * RESET 05 — Initiative lifecycle participant-facing semantic inventory.
 *
 * Initiative is the sole canonical civic root. Stage artifacts are inventory
 * rows under the same `initiative_lifecycle` adapter contract — not parallel
 * translation roots. PLP core must not branch on stage names.
 */

import type { PlpFieldOwnershipClass } from "./plp-field-ownership.js";

export type InitiativeLifecyclePlpMigrationStatus =
  | "MIGRATED_CONSUMER"
  | "ADAPTER_READY_CONSUMER_LEGACY"
  | "EXCLUDED";

export type InitiativeLifecyclePlpInventoryRow = {
  readonly stageId: string;
  readonly entityKind: string;
  readonly fieldPath: string;
  readonly ownership: PlpFieldOwnershipClass;
  readonly canonicalSource: string;
  readonly migrationStatus: InitiativeLifecyclePlpMigrationStatus;
  readonly exclusionReason?:
    | "UI_DICTIONARY"
    | "BRAND"
    | "LEGAL"
    | "CONTROLLED_VOCABULARY"
    | "PROTECTED_CANONICAL"
    | "NON_LOCALIZABLE_DATA"
    | "PRIVACY_INELIGIBLE";
};

/**
 * Participant-facing semantic fields across the public Initiative lifecycle.
 * Status labels / chrome remain UI_DICTIONARY (excluded from MACHINE trees).
 */
export const INITIATIVE_LIFECYCLE_PLP_INVENTORY = [
  // Initiative root / country rails (consumer migrated)
  {
    stageId: "initiative",
    entityKind: "initiative",
    fieldPath: "title",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "Initiative.title",
    migrationStatus: "MIGRATED_CONSUMER",
  },
  {
    stageId: "initiative",
    entityKind: "initiative",
    fieldPath: "summary",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "Initiative.summary",
    migrationStatus: "MIGRATED_CONSUMER",
  },
  {
    stageId: "initiative",
    entityKind: "initiative",
    fieldPath: "activityArea",
    ownership: "CONTROLLED_VOCABULARY",
    canonicalSource: "INITIATIVE_ACTIVITY_AREA_OPTIONS",
    migrationStatus: "MIGRATED_CONSUMER",
    exclusionReason: "CONTROLLED_VOCABULARY",
  },
  {
    stageId: "initiative",
    entityKind: "initiative",
    fieldPath: "geographyLabel",
    ownership: "PROTECTED_CANONICAL",
    canonicalSource: "GEOGRAPHY codes → formatPublicGeography(locale)",
    migrationStatus: "MIGRATED_CONSUMER",
    exclusionReason: "PROTECTED_CANONICAL",
  },
  {
    stageId: "initiative",
    entityKind: "initiative",
    fieldPath: "publicStatus",
    ownership: "UI_DICTIONARY",
    canonicalSource: "initiativeExperience.statuses.*",
    migrationStatus: "EXCLUDED",
    exclusionReason: "UI_DICTIONARY",
  },
  // Discussion (public only)
  {
    stageId: "discussion",
    entityKind: "discussion_comment",
    fieldPath: "body",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "DiscussionComment.body (visibility=public)",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  // Collaborative Analysis
  {
    stageId: "collaborative_analysis",
    entityKind: "collaborative_analysis",
    fieldPath: "title",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "CollaborativeAnalysis.title",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  {
    stageId: "collaborative_analysis",
    entityKind: "collaborative_analysis",
    fieldPath: "summary",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "CollaborativeAnalysis.summary",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  // Improvement Proposals
  {
    stageId: "improvement_proposal",
    entityKind: "improvement_proposal",
    fieldPath: "currentIssue",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "ImprovementProposal.currentIssue",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  {
    stageId: "improvement_proposal",
    entityKind: "improvement_proposal",
    fieldPath: "proposedChange",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "ImprovementProposal.proposedChange",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  {
    stageId: "improvement_proposal",
    entityKind: "improvement_proposal",
    fieldPath: "rationale",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "ImprovementProposal.rationale",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  // Revision
  {
    stageId: "initiative_revision",
    entityKind: "initiative_revision",
    fieldPath: "title",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "InitiativeRevision.title",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  {
    stageId: "initiative_revision",
    entityKind: "initiative_revision",
    fieldPath: "description",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "InitiativeRevision.description",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  // Petition
  {
    stageId: "petition",
    entityKind: "petition",
    fieldPath: "title",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "Petition.title",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  {
    stageId: "petition",
    entityKind: "petition",
    fieldPath: "summary",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "Petition.summary",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  // Decision Session
  {
    stageId: "decision_session",
    entityKind: "decision_session",
    fieldPath: "title",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "DecisionSession.title",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  {
    stageId: "decision_session",
    entityKind: "decision_session",
    fieldPath: "decisionQuestion",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "DecisionSession.decisionQuestion",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  // Collective Decision
  {
    stageId: "collective_decision",
    entityKind: "collective_decision",
    fieldPath: "question",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "CollectiveDecision.question",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  {
    stageId: "collective_decision",
    entityKind: "collective_decision",
    fieldPath: "outcomeSummary",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "CollectiveDecision.outcomeSummary",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  // Implementation Commitments
  {
    stageId: "implementation_commitment",
    entityKind: "implementation_commitment",
    fieldPath: "title",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "ImplementationCommitment.title",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  {
    stageId: "implementation_commitment",
    entityKind: "implementation_commitment",
    fieldPath: "summary",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "ImplementationCommitment.summary",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  // Implementation Tracking
  {
    stageId: "implementation_tracking",
    entityKind: "implementation_tracking",
    fieldPath: "summary",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "ImplementationTracking.summary",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  {
    stageId: "implementation_tracking",
    entityKind: "implementation_tracking",
    fieldPath: "currentStage",
    ownership: "UI_DICTIONARY",
    canonicalSource: "lifecycle stage chrome",
    migrationStatus: "EXCLUDED",
    exclusionReason: "UI_DICTIONARY",
  },
  // Official Responses
  {
    stageId: "official_response",
    entityKind: "official_response",
    fieldPath: "subject",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "OfficialResponse.subject",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  {
    stageId: "official_response",
    entityKind: "official_response",
    fieldPath: "summary",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "OfficialResponse.summary",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  // Public Impact
  {
    stageId: "public_impact",
    entityKind: "public_impact",
    fieldPath: "title",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "PublicImpact.title",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  {
    stageId: "public_impact",
    entityKind: "public_impact",
    fieldPath: "summary",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "PublicImpact.summary",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  // Civic Archive
  {
    stageId: "civic_archive",
    entityKind: "civic_archive",
    fieldPath: "title",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "CivicArchive.title",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
  {
    stageId: "civic_archive",
    entityKind: "civic_archive",
    fieldPath: "summary",
    ownership: "MACHINE_CONTENT",
    canonicalSource: "CivicArchive.summary",
    migrationStatus: "ADAPTER_READY_CONSUMER_LEGACY",
  },
] as const satisfies readonly InitiativeLifecyclePlpInventoryRow[];

/** Stages that must appear in the inventory (closure gate). */
export const INITIATIVE_LIFECYCLE_REQUIRED_STAGE_IDS = [
  "initiative",
  "discussion",
  "collaborative_analysis",
  "improvement_proposal",
  "initiative_revision",
  "petition",
  "decision_session",
  "collective_decision",
  "implementation_commitment",
  "implementation_tracking",
  "official_response",
  "public_impact",
  "civic_archive",
] as const;

export function listInitiativeLifecycleInventoryStages(): readonly string[] {
  return [
    ...new Set(INITIATIVE_LIFECYCLE_PLP_INVENTORY.map((row) => row.stageId)),
  ];
}

/**
 * Semantic closure: every required lifecycle stage has ≥1 owned inventory row;
 * every MACHINE_CONTENT row has explicit migration status (no silent orphans).
 */
export function evaluateInitiativeLifecycleSemanticClosure(): {
  readonly ok: boolean;
  readonly missingStages: readonly string[];
  readonly unownedMachineRows: readonly string[];
} {
  const stages = new Set(listInitiativeLifecycleInventoryStages());
  const missingStages = INITIATIVE_LIFECYCLE_REQUIRED_STAGE_IDS.filter(
    (id) => !stages.has(id),
  );
  const unownedMachineRows = (
    INITIATIVE_LIFECYCLE_PLP_INVENTORY as readonly InitiativeLifecyclePlpInventoryRow[]
  )
    .filter(
      (row) =>
        row.ownership === "MACHINE_CONTENT" &&
        row.migrationStatus !== "MIGRATED_CONSUMER" &&
        row.migrationStatus !== "ADAPTER_READY_CONSUMER_LEGACY",
    )
    .map((row) => `${row.stageId}.${row.fieldPath}`);

  return {
    ok: missingStages.length === 0 && unownedMachineRows.length === 0,
    missingStages,
    unownedMachineRows,
  };
}
