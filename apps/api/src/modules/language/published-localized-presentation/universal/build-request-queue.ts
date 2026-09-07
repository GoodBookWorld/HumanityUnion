/**
 * RESET 04 / 05C — bounded in-process PLP build request queue.
 *
 * Lifecycle (production):
 * - In-process only: pending work is lost on process restart.
 * - Duplicate-safe via coalesce key (entityType|entityId|locale).
 * - Recovery: next RSS refresh re-enqueues the consumer-visible set
 *   (enqueueConsumerVisibleNewsPlpBuilds) so missed work is rebuilt.
 * - Default concurrency 1 (resolvePlpProviderConcurrency).
 * - Provider execution requires setPlpBuildRequestProcessor (05C wires production).
 */

import type {
  PlpBuildRequest,
  PlpBuildRequestStatus,
  PlpPublicationTriggerKind,
} from "@hu/types";
import { plpBuildWorkKey } from "@hu/types";

import { resolvePlpProviderConcurrency } from "./safety.js";

type QueueEntry = {
  request: PlpBuildRequest;
};

const pending = new Map<string, QueueEntry>();
const completed: PlpBuildRequest[] = [];
let running = 0;
let processor:
  | ((request: PlpBuildRequest) => Promise<PlpBuildRequestStatus>)
  | null = null;

/**
 * Production (and test) processor wiring. Sets the handler and kicks drain
 * so work queued while dormant is processed.
 */
export function setPlpBuildRequestProcessor(
  fn: ((request: PlpBuildRequest) => Promise<PlpBuildRequestStatus>) | null,
): void {
  processor = fn;
  if (fn != null) {
    void drainPlpBuildQueue();
  }
}

/** @deprecated Prefer setPlpBuildRequestProcessor — kept as test alias. */
export function setPlpBuildRequestProcessorForTests(
  fn: ((request: PlpBuildRequest) => Promise<PlpBuildRequestStatus>) | null,
): void {
  setPlpBuildRequestProcessor(fn);
}

export function getPlpBuildRequestProcessorForTests():
  | ((request: PlpBuildRequest) => Promise<PlpBuildRequestStatus>)
  | null {
  return processor;
}

export function resetPlpBuildRequestQueueForTests(): void {
  pending.clear();
  completed.length = 0;
  running = 0;
  processor = null;
}

export function getPlpBuildRequestQueueStats(): {
  readonly pending: number;
  readonly running: number;
  readonly completed: number;
  readonly PROVIDER_CONCURRENCY: number;
  readonly processorActive: boolean;
} {
  return {
    pending: pending.size,
    running,
    completed: completed.length,
    PROVIDER_CONCURRENCY: resolvePlpProviderConcurrency(),
    processorActive: processor != null,
  };
}

export function listPlpBuildRequestsPendingForTests(): readonly PlpBuildRequest[] {
  return [...pending.values()].map((e) => e.request);
}

export function listPlpBuildRequestsCompletedForTests(): readonly PlpBuildRequest[] {
  return [...completed];
}

/**
 * Enqueue or coalesce. Never starts Gemini here — only schedules work.
 */
export function enqueuePlpBuildRequest(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly contentRevision: number;
  readonly trigger: PlpPublicationTriggerKind;
}): PlpBuildRequest {
  const workKey = plpBuildWorkKey(input);
  const existing = pending.get(workKey);
  if (existing) {
    // Coalesce: keep newer canonicalVersion / contentRevision when higher.
    const newerVersion =
      input.canonicalVersion !== existing.request.canonicalVersion
        ? input.canonicalVersion
        : existing.request.canonicalVersion;
    const newerRevision = Math.max(
      input.contentRevision,
      existing.request.contentRevision,
    );
    const merged: PlpBuildRequest = {
      ...existing.request,
      canonicalVersion: newerVersion,
      contentRevision: newerRevision,
      trigger: input.trigger,
      status: "QUEUED",
    };
    existing.request = merged;
    return merged;
  }

  const request: PlpBuildRequest = {
    workKey,
    entityType: input.entityType,
    entityId: input.entityId,
    locale: String(input.locale).toLowerCase(),
    canonicalVersion: input.canonicalVersion,
    contentRevision: input.contentRevision,
    trigger: input.trigger,
    enqueuedAt: new Date().toISOString(),
    status: "QUEUED",
  };
  pending.set(workKey, { request });
  void drainPlpBuildQueue();
  return request;
}

async function drainPlpBuildQueue(): Promise<void> {
  const concurrency = resolvePlpProviderConcurrency();
  while (running < concurrency && pending.size > 0) {
    const nextKey = pending.keys().next().value as string | undefined;
    if (!nextKey) {
      return;
    }
    const entry = pending.get(nextKey);
    if (!entry) {
      return;
    }
    pending.delete(nextKey);
    running += 1;
    const runningRequest: PlpBuildRequest = {
      ...entry.request,
      status: "RUNNING",
    };
    try {
      const status = processor
        ? await processor(runningRequest)
        : ("QUEUED" as PlpBuildRequestStatus);
      // Without a processor, re-queue as QUEUED for observability (dormant).
      const finalStatus: PlpBuildRequestStatus =
        processor == null ? "QUEUED" : status;
      if (processor == null) {
        pending.set(nextKey, { request: { ...runningRequest, status: "QUEUED" } });
        // Stop drain loop when dormant — avoid spin.
        running -= 1;
        return;
      }
      completed.push({ ...runningRequest, status: finalStatus });
    } catch {
      completed.push({ ...runningRequest, status: "FAILED" });
    } finally {
      if (processor != null) {
        running -= 1;
      }
    }
  }
}

/**
 * Stale-work guard: a build targeting an older canonicalVersion must not
 * overwrite a newer published/current version.
 */
export function isPlpBuildStaleAgainstLive(input: {
  readonly buildTargetCanonicalVersion: string;
  readonly liveCanonicalVersion: string;
}): boolean {
  return input.buildTargetCanonicalVersion !== input.liveCanonicalVersion;
}
