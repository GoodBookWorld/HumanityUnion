/**
 * Deterministic tokenization / overlap helpers for Community Intelligence.
 * Explainable only — never embeddings.
 */

export const COMMUNITY_INTELLIGENCE_MIN_TOKEN_LENGTH = 4;

export const COMMUNITY_INTELLIGENCE_STOPWORDS = new Set([
  "this",
  "that",
  "these",
  "those",
  "with",
  "from",
  "have",
  "will",
  "would",
  "could",
  "should",
  "there",
  "their",
  "about",
  "which",
  "because",
  "just",
  "also",
  "into",
  "than",
  "then",
  "when",
  "what",
  "where",
  "your",
  "them",
  "they",
  "were",
  "been",
  "being",
  "does",
  "doesn",
  "cannot",
  "really",
  "very",
  "some",
  "such",
  "more",
  "most",
  "much",
  "many",
  "make",
  "made",
  "like",
  "want",
  "need",
  "think",
  "know",
  "even",
  "still",
  "well",
  "good",
  "bad",
  "here",
  "over",
  "only",
  "other",
  "another",
  "each",
  "every",
  "initiative",
  "initiatives",
  "community",
  "public",
  "civic",
  "people",
  "human",
  "union",
]);

/** Complementary role hints — shared domain + different complementary focus. */
export const COMPLEMENTARY_FOCUS_GROUPS: ReadonlyArray<{
  readonly label: string;
  readonly keywords: readonly string[];
}> = [
  {
    label: "infrastructure",
    keywords: ["infrastructure", "build", "construct", "road", "lane", "network", "facility"],
  },
  {
    label: "education",
    keywords: ["education", "educat", "training", "awareness", "curriculum", "teach", "school"],
  },
  {
    label: "safety",
    keywords: ["safety", "safe", "protect", "risk", "hazard", "accident"],
  },
  {
    label: "policy",
    keywords: ["policy", "regulation", "law", "ordinance", "governance", "legislation"],
  },
  {
    label: "funding",
    keywords: ["funding", "budget", "finance", "grant", "invest"],
  },
  {
    label: "research",
    keywords: ["research", "study", "data", "evidence", "analysis", "monitor"],
  },
];

export function tokenizeCommunityText(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(
        (word) =>
          word.length >= COMMUNITY_INTELLIGENCE_MIN_TOKEN_LENGTH &&
          !COMMUNITY_INTELLIGENCE_STOPWORDS.has(word),
      ),
  );
}

export function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function sharedTokens(left: Set<string>, right: Set<string>, limit = 8): string[] {
  const shared: string[] = [];

  for (const token of left) {
    if (right.has(token)) {
      shared.push(token);
      if (shared.length >= limit) {
        break;
      }
    }
  }

  return shared;
}

export function detectComplementaryFocusLabels(tokens: Set<string>): string[] {
  const labels: string[] = [];

  for (const group of COMPLEMENTARY_FOCUS_GROUPS) {
    const hit = group.keywords.some((keyword) =>
      Array.from(tokens).some((token) => token.startsWith(keyword) || keyword.startsWith(token)),
    );
    if (hit) {
      labels.push(group.label);
    }
  }

  return labels;
}
