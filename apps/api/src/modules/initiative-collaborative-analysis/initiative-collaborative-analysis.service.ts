import type { DirectInitiativeAncestry, Initiative, InitiativeCollaborativeAnalysis } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { assertInitiativeCollaborativeAnalysisOwnership } from "./initiative-collaborative-analysis-ownership.js";
import {
  createAnalysis,
  getAnalysisById,
  listAnalysesByAuthor,
  listAnalysesByInitiative,
  listAnalysesByInitiativeAndAuthor,
  updateAnalysis,
} from "./initiative-collaborative-analysis.store.js";
import {
  type CreateInitiativeCollaborativeAnalysisDraftInput,
  type SaveInitiativeCollaborativeAnalysisDraftInput,
  validateInitiativeCollaborativeAnalysisForPublication,
} from "./initiative-collaborative-analysis.validators.js";
import { resolveInitiativeVersionForNewAnalysis } from "../initiative-version-revision/initiative-version-revision.service.js";
import { invalidateCommunityIntelligenceCache } from "../community-intelligence/community-intelligence-cache.js";
import { emitCivicNotificationEvent } from "../notifications/notification.service.js";
import { validateDirectInitiativeAncestry } from "../../shared/initiative-ancestry/index.js";
import { buildInitiativeAnalysisSourceSnapshot } from "./initiative-analysis-source-snapshot.service.js";
import { generateAnalysisDraft } from "./initiative-analysis-draft-builder.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";

/**
 * Initiative Ancestry — Recovery Task 06.
 *
 * Initiative Collaborative Analysis is the analytical first stage of the
 * canonical Initiative lifecycle (see
 * architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md). It
 * exists to organize collaborative discussion, structured contributions,
 * evidence collection, and analytical refinement about an Initiative. It
 * does NOT make collective decisions, does NOT approve implementation, and
 * does NOT become an independent civic root — every analysis uses DIRECT
 * Initiative ancestry (it stores its own `initiativeId`, never derived
 * transitively through another artifact).
 *
 * As of this task, `createInitiativeCollaborativeAnalysisDraft` — not the
 * Express route — is the enforcement boundary for that invariant: it
 * validates ancestry via the shared `validateDirectInitiativeAncestry`
 * before any persistence is attempted, so a direct caller of this service
 * (bypassing the route) receives the same guarantee as an HTTP request.
 * Route-level validation (`validateCreateInitiativeCollaborativeAnalysisDraftInput`)
 * remains useful for request-shape parsing, but is not trusted as the sole
 * invariant boundary.
 *
 * The pre-existing "published or projected" lifecycle-phase eligibility rule
 * is a distinct, module-specific business rule (not a generic ancestry
 * concern) and is intentionally kept as a separate check performed
 * immediately after ancestry succeeds, reusing the same single Initiative
 * lookup rather than issuing a second one.
 *
 * Persistence is unchanged: analyses continue to store a plain
 * `initiativeId` string (see `@hu/types` `InitiativeCollaborativeAnalysis`),
 * not a nested ancestry object. The validated ancestry result is used only
 * to source that field and the `initiativeVersion` lookup.
 */
export interface InitiativeCollaborativeAnalysisAncestryDependencies {
  readonly getInitiative: (initiativeId: string) => Initiative | null;
}

const defaultInitiativeCollaborativeAnalysisAncestryDependencies: InitiativeCollaborativeAnalysisAncestryDependencies =
  {
    getInitiative: getInitiativeById,
  };

async function assertEligibleInitiativeAncestry(
  initiativeId: string,
  deps: InitiativeCollaborativeAnalysisAncestryDependencies,
): Promise<DirectInitiativeAncestry> {
  // Boxed so TypeScript's narrowing below reads a fresh binding rather than
  // a `let` mutated inside the checker closure (which the compiler cannot
  // otherwise prove was invoked before the guard).
  const resolvedInitiativeBox: { value: Initiative | null } = { value: null };

  // Enforcement boundary: validates ancestry (presence, format, existence)
  // before any persistence, regardless of caller. The checker reuses the
  // single Initiative lookup below for the lifecycle-phase rule as well,
  // so a successful creation performs exactly one Initiative lookup.
  const ancestry = await validateDirectInitiativeAncestry(
    { initiativeId },
    {
      initiativeExists(id) {
        resolvedInitiativeBox.value = deps.getInitiative(id);
        return resolvedInitiativeBox.value !== null;
      },
    },
  );

  const resolvedInitiative = resolvedInitiativeBox.value;

  if (!resolvedInitiative) {
    // Unreachable in practice: validateDirectInitiativeAncestry only
    // resolves once initiativeExists returned true, which only happens
    // after resolvedInitiativeBox.value was set to a non-null Initiative
    // above.
    throw new Error("Initiative not found.");
  }

  if (
    resolvedInitiative.lifecyclePhase !== "published" &&
    resolvedInitiative.lifecyclePhase !== "projected"
  ) {
    throw new Error("Analysis can only be created for published or projected initiatives.");
  }

  return ancestry;
}

