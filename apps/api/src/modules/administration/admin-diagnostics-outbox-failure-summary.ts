/**
 * Read-only failed-outbox summary for Admin diagnostics.
 * Classifies stored lastError values into a closed category set and never
 * returns payloads, raw errors, aggregate ids, or addresses.
 */

import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";

export const FAILED_OUTBOX_SCAN_CAP = 500;
export const FAILED_OUTBOX_BREAKDOWN_GROUP_LIMIT = 10;

export const OUTBOX_FAILURE_CATEGORIES = [
  "AUTH_FAILURE",
  "TIMEOUT",
  "CONNECTION",
  "DNS",
  "NOT_CONFIGURED",
  "VALIDATION",
  "DUPLICATE",
  "SERIALIZATION",
  "PERSISTENCE",
  "HANDLER_REJECTED",
  "UNKNOWN",
] as const;

export type OutboxFailureCategory = (typeof OUTBOX_FAILURE_CATEGORIES)[number];

const KNOWN_EVENT_NAMES = new Set<string>(Object.values(CATALOGUE_EVENTS));

/**
 * Aggregate type constants published onto the outbox. Values that are not in
 * this set are reported as UNKNOWN so stored strings cannot surface arbitrary text.
 */
const KNOWN_AGGREGATE_TYPES = new Set<string>([
  "Activity",
  "AdministrationAudit",
  "BlogAdminSubscriberMessage",
  "BlogCapabilityGrant",
  "BlogPost",
  "BlogSubscriber",
  "ContentTranslationSource",
  "Decision",
  "Discussion",
  "Initiative",
  "InitiativeDecisionVote",
  "InitiativeLifecycleStage",
  "Member",
  "PetitionSignature",
  "Proposal",
]);

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export interface FailedOutboxScanRow {
  eventName: string;
  aggregateType: string;
  attempts: number | null;
  createdAt: string | null;
  /** Used only to choose a closed category. Never copied to the response. */
  lastError: string | null;
}

export interface OutboxFailureGroup {
  key: string;
  count: number;
}

export interface AdminOutboxFailureSummary {
  countsAvailable: boolean;
  totalFailed: number | null;
  pendingCount: number | null;
  dispatcher: {
    running: boolean;
    enabled: boolean;
    configured: boolean;
  };
  lastDispatchAt: string | null;
  sample: {
    order: "oldest";
    label: string;
    scannedCount: number;
    scanCap: number;
    limited: boolean;
    coverageNote: string | null;
  };
  byEventName: OutboxFailureGroup[];
  byAggregateType: OutboxFailureGroup[];
  byFailureCategory: OutboxFailureGroup[];
  breakdown: {
    groupLimit: number;
    eventNameTruncated: boolean;
    aggregateTypeTruncated: boolean;
    failureCategoryTruncated: boolean;
    limitNote: string;
  };
  attempts: {
    scope: "scanned_sample" | "unavailable";
    min: number | null;
    max: number | null;
    sum: number | null;
    count: number;
    missingCount: number;
    note: string | null;
  };
  timestamps: {
    oldestFailedEnqueuedAt: string | null;
    newestFailedEnqueuedAt: string | null;
    actualFailureAt: null;
    oldestFailedEnqueuedAtLabel: "Failed-row enqueue time";
    newestFailedEnqueuedAtLabel: "Failed-row enqueue time";
    actualFailureLabel: "Actual failure time";
    lastDispatchLabel: "Last dispatcher cycle";
  };
  impact: {
    classification: "known" | "unknown" | "mixed" | "none" | "unavailable";
    text: string;
  };
}

export interface OutboxFailureSummaryHealth {
  enabled: boolean;
  configured: boolean;
  running: boolean;
  stats: { pending: number; published: number; failed: number } | null;
  lastDispatchAt: string | null;
}

export function safeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) {
    return null;
  }
  return Number.isFinite(Date.parse(value)) ? value : null;
}

