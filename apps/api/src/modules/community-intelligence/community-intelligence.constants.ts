/** Bounded retrieval / response limits — avoid O(N²) full corpus scans. */
export const COMMUNITY_INTELLIGENCE_MAX_CANDIDATES = 80;
export const COMMUNITY_INTELLIGENCE_MAX_RELATED = 5;
export const COMMUNITY_INTELLIGENCE_MAX_WORKSPACE_ITEMS = 5;
export const COMMUNITY_INTELLIGENCE_MAX_PARTICIPANTS = 5;
export const COMMUNITY_INTELLIGENCE_MIN_SCORE = 0.22;
export const COMMUNITY_INTELLIGENCE_STRONG_OVERLAP_SCORE = 0.55;
export const COMMUNITY_INTELLIGENCE_CACHE_TTL_MS = 60_000;
/** Strong priority match requires activity-area (or equivalent) + at least one topic signal. */
export const COMMUNITY_INTELLIGENCE_PRIORITY_REMINDER_MIN_SIGNALS = 2;

/**
 * Pack 02 — internal relationship computation version.
 * Bump when scoring/classification changes so stale cache entries are ignored.
 * Not shown to ordinary Participants.
 */
export const COMMUNITY_SIMILARITY_ALGORITHM_VERSION = "ci-similarity-v1.1";

/** Collaboration Reminder requires at least this score (high confidence). */
export const COMMUNITY_INTELLIGENCE_COLLAB_REMINDER_MIN_SCORE = 0.45;

/**
 * Days before the same recipient+category+related Initiative may receive
 * another Community Intelligence Reminder after archive/active creation.
 */
export const COMMUNITY_INTELLIGENCE_REMINDER_COOLDOWN_DAYS = 14;

export const COMMUNITY_INTELLIGENCE_EMPTY_RELATED =
  "No closely related Initiatives were found.";
export const COMMUNITY_INTELLIGENCE_EMPTY_COLLABORATION =
  "No collaboration opportunities are available yet.";
export const COMMUNITY_INTELLIGENCE_EMPTY_OVERLAP =
  "No closely related Initiatives were found for this draft.";

export const COMMUNITY_INTELLIGENCE_ASSISTANT_EXPLANATION_RULE =
  "Explain only relationships present in the structured Community Intelligence result. Never invent related Initiatives, Participants, or overlap claims absent from that result.";
