/**
 * Read-only chunk-plan compatibility diagnostic.
 *
 * Uses the pure HE.21D planner and the same blog field, sanitization,
 * eligibility, and automatic-warm intent rule as the warm executor.
 * Does not translate, queue translation work, or write.
 */

import type { ContentTranslationIntent, ContentTranslationSourceKind } from "@hu/types";

import { buildBlogPostTranslatableSource } from "./content-translation-blog-source.js";
import { sanitizeFieldsForAutomaticTranslation } from "./content-translation-eligibility.js";
import {
  CONTENT_TRANSLATION_MAX_CHUNK_REQUESTS,
  contentTranslationChunkPlanReleasesTruncationHold,
  contentTranslationPlanSlotCount,
  contentTranslationUsableOutputTokens,
  maximumContentTranslationPlannedRequestOutputTokens,
  planContentTranslationRequests,
  resolveContentTranslationExecutableFields,
  resolveContentTranslationMaxOutputTokens,
  type ContentTranslationPlanMode,
} from "./content-translation-chunk-plan-core.js";
import {
  ContentTranslationChunkPlanDiagnosticError,
  readAutomaticWarmTargetForChunkPlanDiagnostic,
  readBlogPostForChunkPlanDiagnostic,
} from "./content-translation-chunk-plan-diagnostic-read.js";

export { ContentTranslationChunkPlanDiagnosticError };

export const CONTENT_TRANSLATION_CHUNK_PLAN_DIAGNOSTIC_KEYS = [
  "sourceExists",
  "sourceVersion",
  "sourceVersionMatchesExpected",
  "eligibleFieldNames",
  "sanitizedFieldLengths",
  "providerRequestCount",
  "slotCount",
  "maximumEstimatedRequestOutputTokens",
  "within4096TokenBudget",
  "within24RequestLimit",
  "planMode",
  "chunkPlanValid",
  "truncationHoldWouldRelease",
] as const;

const OUTPUT_TOKEN_CEILING = 4096;

export interface ContentTranslationChunkPlanDiagnostic {
  readonly sourceExists: boolean;
  readonly sourceVersion: string | null;
  readonly sourceVersionMatchesExpected: boolean;
  readonly eligibleFieldNames: readonly string[];
  readonly sanitizedFieldLengths: Readonly<Record<string, number>>;
  readonly providerRequestCount: number;
  readonly slotCount: number;
  readonly maximumEstimatedRequestOutputTokens: number;
  readonly within4096TokenBudget: boolean;
  readonly within24RequestLimit: boolean;
  readonly planMode: ContentTranslationPlanMode | null;
  readonly chunkPlanValid: boolean;
  readonly truncationHoldWouldRelease: boolean;
}

export function emptyContentTranslationChunkPlanDiagnostic(): ContentTranslationChunkPlanDiagnostic {
  return {
    sourceExists: false,
    sourceVersion: null,
    sourceVersionMatchesExpected: false,
    eligibleFieldNames: [],
    sanitizedFieldLengths: {},
    providerRequestCount: 0,
    slotCount: 0,
    maximumEstimatedRequestOutputTokens: 0,
    within4096TokenBudget: false,
    within24RequestLimit: false,
    planMode: null,
    chunkPlanValid: false,
    truncationHoldWouldRelease: false,
  };
}