export function safeOutboxEventName(value: unknown): string {
  return typeof value === "string" && KNOWN_EVENT_NAMES.has(value) ? value : "UNKNOWN";
}

export function safeOutboxAggregateType(value: unknown): string {
  return typeof value === "string" && KNOWN_AGGREGATE_TYPES.has(value) ? value : "UNKNOWN";
}

export function classifyOutboxFailureCategory(
  lastError: string | null | undefined,
): OutboxFailureCategory {
  if (!lastError?.trim()) {
    return "UNKNOWN";
  }

  if (/authentication|invalid login|EAUTH|auth(?:entication)? failed/i.test(lastError)) {
    return "AUTH_FAILURE";
  }
  if (/ETIMEDOUT|\btimeout\b|timed out/i.test(lastError)) {
    return "TIMEOUT";
  }
  if (/ENOTFOUND|EAI_AGAIN|\bdns\b|getaddrinfo/i.test(lastError)) {
    return "DNS";
  }
  if (/ECONNRESET|ECONNREFUSED|ECONNECTION|ESOCKET|\bconnection\b/i.test(lastError)) {
    return "CONNECTION";
  }
  if (/not configured|is not configured|missing required/i.test(lastError)) {
    return "NOT_CONFIGURED";
  }
  if (/duplicate key|already processed|E11000/i.test(lastError)) {
    return "DUPLICATE";
  }
  if (/JSON|unexpected token|syntaxerror|serializ/i.test(lastError)) {
    return "SERIALIZATION";
  }
  if (/validation failed|invalid payload|invalid argument|invalid status/i.test(lastError)) {
    return "VALIDATION";
  }
  if (/mongo|write concern|server selection/i.test(lastError)) {
    return "PERSISTENCE";
  }
  if (/handler rejected|failed to process|handler error/i.test(lastError)) {
    return "HANDLER_REJECTED";
  }
  return "UNKNOWN";
}

