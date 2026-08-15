/**
 * Pack 03 — provider-independent behavior guards.
 * Clear boundary requests are answered without an external model call.
 */

import {
  ASSISTANT_AUTO_PUBLISH_REPLY,
  ASSISTANT_OUT_OF_SCOPE_REPLY,
  ASSISTANT_POLITICAL_PERSUASION_REPLY,
  ASSISTANT_PRIVATE_CONTENT_REPLY,
} from "./assistant-core-policy.js";

export type AssistantBehaviorGuardKind =
  | "out_of_scope"
  | "private_content"
  | "auto_publish"
  | "political_persuasion";

export interface AssistantBehaviorGuardResult {
  readonly kind: AssistantBehaviorGuardKind;
  readonly reply: string;
  readonly provenanceNote: string;
  readonly outOfScope: boolean;
}

const OUT_OF_SCOPE_PATTERNS: readonly RegExp[] = [
  /\b(write|debug|fix)\s+(my\s+)?(python|javascript|java|c\+\+|rust)\b/i,
  /\b(weather|stock\s+tips?|crypto\s+trading|horoscope)\b/i,
  /\b(recipe|cook\s+dinner|movie\s+recommendation)\b/i,
  /\b(medical\s+diagnosis|prescribe|legal\s+advice\s+for\s+court)\b/i,
];

const PRIVATE_CONTENT_PATTERNS: readonly RegExp[] = [
  /\b(read|show|summarize|paste|forward)\b.{0,40}\b(private|direct)\s+(message|chat|conversation|dm)s?\b/i,
  /\b(private|direct)\s+(message|chat|conversation|dm)s?\b.{0,40}\b(history|contents?|transcript)\b/i,
  /\bwhat did .{1,40} (say|write) (to me|in (our|the) (dm|chat|messages?))\b/i,
];

const AUTO_PUBLISH_PATTERNS: readonly RegExp[] = [
  /\b(publish|post|release)\s+(this|it|the\s+(draft|petition|analysis|revision))\s+(for\s+me|automatically|now)\b/i,
  /\b(just|please)\s+publish\b/i,
  /\bauto[- ]?publish\b/i,
  /\byou\s+(should|can|must)\s+publish\b/i,
  /\bmake\s+(the\s+)?ai\s+publish\b/i,
];

const POLITICAL_PERSUASION_PATTERNS: readonly RegExp[] = [
  /\b(campaign|endorse|promote)\s+(for|the)\s+(party|candidate|ideology)\b/i,
  /\btell\s+(people|participants|voters)\s+(to|how\s+to)\s+vote\b/i,
  /\bwhich\s+(party|ideology|candidate)\s+should\s+(i|we)\s+(support|vote\s+for)\b/i,
  /\bpersuade\s+(them|participants|voters)\s+to\s+vote\b/i,
];

function firstMatch(
  text: string,
  patterns: readonly RegExp[],
): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Returns a guarded reply when the request hits a Pack 03 boundary.
 * Order matters: private / publish / persuasion before generic out-of-scope.
 */
export function resolveAssistantBehaviorGuard(
  instructions: string | undefined,
): AssistantBehaviorGuardResult | null {
  const text = instructions?.trim();
  if (!text) {
    return null;
  }

  if (firstMatch(text, PRIVATE_CONTENT_PATTERNS)) {
    return {
      kind: "private_content",
      reply: ASSISTANT_PRIVATE_CONTENT_REPLY,
      provenanceNote: "Humanity Union Assistant privacy boundary (no external provider call).",
      outOfScope: false,
    };
  }

  if (firstMatch(text, AUTO_PUBLISH_PATTERNS)) {
    return {
      kind: "auto_publish",
      reply: ASSISTANT_AUTO_PUBLISH_REPLY,
      provenanceNote: "Humanity Union Assistant advisory boundary (no external provider call).",
      outOfScope: false,
    };
  }

  if (firstMatch(text, POLITICAL_PERSUASION_PATTERNS)) {
    return {
      kind: "political_persuasion",
      reply: ASSISTANT_POLITICAL_PERSUASION_REPLY,
      provenanceNote: "Humanity Union Assistant neutrality boundary (no external provider call).",
      outOfScope: false,
    };
  }

  if (firstMatch(text, OUT_OF_SCOPE_PATTERNS)) {
    return {
      kind: "out_of_scope",
      reply: ASSISTANT_OUT_OF_SCOPE_REPLY,
      provenanceNote: "Humanity Union Assistant scope boundary (no external provider call).",
      outOfScope: true,
    };
  }

  return null;
}
