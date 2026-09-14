/**
 * Reset 03B.1 — READ-ONLY staging forensic plan for the prior reuters experiment.
 *
 * DO NOT execute against staging in this pack.
 * After deploy of the durability fix, an operator may run a bounded read-only
 * diagnostic (separate pack) to classify where the reported write went.
 */

export const MEDIA_PLP_STAGING_FORENSIC_TARGET = {
  entityType: "civic_media_trusted",
  entityId: "reuters",
  locale: "uk",
  canonicalVersion: "v-845f32601ddecb8a",
} as const;

/**
 * Planned read-only checks (each one identity, no corpus scan):
 *
 * 1. Current pointer collection
 *    published_localized_presentations_current
 *    filter: { entityType, entityId, locale } (limit 2)
 *    Classify:
 *      - FOUND + state=PUBLISHED + matching version → durable current present
 *      - FOUND + mismatched version/schema → unexpected current
 *      - NOT FOUND → no durable current
 *
 * 2. History collection (bounded)
 *    published_localized_presentations_history
 *    filter: { "identity.entityType", "identity.entityId", "identity.locale" }
 *    sort updatedAt desc, limit 5
 *    Classify:
 *      - rows with matching canonicalVersion → history-only / orphaned write
 *      - no rows → no durable record (likely process-memory publish)
 *
 * 3. Database identity
 *    Report MONGODB_DATABASE only (never URI/secrets).
 *    Confirm humanity_union_staging for the forensic session.
 *
 * Outcomes to report (read-only):
 *   FORENSIC_CURRENT_FOUND
 *   FORENSIC_HISTORY_MATCH_COUNT
 *   FORENSIC_CLASSIFICATION=
 *     NO_DURABLE_RECORD |
 *     HISTORY_ONLY |
 *     CURRENT_PRESENT |
 *     CURRENT_UNEXPECTED_LOCATION
 *
 * Forbidden in forensic pack: writes, provider, warm, reconcile, corpus scan.
 */
export const MEDIA_PLP_STAGING_FORENSIC_PLAN_STATUS = "DESIGNED_NOT_EXECUTED" as const;
