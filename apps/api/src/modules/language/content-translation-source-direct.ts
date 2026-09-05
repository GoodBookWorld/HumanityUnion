/**
 * Pack 08K.2.4 — direct-by-id source loaders for residual diagnostics.
 *
 * Never hydrates snapshot Maps. One Mongo findOne (or existing direct repo)
 * per residual identity.
 */

import type {
  ContentTranslationSourceKind,
  Initiative,
  InitiativeCollectiveDecision,
  LanguageCode,
} from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE, normalizeLanguageCode } from "@hu/types";

import { isMongoPersistenceMode } from "../../config/production-persistence-contract.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { sanitizeBlogHtml } from "../blog/blog-content-sanitize.js";
import { findBlogPostById } from "../blog/persistence/blog.repository.js";
import { getInitiativeCommentById } from "../initiative-comments/initiative-comment.service.js";
import { getAnalysisById } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { buildContentTranslationSourceVersion } from "./content-translation-version.js";
import type { LoadedTranslatableSource } from "./content-translation.service.js";

/** Process-local counters for residual diagnostic memory contract. */
const residualDiagnosticCounters = {
  SOURCE_RECORDS_LOADED: 0,
  TRANSLATION_ROWS_LOADED: 0,
  OUTBOX_ROWS_INSPECTED: 0,
  FULL_CORPUS_HYDRATED: false as boolean,
  PEAK_IN_FLIGHT_IDENTITIES: 0,
};

export function resetResidualDiagnosticCountersForTests(): void {
  residualDiagnosticCounters.SOURCE_RECORDS_LOADED = 0;
  residualDiagnosticCounters.TRANSLATION_ROWS_LOADED = 0;
  residualDiagnosticCounters.OUTBOX_ROWS_INSPECTED = 0;
  residualDiagnosticCounters.FULL_CORPUS_HYDRATED = false;
  residualDiagnosticCounters.PEAK_IN_FLIGHT_IDENTITIES = 0;
}

export function getResidualDiagnosticCounters(): {
  readonly SOURCE_RECORDS_LOADED: number;
  readonly TRANSLATION_ROWS_LOADED: number;
  readonly OUTBOX_ROWS_INSPECTED: number;
  readonly FULL_CORPUS_HYDRATED: boolean;
  readonly PEAK_IN_FLIGHT_IDENTITIES: number;
} {
  return { ...residualDiagnosticCounters };
}

export function markResidualDiagnosticOutboxRowsInspected(count: number): void {
  residualDiagnosticCounters.OUTBOX_ROWS_INSPECTED += Math.max(0, count);
}

export function markResidualDiagnosticTranslationRowsLoaded(count: number): void {
  residualDiagnosticCounters.TRANSLATION_ROWS_LOADED += Math.max(0, count);
}

export function markResidualDiagnosticInFlight(count: number): void {
  residualDiagnosticCounters.PEAK_IN_FLIGHT_IDENTITIES = Math.max(
    residualDiagnosticCounters.PEAK_IN_FLIGHT_IDENTITIES,
    count,
  );
}

export function assertResidualDiagnosticDidNotHydrateFullCorpus(): void {
  if (residualDiagnosticCounters.FULL_CORPUS_HYDRATED) {
    throw new Error("Residual diagnostic must not set FULL_CORPUS_HYDRATED=true.");
  }
}

async function ensureMongo(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured for residual diagnostic source load.");
  }
  await connectMongoClient();
}

async function findInitiativeByIdDirect(initiativeId: string): Promise<Initiative | null> {
  if (!isMongoConfigured() || !isMongoPersistenceMode("INITIATIVE_PERSISTENCE")) {
    return getInitiativeById(initiativeId) ?? null;
  }
  await ensureMongo();
  const collection = getMongoCollection<Initiative>(MONGO_COLLECTIONS.initiatives);
  return collection.findOne({ initiativeId });
}

async function findCollaborativeAnalysisByIdDirect(analysisId: string): Promise<{
  analysisId: string;
  title: string;
  summary: string;
  supportingEvidence: string;
  risks: string;
  openQuestions?: string;
  suggestedImprovements: string;
  references: string;
  authorId: string;
  status: string;
  updatedAt: string;
} | null> {
  if (
    !isMongoConfigured() ||
    !isMongoPersistenceMode("INITIATIVE_ANALYSIS_PERSISTENCE")
  ) {
    const analysis = getAnalysisById(analysisId);
    return analysis
      ? {
          analysisId: analysis.analysisId,
          title: analysis.title,
          summary: analysis.summary,
          supportingEvidence: analysis.supportingEvidence,
          risks: analysis.risks,
          openQuestions: analysis.openQuestions,
          suggestedImprovements: analysis.suggestedImprovements,
          references: analysis.references,
          authorId: analysis.authorId,
          status: analysis.status,
          updatedAt: analysis.updatedAt,
        }
      : null;
  }
  await ensureMongo();
  const collection = getMongoCollection<{
    analysisId: string;
    title: string;
    summary: string;
    supportingEvidence: string;
    risks: string;
    openQuestions?: string;
    suggestedImprovements: string;
    references: string;
    authorId: string;
    status: string;
    updatedAt: string;
  }>(MONGO_COLLECTIONS.initiativeAnalyses);
  return collection.findOne({ analysisId });
}

