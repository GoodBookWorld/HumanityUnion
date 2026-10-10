/**
 * Content Translation chunk execution.
 *
 * Planning lives in content-translation-chunk-plan-core.ts so a read-only
 * diagnostic can import the planner without this module's provider pacing.
 */

import { ContentTranslationValidationError } from "./content-translation-failure-metadata.js";
import {
  isLocalizationProviderPacingDeferredError,
  waitForLocalizationProviderPacingWindow,
} from "./localization-provider-governor.js";
import { planContentTranslationRequests } from "./content-translation-chunk-plan-core.js";

export {
  CONTENT_TRANSLATION_EXPANSION_FACTOR,
  CONTENT_TRANSLATION_MAX_CHUNK_REQUESTS,
  CONTENT_TRANSLATION_OUTPUT_HEADROOM_DENOMINATOR,
  CONTENT_TRANSLATION_OUTPUT_HEADROOM_NUMERATOR,
  CONTENT_TRANSLATION_OUTPUT_TOKENS_PER_CHAR,
  CONTENT_TRANSLATION_STRUCTURED_RESPONSE_RESERVE_TOKENS,
  contentTranslationChunkPlanReleasesTruncationHold,
  contentTranslationPlanSlotCount,
  contentTranslationUsableOutputChars,
  contentTranslationUsableOutputTokens,
  estimateContentTranslationRequestOutputTokens,
  maximumContentTranslationPlannedRequestOutputTokens,
  planContentTranslationRequests,
  resolveContentTranslationExecutableFields,
  resolveContentTranslationMaxOutputTokens,
} from "./content-translation-chunk-plan-core.js";

export type {
  ContentTranslationPlanMode,
  ContentTranslationRequestPlan,
} from "./content-translation-chunk-plan-core.js";

/** How many times one segment may wait for the global pacing window. */
const MAX_SEGMENT_PACING_WAITS = 3;

async function translateSegmentOnce(
  fields: Readonly<Record<string, string>>,
  translate: (
    fields: Readonly<Record<string, string>>,
  ) => Promise<Readonly<Record<string, string>>>,
): Promise<Readonly<Record<string, string>>> {
  let pacingWaits = 0;
  while (true) {
    try {
      return await translate(fields);
    } catch (error) {
      if (
        !isLocalizationProviderPacingDeferredError(error) ||
        pacingWaits >= MAX_SEGMENT_PACING_WAITS
      ) {
        throw error;
      }
      pacingWaits += 1;
      await waitForLocalizationProviderPacingWindow(error.nextAllowedAt);
    }
  }
}

export async function translateContentTranslationFieldMap(input: {
  readonly fields: Readonly<Record<string, string>>;
  readonly maxOutputTokens?: number;
  readonly translate: (
    fields: Readonly<Record<string, string>>,
  ) => Promise<Readonly<Record<string, string>>>;
}): Promise<Record<string, string>> {
  const plan = planContentTranslationRequests(input.fields, input.maxOutputTokens);
  if (!plan.capable || plan.mode === "unsplittable") {
    throw new ContentTranslationValidationError(
      "INVALID_PROVIDER_PAYLOAD",
      "Content translation document cannot be split inside the output budget.",
      "malformed_response",
      null,
      null,
      "truncated",
    );
  }
  if (plan.mode === "single") {
    if (plan.requests.length === 0) {
      return {};
    }
    return { ...(await translateSegmentOnce(input.fields, input.translate)) };
  }

  const translated = new Map<string, string>();
  for (const request of plan.requests) {
    const response = await translateSegmentOnce(request, input.translate);
    for (const key of Object.keys(request)) {
      const value = response[key];
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new ContentTranslationValidationError(
          "INVALID_PROVIDER_PAYLOAD",
          "Translation provider omitted a content chunk.",
          "malformed_response",
          null,
          null,
          "malformed_json",
        );
      }
      translated.set(key, value);
    }
  }

  const assembled: Record<string, string> = {};
  for (const field of plan.assembly ?? []) {
    let text = "";
    for (const piece of field.pieces) {
      if (piece.kind === "raw") {
        text += piece.value;
        continue;
      }
      const value = translated.get(piece.id);
      if (typeof value !== "string") {
        throw new ContentTranslationValidationError(
          "INVALID_PROVIDER_PAYLOAD",
          "Translation provider omitted a content chunk.",
          "malformed_response",
          null,
          null,
          "malformed_json",
        );
      }
      text += value;
    }
    assembled[field.key] = text;
  }
  return assembled;
}