function getOwnedAnalysis(
  analysisId: string,
  identity: RequestIdentity,
): InitiativeCollaborativeAnalysis {
  const analysis = getAnalysisById(analysisId);

  if (!analysis) {
    throw new Error("Analysis not found.");
  }

  assertInitiativeCollaborativeAnalysisOwnership(analysis, identity);

  return analysis;
}

function assertDraftStatus(analysis: InitiativeCollaborativeAnalysis): void {
  if (analysis.status !== "draft") {
    throw new Error("Only draft analyses can be edited or published from this workflow.");
  }
}

function assertArchivableStatus(analysis: InitiativeCollaborativeAnalysis): void {
  if (analysis.status === "archived") {
    throw new Error("Analysis is already archived.");
  }
}

function applyAnalysisContentUpdate(
  analysis: InitiativeCollaborativeAnalysis,
  input: SaveInitiativeCollaborativeAnalysisDraftInput,
): SaveInitiativeCollaborativeAnalysisDraftInput {
  return {
    title: input.title ?? analysis.title,
    summary: input.summary ?? analysis.summary,
    supportingEvidence: input.supportingEvidence ?? analysis.supportingEvidence,
    risks: input.risks ?? analysis.risks,
    openQuestions: input.openQuestions ?? analysis.openQuestions,
    suggestedImprovements: input.suggestedImprovements ?? analysis.suggestedImprovements,
    references: input.references ?? analysis.references,
  };
}

export function listMyInitiativeCollaborativeAnalyses(
  identity: RequestIdentity,
): InitiativeCollaborativeAnalysis[] {
  return listAnalysesByAuthor(identity.participantId);
}

export function listMyInitiativeCollaborativeAnalysesForInitiative(
  identity: RequestIdentity,
  initiativeId: string,
): InitiativeCollaborativeAnalysis[] {
  return listAnalysesByInitiative(initiativeId).filter(
    (analysis) => analysis.authorId === identity.participantId,
  );
}

export function getMyInitiativeCollaborativeAnalysis(
  identity: RequestIdentity,
  analysisId: string,
): InitiativeCollaborativeAnalysis {
  return getOwnedAnalysis(analysisId, identity);
}

/**
 * Initiative Lifecycle — Part B. Resolves "the" Collaborative Analysis the
 * Lifecycle Stage Workspace should show this Author for this Initiative:
 * an in-progress draft takes priority (there is at most one active working
 * draft at a time in the Workspace flow); otherwise the most recently
 * published one; otherwise `null` (no Analysis exists yet — the Workspace
 * shows its draft-empty state, never a fabricated one).
 */
export function getMyInitiativeCollaborativeAnalysisForInitiative(
  identity: RequestIdentity,
  initiativeId: string,
): InitiativeCollaborativeAnalysis | null {
  const mine = listAnalysesByInitiativeAndAuthor(initiativeId, identity.participantId);
  const draft = mine.find((analysis) => analysis.status === "draft");

  if (draft) {
    return draft;
  }

  const published = mine
    .filter((analysis) => analysis.status === "published")
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));

  return published[0] ?? null;
}

export async function createInitiativeCollaborativeAnalysisDraft(
  identity: RequestIdentity,
  input: CreateInitiativeCollaborativeAnalysisDraftInput,
  deps: InitiativeCollaborativeAnalysisAncestryDependencies = defaultInitiativeCollaborativeAnalysisAncestryDependencies,
): Promise<InitiativeCollaborativeAnalysis> {
  const ancestry = await assertEligibleInitiativeAncestry(input.initiativeId, deps);

  const now = new Date().toISOString();
  const analysisId = `initiative-analysis-${Date.now()}`;

  const analysis: InitiativeCollaborativeAnalysis = {
    analysisId,
    // Persisted initiativeId is sourced from the validated ancestry result,
    // not directly from unchecked caller input.
    initiativeId: ancestry.initiativeId,
    authorId: identity.participantId,
    title: input.title,
    summary: input.summary,
    supportingEvidence: input.supportingEvidence,
    risks: input.risks,
    openQuestions: input.openQuestions,
    suggestedImprovements: input.suggestedImprovements,
    references: input.references,
    status: "draft",
    initiativeVersion: resolveInitiativeVersionForNewAnalysis(ancestry.initiativeId),
    createdAt: now,
    updatedAt: now,
  };

  return createAnalysis(analysis);
}