export function evaluateContentTranslationChunkPlan(input: {
  readonly sourceExists: boolean;
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceVersion: string | null;
  readonly expectedSourceVersion: string;
  readonly fields: Readonly<Record<string, string>> | null;
  readonly intent: ContentTranslationIntent;
  readonly maxOutputTokens?: number;
}): ContentTranslationChunkPlanDiagnostic {
  if (!input.sourceExists || !input.sourceVersion || !input.fields) {
    return emptyContentTranslationChunkPlanDiagnostic();
  }

  const maxOutputTokens = resolveContentTranslationMaxOutputTokens(input.maxOutputTokens);
  const sanitized = sanitizeFieldsForAutomaticTranslation({
    sourceKind: input.sourceKind,
    fields: input.fields,
  });
  const executable = resolveContentTranslationExecutableFields({
    sourceKind: input.sourceKind,
    intent: input.intent,
    sanitizedFields: sanitized,
  });
  const sourceVersionMatchesExpected = input.sourceVersion === input.expectedSourceVersion;
  if (!executable) {
    return {
      ...emptyContentTranslationChunkPlanDiagnostic(),
      sourceExists: true,
      sourceVersion: input.sourceVersion,
      sourceVersionMatchesExpected,
    };
  }

  const plan = planContentTranslationRequests(executable, maxOutputTokens);
  const maximumEstimatedRequestOutputTokens =
    maximumContentTranslationPlannedRequestOutputTokens(plan);
  const usableAt4096 = contentTranslationUsableOutputTokens(OUTPUT_TOKEN_CEILING);
  const eligibleFieldNames = Object.keys(executable).sort();
  const sanitizedFieldLengths: Record<string, number> = {};
  for (const name of eligibleFieldNames) {
    sanitizedFieldLengths[name] = executable[name]?.length ?? 0;
  }
  const planned =
    plan.capable && plan.mode !== "unsplittable" && plan.requests.length > 0;

  return {
    sourceExists: true,
    sourceVersion: input.sourceVersion,
    sourceVersionMatchesExpected,
    eligibleFieldNames,
    sanitizedFieldLengths,
    providerRequestCount: plan.requests.length,
    slotCount: contentTranslationPlanSlotCount(plan),
    maximumEstimatedRequestOutputTokens,
    within4096TokenBudget: planned && maximumEstimatedRequestOutputTokens <= usableAt4096,
    within24RequestLimit:
      planned && plan.requests.length <= CONTENT_TRANSLATION_MAX_CHUNK_REQUESTS,
    planMode: plan.mode,
    chunkPlanValid: planned,
    truncationHoldWouldRelease: contentTranslationChunkPlanReleasesTruncationHold(
      executable,
      maxOutputTokens,
    ),
  };
}

export async function diagnoseBlogPostChunkPlan(
  input: {
    readonly sourceKind: string;
    readonly sourceRecordId: string;
    readonly targetLocale: string;
    readonly expectedSourceVersion: string;
  },
  dependencies?: {
    readonly readBlogPost?: (
      postId: string,
    ) => Promise<Parameters<typeof buildBlogPostTranslatableSource>[0] | null>;
    readonly isAutomaticWarmTarget?: (input: {
      readonly targetLocale: string;
      readonly sourceLanguage: string;
    }) => Promise<boolean>;
  },
): Promise<ContentTranslationChunkPlanDiagnostic> {
  if (input.sourceKind !== "blog_post") {
    throw new ContentTranslationChunkPlanDiagnosticError("usage");
  }
  const sourceRecordId = input.sourceRecordId.trim();
  const targetLocale = input.targetLocale.trim();
  const expectedSourceVersion = input.expectedSourceVersion.trim();
  if (!sourceRecordId || !targetLocale || !expectedSourceVersion) {
    throw new ContentTranslationChunkPlanDiagnosticError("usage");
  }

  const readBlogPost = dependencies?.readBlogPost ?? readBlogPostForChunkPlanDiagnostic;
  const isAutomaticWarmTarget =
    dependencies?.isAutomaticWarmTarget ?? readAutomaticWarmTargetForChunkPlanDiagnostic;
  const post = await readBlogPost(sourceRecordId);
  if (!post) {
    return emptyContentTranslationChunkPlanDiagnostic();
  }

  const source = buildBlogPostTranslatableSource(post);
  const automatic = await isAutomaticWarmTarget({
    targetLocale,
    sourceLanguage: source.sourceLanguage,
  });
  const intent: ContentTranslationIntent = automatic ? "automatic_warm" : "search_discovery";

  return evaluateContentTranslationChunkPlan({
    sourceExists: true,
    sourceKind: source.sourceKind,
    sourceVersion: source.sourceVersion,
    expectedSourceVersion,
    fields: source.fields,
    intent,
  });
}
