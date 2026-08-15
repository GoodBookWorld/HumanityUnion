/**
 * Production Hardening Pack 01 — anonymous operational metrics.
 * Never stores conversation content, prompts, or PII beyond opaque participant hashes.
 */

export interface AssistantUsageMetricEvent {
  readonly provider: string;
  readonly operation: string;
  readonly stage: string | null;
  readonly surfaceId: string;
  readonly success: boolean;
  readonly responseDurationMs: number;
  readonly estimatedPromptTokens: number | null;
  readonly retryCount: number;
  readonly safetyRejected: boolean;
  readonly rateLimited: boolean;
  readonly errorCode?: string;
}

interface Aggregates {
  totalRequests: number;
  successes: number;
  failures: number;
  safetyRejections: number;
  rateLimited: number;
  totalRetries: number;
  totalDurationMs: number;
}

const aggregates: Aggregates = {
  totalRequests: 0,
  successes: 0,
  failures: 0,
  safetyRejections: 0,
  rateLimited: 0,
  totalRetries: 0,
  totalDurationMs: 0,
};

const recentEvents: AssistantUsageMetricEvent[] = [];
const MAX_RECENT = 100;

export function recordAssistantUsageMetric(event: AssistantUsageMetricEvent): void {
  aggregates.totalRequests += 1;
  if (event.success) {
    aggregates.successes += 1;
  } else {
    aggregates.failures += 1;
  }
  if (event.safetyRejected) {
    aggregates.safetyRejections += 1;
  }
  if (event.rateLimited) {
    aggregates.rateLimited += 1;
  }
  aggregates.totalRetries += event.retryCount;
  aggregates.totalDurationMs += event.responseDurationMs;

  recentEvents.push(event);
  if (recentEvents.length > MAX_RECENT) {
    recentEvents.shift();
  }

  if (process.env.NODE_ENV === "development" || process.env.LIFECYCLE_AI_DIAGNOSTICS === "true") {
    console.info(
      `[lifecycle-ai] metric provider=${event.provider} op=${event.operation} stage=${event.stage ?? "n/a"} success=${event.success} durationMs=${event.responseDurationMs} retries=${event.retryCount}`,
    );
  }
}

export function getAssistantUsageMetricSnapshotForTests(): {
  readonly aggregates: Readonly<Aggregates>;
  readonly recentCount: number;
} {
  return {
    aggregates: { ...aggregates },
    recentCount: recentEvents.length,
  };
}

export function resetAssistantUsageMetricsForTests(): void {
  aggregates.totalRequests = 0;
  aggregates.successes = 0;
  aggregates.failures = 0;
  aggregates.safetyRejections = 0;
  aggregates.rateLimited = 0;
  aggregates.totalRetries = 0;
  aggregates.totalDurationMs = 0;
  recentEvents.length = 0;
}