/**
 * Initiative Lifecycle — Part B, Section 4: "Generate Analysis Draft".
 *
 * Builds a fresh Source Snapshot, runs it through the deterministic Draft
 * Builder, and writes the result into the Author's current draft (creating
 * one first if none exists yet). Regenerating overwrites the draft's
 * content wholesale — this mirrors "Generate" always being a full,
 * reproducible re-derivation from current sources, never a partial merge
 * that could silently blend generated and hand-written text.
 */
export async function generateInitiativeCollaborativeAnalysisDraft(
  identity: RequestIdentity,
  initiativeId: string,
  deps: InitiativeCollaborativeAnalysisAncestryDependencies = defaultInitiativeCollaborativeAnalysisAncestryDependencies,
): Promise<InitiativeCollaborativeAnalysis> {
  const initiative = deps.getInitiative(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  const snapshot = await buildInitiativeAnalysisSourceSnapshot(initiativeId);
  const draftContent = await generateAnalysisDraft({
    initiativeTitle: initiative.title,
    snapshot,
  });

  const existing = getMyInitiativeCollaborativeAnalysisForInitiative(identity, initiativeId);

  if (existing && existing.status === "draft") {
    const updated = updateAnalysis(existing.analysisId, draftContent);

    if (!updated) {
      throw new Error("Analysis not found.");
    }

    return updated;
  }

  return createInitiativeCollaborativeAnalysisDraft(identity, { initiativeId, ...draftContent }, deps);
}

export function saveInitiativeCollaborativeAnalysisDraft(
  identity: RequestIdentity,
  analysisId: string,
  input: SaveInitiativeCollaborativeAnalysisDraftInput,
): InitiativeCollaborativeAnalysis {
  const analysis = getOwnedAnalysis(analysisId, identity);

  assertDraftStatus(analysis);

  const updated = updateAnalysis(analysisId, input);

  if (!updated) {
    throw new Error("Analysis not found.");
  }

  return updated;
}

/**
 * Initiative Lifecycle — Part B, Section 10/11. Reuses the Part A
 * Lifecycle notification foundation (durable outbox + Active-Ally fan-out,
 * Author excluded) — this is IN ADDITION TO the pre-existing
 * `analysis_published` civic event above (which notifies the Initiative
 * steward specifically, a different, pre-existing audience/purpose left
 * untouched per scope protection). Never allowed to fail the publish
 * itself: the outbox requires MongoDB, so a memory-only dev/test
 * environment logs and continues rather than throwing.
 */
async function notifyLifecycleStageAnalysisPublished(
  published: InitiativeCollaborativeAnalysis,
  actorParticipantId: string,
): Promise<void> {
  const initiative = getInitiativeById(published.initiativeId);
  const publishedCount = listAnalysesByInitiativeAndAuthor(
    published.initiativeId,
    published.authorId,
  ).filter((analysis) => analysis.status === "published").length;

  try {
    await publishInitiativeLifecycleStage({
      initiativeId: published.initiativeId,
      initiativeTitle: initiative?.title ?? published.initiativeId,
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      stageArtifactId: published.analysisId,
      stageVersion: publishedCount,
      actorParticipantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(published.initiativeId)}#collaborative-analysis`,
    });
  } catch (error) {
    console.warn(
      `[initiative-collaborative-analysis] Lifecycle stage notification skipped: ${String(error)}`,
    );
  }
}

export async function publishInitiativeCollaborativeAnalysis(
  identity: RequestIdentity,
  analysisId: string,
): Promise<InitiativeCollaborativeAnalysis> {
  const analysis = getOwnedAnalysis(analysisId, identity);

  assertDraftStatus(analysis);

  const content = applyAnalysisContentUpdate(analysis, {});
  validateInitiativeCollaborativeAnalysisForPublication({
    ...analysis,
    ...content,
  });

  const publishedAt = new Date().toISOString();
  const published = updateAnalysis(analysisId, {
    status: "published",
    publishedAt,
  });

  if (!published) {
    throw new Error("Analysis not found.");
  }

  emitCivicNotificationEvent({
    eventType: "analysis_published",
    entityType: "analysis",
    entityId: analysisId,
    initiativeId: published.initiativeId,
    actorMemberId: identity.participantId,
  });

  await notifyLifecycleStageAnalysisPublished(published, identity.participantId);

  invalidateCommunityIntelligenceCache(published.initiativeId);

  return published;
}

export function archiveInitiativeCollaborativeAnalysis(
  identity: RequestIdentity,
  analysisId: string,
): InitiativeCollaborativeAnalysis {
  const analysis = getOwnedAnalysis(analysisId, identity);

  assertArchivableStatus(analysis);

  const archived = updateAnalysis(analysisId, {
    status: "archived",
  });

  if (!archived) {
    throw new Error("Analysis not found.");
  }

  return archived;
}