async function findCollectiveDecisionByIdDirect(
  decisionId: string,
): Promise<InitiativeCollectiveDecision | null> {
  if (
    !isMongoConfigured() ||
    !isMongoPersistenceMode("INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE")
  ) {
    return getDecisionById(decisionId) ?? null;
  }
  await ensureMongo();
  const collection = getMongoCollection<InitiativeCollectiveDecision>(
    MONGO_COLLECTIONS.initiativeCollectiveDecisions,
  );
  return collection.findOne({ decisionId });
}

/**
 * Load one translatable source by identity without snapshot Map hydrate.
 */
export async function loadTranslatableSourceDirect(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
}): Promise<LoadedTranslatableSource | null> {
  residualDiagnosticCounters.SOURCE_RECORDS_LOADED += 1;

  if (input.sourceKind === "initiative") {
    const initiative = await findInitiativeByIdDirect(input.sourceRecordId);
    if (!initiative) {
      return null;
    }
    const fields = {
      title: initiative.title,
      description: initiative.description,
    };
    return {
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: buildContentTranslationSourceVersion({
        fields,
        versionStamp: initiative.updatedAt,
      }),
      sourceLanguage: normalizeLanguageCode(
        initiative.metadata?.language,
        DEFAULT_PLATFORM_LANGUAGE,
      ),
      fields,
      authorParticipantId: initiative.stewardId,
      isPublished: initiative.lifecyclePhase === "published" || initiative.status !== "draft",
    };
  }

  if (input.sourceKind === "collaborative_analysis") {
    const analysis = await findCollaborativeAnalysisByIdDirect(input.sourceRecordId);
    if (!analysis) {
      return null;
    }
    const fields = {
      title: analysis.title,
      summary: analysis.summary,
      supportingEvidence: analysis.supportingEvidence,
      risks: analysis.risks,
      openQuestions: analysis.openQuestions ?? "",
      suggestedImprovements: analysis.suggestedImprovements,
      references: analysis.references,
    };
    return {
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      sourceVersion: buildContentTranslationSourceVersion({
        fields,
        versionStamp: analysis.updatedAt,
      }),
      sourceLanguage: DEFAULT_PLATFORM_LANGUAGE as LanguageCode,
      fields,
      authorParticipantId: analysis.authorId,
      isPublished: analysis.status === "published",
    };
  }

  if (input.sourceKind === "blog_post") {
    const post = await findBlogPostById(input.sourceRecordId);
    if (!post) {
      return null;
    }
    const fields = {
      title: post.title,
      excerpt: post.excerpt,
      content: sanitizeBlogHtml(post.content),
    };
    return {
      sourceKind: "blog_post",
      sourceRecordId: post.postId,
      sourceVersion: buildContentTranslationSourceVersion({
        fields,
        versionStamp: post.updatedAt,
        publishedVersion: post.publishedVersion,
      }),
      sourceLanguage: normalizeLanguageCode(post.originalLanguage, DEFAULT_PLATFORM_LANGUAGE),
      fields,
      authorParticipantId: post.authorParticipantId,
      isPublished: post.status === "published",
    };
  }

  if (input.sourceKind === "discussion_comment") {
    const comment = await getInitiativeCommentById(input.sourceRecordId);
    if (!comment || comment.status !== "approved" || comment.deletedAt) {
      return null;
    }
    const fields = { body: comment.body };
    return {
      sourceKind: "discussion_comment",
      sourceRecordId: comment.commentId,
      sourceVersion: buildContentTranslationSourceVersion({
        fields,
        versionStamp: comment.updatedAt,
      }),
      sourceLanguage: DEFAULT_PLATFORM_LANGUAGE as LanguageCode,
      fields,
      authorParticipantId: comment.authorUserId,
      isPublished: true,
    };
  }

  if (input.sourceKind === "collective_decision") {
    const decision = await findCollectiveDecisionByIdDirect(input.sourceRecordId);
    if (!decision) {
      return null;
    }
    const publicStatus =
      decision.status === "opened" ||
      decision.status === "closed" ||
      decision.status === "cancelled";
    if (!publicStatus) {
      return null;
    }
    const fields = {
      question: decision.question,
      outcomeSummary: "",
      transparencyNote: "",
      structuredContent: "",
    };
    return {
      sourceKind: "collective_decision",
      sourceRecordId: decision.decisionId,
      sourceVersion: buildContentTranslationSourceVersion({
        fields,
        versionStamp:
          decision.closedAt ?? decision.openedAt ?? decision.closesAt ?? decision.decisionId,
      }),
      sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
      fields,
      authorParticipantId: decision.stewardId,
      isPublished: true,
    };
  }

  // Other kinds: not required for current residuals; fail closed without hydrate.
  return null;
}
