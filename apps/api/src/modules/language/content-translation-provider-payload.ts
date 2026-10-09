/**
 * Allowlisted Content Translation provider-payload diagnostics.
 *
 * Stores a kind only. Never provider text, prompts, or secrets.
 * Finish-reason classification is the existing PLP allowlist.
 */

import {
  PLP_PROVIDER_FAILURE_SUBTYPE,
  classifyFinishReasonSubtype,
} from "./media-plp-materializer/provider-response-contract.js";

export const CONTENT_TRANSLATION_PROVIDER_PAYLOAD_KINDS = [
  "empty_candidate",
  "truncated",
  "malformed_json",
] as const;

export type ContentTranslationProviderPayloadKind =
  (typeof CONTENT_TRANSLATION_PROVIDER_PAYLOAD_KINDS)[number];

export function isContentTranslationProviderPayloadKind(
  value: string | null | undefined,
): value is ContentTranslationProviderPayloadKind {
  return (
    value === "empty_candidate" ||
    value === "truncated" ||
    value === "malformed_json"
  );
}

/**
 * Token-limit and other non-safety truncation finishes.
 * Safety stays on promptFeedback.blockReason.
 */
export function truncatedPayloadKindFromFinishReason(
  finishReason: string | null | undefined,
): "truncated" | null {
  const subtype = classifyFinishReasonSubtype(finishReason);
  if (
    subtype === PLP_PROVIDER_FAILURE_SUBTYPE.TOKEN_LIMIT_OR_FINISH_REASON ||
    subtype === PLP_PROVIDER_FAILURE_SUBTYPE.TRUNCATED_RESPONSE
  ) {
    return "truncated";
  }
  return null;
}

export function malformedStructuredPayloadKind(input: {
  readonly finishReason?: string | null;
  readonly failureSubtype?: string | null;
}): ContentTranslationProviderPayloadKind {
  if (input.failureSubtype === "truncated") {
    return "truncated";
  }
  if (truncatedPayloadKindFromFinishReason(input.finishReason) === "truncated") {
    return "truncated";
  }
  return "malformed_json";
}

export function isImmediateTerminalProviderPayloadKind(
  kind: string | null | undefined,
): boolean {
  return kind === "empty_candidate" || kind === "truncated";
}