function finiteAttempt(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

function countGroups(
  keys: readonly string[],
  limit: number,
): { groups: OutboxFailureGroup[]; allGroups: OutboxFailureGroup[]; truncated: boolean } {
  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  const allGroups = sorted.map(([key, count]) => ({ key, count }));
  return {
    groups: allGroups.slice(0, limit),
    allGroups,
    truncated: sorted.length > limit,
  };
}

function breakdownLimitNote(input: {
  truncated: boolean;
  scanLimited: boolean;
  groupLimit: number;
}): string {
  if (!input.truncated) {
    return `Breakdowns list at most the first ${input.groupLimit} groups.`;
  }
  if (input.scanLimited) {
    return `Only the first ${input.groupLimit} groups are shown. Breakdowns are based on a limited sample, not every failed row.`;
  }
  return `Only the first ${input.groupLimit} groups are shown. The failed-row scan is complete, and further groups are omitted.`;
}

function coverageNote(input: {
  limited: boolean;
  scannedCount: number;
  totalFailed: number;
}): string | null {
  if (!input.limited) {
    return null;
  }
  return `Breakdowns are based on a limited sample of the oldest ${input.scannedCount} failed rows. Scanned ${input.scannedCount} of ${input.totalFailed} failed rows. This is not full coverage.`;
}

function impactForCategories(
  totalFailed: number,
  categories: readonly OutboxFailureGroup[],
): AdminOutboxFailureSummary["impact"] {
  if (totalFailed === 0) {
    return {
      classification: "none",
      text: "No failed outbox rows are recorded.",
    };
  }
  const keys = new Set(categories.map((group) => group.key));
  const hasUnknown = keys.has("UNKNOWN");
  const hasKnown = [...keys].some((key) => key !== "UNKNOWN");
  if (hasUnknown && hasKnown) {
    return {
      classification: "mixed",
      text: "Some shown categories have a known publish failure. Remaining UNKNOWN categories have unknown operational impact.",
    };
  }
  if (hasUnknown || keys.size === 0) {
    return {
      classification: "unknown",
      text: "Operational impact is unknown. The scanned failures did not match a known failure category.",
    };
  }
  return {
    classification: "known",
    text: "Operational impact is known for the shown categories: those failed events were not published.",
  };
}

function emptyTimestamps(): AdminOutboxFailureSummary["timestamps"] {
  return {
    oldestFailedEnqueuedAt: null,
    newestFailedEnqueuedAt: null,
    actualFailureAt: null,
    oldestFailedEnqueuedAtLabel: "Failed-row enqueue time",
    newestFailedEnqueuedAtLabel: "Failed-row enqueue time",
    actualFailureLabel: "Actual failure time",
    lastDispatchLabel: "Last dispatcher cycle",
  };
}

function unavailableSummary(
  health: OutboxFailureSummaryHealth,
  scanCap: number,
): AdminOutboxFailureSummary {
  return {
    countsAvailable: false,
    totalFailed: null,
    pendingCount: null,
    dispatcher: {
      running: health.running,
      enabled: health.enabled,
      configured: health.configured,
    },
    lastDispatchAt: safeIsoTimestamp(health.lastDispatchAt),
    sample: {
      order: "oldest",
      label: "not scanned",
      scannedCount: 0,
      scanCap,
      limited: false,
      coverageNote:
        "Outbox counts are unavailable, so no failed rows were scanned. The failed count is not reported as zero.",
    },
    byEventName: [],
    byAggregateType: [],
    byFailureCategory: [],
    breakdown: {
      groupLimit: FAILED_OUTBOX_BREAKDOWN_GROUP_LIMIT,
      eventNameTruncated: false,
      aggregateTypeTruncated: false,
      failureCategoryTruncated: false,
      limitNote: breakdownLimitNote({
        truncated: false,
        scanLimited: false,
        groupLimit: FAILED_OUTBOX_BREAKDOWN_GROUP_LIMIT,
      }),
    },
    attempts: {
      scope: "unavailable",
      min: null,
      max: null,
      sum: null,
      count: 0,
      missingCount: 0,
      note: "Attempt statistics are unavailable because outbox counts were not returned.",
    },
    timestamps: emptyTimestamps(),
    impact: {
      classification: "unavailable",
      text: "Outbox failure impact is unavailable because outbox statistics were not returned. This is not a report of zero failures.",
    },
  };
}

export function buildFailedOutboxSummary(input: {
  rows: readonly FailedOutboxScanRow[];
  totalFailed: number;
  pendingCount: number;
  dispatcher: { running: boolean; enabled: boolean; configured: boolean };
  lastDispatchAt: string | null;
  scanCap: number;
  oldestEnqueuedAt: string | null;
  newestEnqueuedAt: string | null;
  boundsAvailable: boolean;
}): AdminOutboxFailureSummary {
  const scanCap = Math.max(0, input.scanCap);
  const rows = input.rows.slice(0, scanCap);
  const scannedCount = rows.length;
  const limited = input.totalFailed > scannedCount;
  const groupLimit = FAILED_OUTBOX_BREAKDOWN_GROUP_LIMIT;
  const eventNames = countGroups(
    rows.map((row) => safeOutboxEventName(row.eventName)),
    groupLimit,
  );
  const aggregateTypes = countGroups(
    rows.map((row) => safeOutboxAggregateType(row.aggregateType)),
    groupLimit,
  );
  const categories = countGroups(
    rows.map((row) => classifyOutboxFailureCategory(row.lastError)),
    groupLimit,
  );
  const truncated = eventNames.truncated || aggregateTypes.truncated || categories.truncated;

  const attemptValues = rows.map((row) => finiteAttempt(row.attempts));
  const present = attemptValues.filter((value): value is number => value !== null);
  const missingCount = attemptValues.length - present.length;

  let oldestFailedEnqueuedAt = safeIsoTimestamp(input.oldestEnqueuedAt);
  let newestFailedEnqueuedAt = safeIsoTimestamp(input.newestEnqueuedAt);
  if (!input.boundsAvailable && !limited) {
    const scannedTimes = rows
      .map((row) => safeIsoTimestamp(row.createdAt))
      .filter((value): value is string => value !== null)
      .sort();
    oldestFailedEnqueuedAt = oldestFailedEnqueuedAt ?? scannedTimes[0] ?? null;
    newestFailedEnqueuedAt =
      newestFailedEnqueuedAt ?? scannedTimes[scannedTimes.length - 1] ?? null;
  }

  return {
    countsAvailable: true,
    totalFailed: input.totalFailed,
    pendingCount: input.pendingCount,
    dispatcher: input.dispatcher,
    lastDispatchAt: safeIsoTimestamp(input.lastDispatchAt),
    sample: {
      order: "oldest",
      label: `oldest ${scannedCount}`,
      scannedCount,
      scanCap,
      limited,
      coverageNote: coverageNote({
        limited,
        scannedCount,
        totalFailed: input.totalFailed,
      }),
    },
    byEventName: eventNames.groups,
    byAggregateType: aggregateTypes.groups,
    byFailureCategory: categories.groups,
    breakdown: {
      groupLimit,
      eventNameTruncated: eventNames.truncated,
      aggregateTypeTruncated: aggregateTypes.truncated,
      failureCategoryTruncated: categories.truncated,
      limitNote: breakdownLimitNote({ truncated, scanLimited: limited, groupLimit }),
    },
    attempts: {
      scope: "scanned_sample",
      min: present.length > 0 ? Math.min(...present) : null,
      max: present.length > 0 ? Math.max(...present) : null,
      sum: present.length > 0 ? present.reduce((total, value) => total + value, 0) : null,
      count: present.length,
      missingCount,
      note: limited
        ? `Attempt statistics are based on the limited oldest-row sample (scanned ${scannedCount} of ${input.totalFailed}), not the full failed set.`
        : "Attempt statistics include the scanned failed rows.",
    },
    timestamps: {
      ...emptyTimestamps(),
      oldestFailedEnqueuedAt,
      newestFailedEnqueuedAt,
    },
    impact: (() => {
      const assessed = impactForCategories(input.totalFailed, categories.allGroups);
      if (!limited || assessed.classification === "none") {
        return assessed;
      }
      return {
        ...assessed,
        text: `${assessed.text} This describes the oldest-row sample, not every failed row.`,
      };
    })(),
  };
}

export async function assembleAdminOutboxFailureSummary(input: {
  health: OutboxFailureSummaryHealth;
  scanCap: number;
  readOldestFailedRows: (limit: number) => Promise<readonly FailedOutboxScanRow[]>;
  readEnqueueBounds: () => Promise<{
    oldestCreatedAt: string | null;
    newestCreatedAt: string | null;
  }>;
}): Promise<AdminOutboxFailureSummary> {
  const health = input.health;
  if (!health.configured || health.stats === null) {
    return unavailableSummary(health, input.scanCap);
  }

  const totalFailed = health.stats.failed;
  const dispatcher = {
    running: health.running,
    enabled: health.enabled,
    configured: health.configured,
  };

  if (totalFailed <= 0) {
    return buildFailedOutboxSummary({
      rows: [],
      totalFailed: 0,
      pendingCount: health.stats.pending,
      dispatcher,
      lastDispatchAt: health.lastDispatchAt,
      scanCap: input.scanCap,
      oldestEnqueuedAt: null,
      newestEnqueuedAt: null,
      boundsAvailable: true,
    });
  }

  const [rows, bounds] = await Promise.all([
    input.readOldestFailedRows(input.scanCap),
    input.readEnqueueBounds(),
  ]);

  return buildFailedOutboxSummary({
    rows,
    totalFailed,
    pendingCount: health.stats.pending,
    dispatcher,
    lastDispatchAt: health.lastDispatchAt,
    scanCap: input.scanCap,
    oldestEnqueuedAt: bounds.oldestCreatedAt,
    newestEnqueuedAt: bounds.newestCreatedAt,
    boundsAvailable: true,
  });
}
