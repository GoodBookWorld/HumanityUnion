/**
 * Production Completion Pack 02F Task 02 — code-seeded terminology catalog.
 * Single source of allowed conceptIds + immutable English metadata.
 */

import type {
  TerminologyConcept,
  TerminologyConceptCategory,
  TerminologyConceptLinkedRefs,
} from "@hu/types";

const SEED_TIMESTAMP = "2026-08-31T00:00:00.000Z";

export interface TerminologyGlossarySeedDefinition {
  readonly conceptId: string;
  readonly canonicalEnglishTerm: string;
  readonly category: TerminologyConceptCategory;
  readonly linkedRefs?: TerminologyConceptLinkedRefs;
}

/**
 * Exact Pack 02F Task 02 core seeds.
 * Order is stable and used for English provider terminologyContext compatibility.
 */
export const TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS: readonly TerminologyGlossarySeedDefinition[] = [
  {
    conceptId: "humanity_union",
    canonicalEnglishTerm: "Humanity Union",
    category: "brand",
  },
  {
    conceptId: "participant",
    canonicalEnglishTerm: "Participant",
    category: "domain",
  },
  {
    conceptId: "member",
    canonicalEnglishTerm: "Member",
    category: "domain",
  },
  {
    conceptId: "membership",
    canonicalEnglishTerm: "Membership",
    category: "domain",
  },
  {
    conceptId: "workspace",
    canonicalEnglishTerm: "Workspace",
    category: "domain",
  },
  {
    conceptId: "initiative",
    canonicalEnglishTerm: "Initiative",
    category: "workflow_stage",
    linkedRefs: { stageId: "initiative", civicEntityType: "initiative" },
  },
  {
    conceptId: "discussion",
    canonicalEnglishTerm: "Discussion",
    category: "workflow_stage",
    linkedRefs: { stageId: "discussion" },
  },
  {
    conceptId: "collaborative_analysis",
    canonicalEnglishTerm: "Collaborative Analysis",
    category: "workflow_stage",
    linkedRefs: { stageId: "analysis", civicEntityType: "analysis" },
  },
  {
    conceptId: "improvement_proposal",
    canonicalEnglishTerm: "Improvement Proposal",
    category: "workflow_stage",
    linkedRefs: { stageId: "proposal", civicEntityType: "improvement_proposal" },
  },
  {
    conceptId: "revision",
    canonicalEnglishTerm: "Revision",
    category: "workflow_stage",
    // Content/history stageId exists on the type union but is not in the
    // public INITIATIVE_LIFECYCLE_STAGE_REGISTRY route list — link entity only.
    linkedRefs: { civicEntityType: "initiative_revision" },
  },
  {
    conceptId: "petition",
    canonicalEnglishTerm: "Petition",
    category: "workflow_stage",
    linkedRefs: { stageId: "petition", civicEntityType: "petition" },
  },
  {
    conceptId: "decision_session",
    canonicalEnglishTerm: "Decision Session",
    category: "workflow_stage",
    linkedRefs: { stageId: "decision_session", civicEntityType: "decision_session" },
  },
  {
    conceptId: "collective_decision",
    canonicalEnglishTerm: "Collective Decision",
    category: "workflow_stage",
    linkedRefs: { stageId: "collective_decision", civicEntityType: "collective_decision" },
  },
  {
    conceptId: "implementation_commitment",
    canonicalEnglishTerm: "Implementation Commitment",
    category: "workflow_stage",
    linkedRefs: { stageId: "commitment", civicEntityType: "implementation_commitment" },
  },
  {
    conceptId: "implementation_tracking",
    canonicalEnglishTerm: "Implementation Tracking",
    category: "workflow_stage",
    linkedRefs: { stageId: "tracking", civicEntityType: "implementation_tracking" },
  },
  {
    conceptId: "official_response",
    canonicalEnglishTerm: "Official Response",
    category: "workflow_stage",
    linkedRefs: { stageId: "official_response", civicEntityType: "official_response" },
  },
  {
    conceptId: "public_impact",
    canonicalEnglishTerm: "Public Impact",
    category: "workflow_stage",
    linkedRefs: { stageId: "public_impact", civicEntityType: "public_impact" },
  },
  {
    conceptId: "civic_archive",
    canonicalEnglishTerm: "Civic Archive",
    category: "workflow_stage",
    linkedRefs: { stageId: "archive", civicEntityType: "civic_archive" },
  },
  {
    conceptId: "civic_media",
    canonicalEnglishTerm: "Civic Media",
    category: "ui",
    linkedRefs: { civicEntityType: "knowledge_media" },
  },
  {
    conceptId: "assistant",
    canonicalEnglishTerm: "Assistant",
    category: "ui",
  },
  {
    conceptId: "active_ally",
    canonicalEnglishTerm: "Active Ally",
    category: "domain",
  },
  {
    conceptId: "ready_to_collaborate",
    canonicalEnglishTerm: "Ready to Collaborate",
    category: "domain",
  },
] as const;

const SEED_BY_CONCEPT_ID = new Map(
  TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.map((definition) => [definition.conceptId, definition]),
);

export function getTerminologyGlossarySeedDefinition(
  conceptId: string,
): TerminologyGlossarySeedDefinition | null {
  return SEED_BY_CONCEPT_ID.get(conceptId.trim()) ?? null;
}

export function isSeededTerminologyConceptId(conceptId: string): boolean {
  return SEED_BY_CONCEPT_ID.has(conceptId.trim());
}

export function listSeededTerminologyConceptIds(): readonly string[] {
  return TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.map((definition) => definition.conceptId);
}

/**
 * English provider terminologyContext — derived from the seeded catalog only.
 * Compatibility fallback when locale-aware glossary context is unavailable.
 */
export function buildEnglishProviderTerminologyContext(
  definitions: readonly TerminologyGlossarySeedDefinition[] = TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS,
): string {
  return definitions.map((definition) => definition.canonicalEnglishTerm).join(", ");
}

export function buildTerminologyConceptFromSeed(
  definition: TerminologyGlossarySeedDefinition,
  nowIso: string = SEED_TIMESTAMP,
): TerminologyConcept {
  return {
    conceptId: definition.conceptId,
    canonicalEnglishTerm: definition.canonicalEnglishTerm,
    category: definition.category,
    ...(definition.linkedRefs ? { linkedRefs: { ...definition.linkedRefs } } : {}),
    translations: {},
    status: "published",
    createdAt: nowIso,
    updatedAt: nowIso,
    updatedByParticipantId: null,
  };
}

/**
 * Reconcile code-owned immutable metadata onto an existing record.
 * Never touches translations, status, or audit actor fields.
 */
export function reconcileSeededImmutableMetadata(
  existing: TerminologyConcept,
  definition: TerminologyGlossarySeedDefinition,
  nowIso: string,
): TerminologyConcept {
  const linkedRefsChanged =
    JSON.stringify(existing.linkedRefs ?? null) !== JSON.stringify(definition.linkedRefs ?? null);
  const needsReconcile =
    existing.canonicalEnglishTerm !== definition.canonicalEnglishTerm ||
    existing.category !== definition.category ||
    linkedRefsChanged;

  if (!needsReconcile) {
    return existing;
  }

  return {
    ...existing,
    canonicalEnglishTerm: definition.canonicalEnglishTerm,
    category: definition.category,
    ...(definition.linkedRefs
      ? { linkedRefs: { ...definition.linkedRefs } }
      : { linkedRefs: undefined }),
    updatedAt: nowIso,
  };
}
