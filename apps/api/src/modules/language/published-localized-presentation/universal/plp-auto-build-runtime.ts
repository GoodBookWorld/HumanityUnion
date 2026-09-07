/**
 * RESET 05C.1 — process-local PLP auto-build observability counters.
 * Safe for diagnostics: no secrets, no locale lists, no article bodies.
 */

import {
  countPlpAutoBuildWorkByStatus,
  usePlpAutoBuildWorkMemory,
} from "./plp-auto-build-work.repository.js";
import { resolvePlpAutoBuildLocales } from "./public-source-mutation-bridge.js";

export type PlpAutoBuildQueueBackend = "MONGO" | "MEMORY";

export type PlpAutoBuildStartupStatus = {
  readonly registered: boolean;
  readonly reason: "active" | "disabled_by_env" | "no_locales" | "not_bootstrapped";
  readonly localesCount: number;
  readonly queueBackend: PlpAutoBuildQueueBackend;
  readonly pendingCount: number | null;
  readonly at: string | null;
};

type RuntimeState = {
  mutationNotifications: number;
  collectionEnqueueAttempts: number;
  workAccepted: number;
  workDeduped: number;
  workSkippedUsable: number;
  queueDepth: number;
  processorRegistered: boolean;
  processorRunning: boolean;
  dequeued: number;
  buildStarted: number;
  buildSucceeded: number;
  buildFailed: number;
  providerCalls: number;
  plpPublishes: number;
  lastEnqueueAt: string | null;
  lastDequeueAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  startupStatus: PlpAutoBuildStartupStatus;
};

const state: RuntimeState = {
  mutationNotifications: 0,
  collectionEnqueueAttempts: 0,
  workAccepted: 0,
  workDeduped: 0,
  workSkippedUsable: 0,
  queueDepth: 0,
  processorRegistered: false,
  processorRunning: false,
  dequeued: 0,
  buildStarted: 0,
  buildSucceeded: 0,
  buildFailed: 0,
  providerCalls: 0,
  plpPublishes: 0,
  lastEnqueueAt: null,
  lastDequeueAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailureReason: null,
  startupStatus: {
    registered: false,
    reason: "not_bootstrapped",
    localesCount: 0,
    queueBackend: "MEMORY",
    pendingCount: null,
    at: null,
  },
};

export function resolvePlpAutoBuildQueueBackend(): PlpAutoBuildQueueBackend {
  return usePlpAutoBuildWorkMemory() ? "MEMORY" : "MONGO";
}

export function resetPlpAutoBuildRuntimeForTests(): void {
  state.mutationNotifications = 0;
  state.collectionEnqueueAttempts = 0;
  state.workAccepted = 0;
  state.workDeduped = 0;
  state.workSkippedUsable = 0;
  state.queueDepth = 0;
  state.processorRegistered = false;
  state.processorRunning = false;
  state.dequeued = 0;
  state.buildStarted = 0;
  state.buildSucceeded = 0;
  state.buildFailed = 0;
  state.providerCalls = 0;
  state.plpPublishes = 0;
  state.lastEnqueueAt = null;
  state.lastDequeueAt = null;
  state.lastSuccessAt = null;
  state.lastFailureAt = null;
  state.lastFailureReason = null;
  state.startupStatus = {
    registered: false,
    reason: "not_bootstrapped",
    localesCount: 0,
    queueBackend: resolvePlpAutoBuildQueueBackend(),
    pendingCount: null,
    at: null,
  };
}

export function recordPlpAutoBuildMutationNotification(): void {
  state.mutationNotifications += 1;
}

export function recordPlpAutoBuildCollectionEnqueueAttempt(): void {
  state.collectionEnqueueAttempts += 1;
}

export function recordPlpAutoBuildWorkAccepted(): void {
  state.workAccepted += 1;
  state.lastEnqueueAt = new Date().toISOString();
}

export function recordPlpAutoBuildWorkDeduped(): void {
  state.workDeduped += 1;
}

export function recordPlpAutoBuildWorkSkippedUsable(): void {
  state.workSkippedUsable += 1;
  state.workDeduped += 1;
}

export function setPlpAutoBuildQueueDepth(depth: number): void {
  state.queueDepth = Math.max(0, depth);
}

export function setPlpAutoBuildProcessorRegistered(registered: boolean): void {
  state.processorRegistered = registered;
}

export function setPlpAutoBuildProcessorRunning(running: boolean): void {
  state.processorRunning = running;
}

export function recordPlpAutoBuildDequeued(): void {
  state.dequeued += 1;
  state.lastDequeueAt = new Date().toISOString();
}

export function recordPlpAutoBuildStarted(): void {
  state.buildStarted += 1;
}

export function recordPlpAutoBuildSucceeded(): void {
  state.buildSucceeded += 1;
  state.lastSuccessAt = new Date().toISOString();
}

export function recordPlpAutoBuildFailed(reason: string): void {
  state.buildFailed += 1;
  state.lastFailureAt = new Date().toISOString();
  state.lastFailureReason = reason.slice(0, 80);
}

export function recordPlpAutoBuildProviderCall(): void {
  state.providerCalls += 1;
}

export function recordPlpAutoBuildPublish(): void {
  state.plpPublishes += 1;
}

export function setPlpAutoBuildStartupStatus(
  input: Omit<PlpAutoBuildStartupStatus, "at"> & { readonly at?: string },
): void {
  state.startupStatus = {
    ...input,
    at: input.at ?? new Date().toISOString(),
  };
}

export async function refreshPlpAutoBuildQueueDepthFromStore(): Promise<number> {
  const counts = await countPlpAutoBuildWorkByStatus();
  state.queueDepth = counts.pending;
  return counts.pending;
}

export async function getPlpAutoBuildRuntimeSnapshot(): Promise<{
  readonly QUEUE_BACKEND: PlpAutoBuildQueueBackend;
  readonly AUTO_LOCALES_CONFIGURED: boolean;
  readonly localesCount: number;
  readonly mutationNotifications: number;
  readonly collectionEnqueueAttempts: number;
  readonly workAccepted: number;
  readonly workDeduped: number;
  readonly workSkippedUsable: number;
  readonly queueDepth: number;
  readonly processorRegistered: boolean;
  readonly processorRunning: boolean;
  readonly dequeued: number;
  readonly buildStarted: number;
  readonly buildSucceeded: number;
  readonly buildFailed: number;
  readonly providerCalls: number;
  readonly plpPublishes: number;
  readonly lastEnqueueAt: string | null;
  readonly lastDequeueAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly lastFailureReason: string | null;
  readonly startupStatus: PlpAutoBuildStartupStatus;
  readonly workCounts: {
    readonly pending: number;
    readonly running: number;
    readonly completed: number;
    readonly failed: number;
    readonly superseded: number;
    readonly skipped_usable: number;
  };
}> {
  const workCounts = await countPlpAutoBuildWorkByStatus();
  state.queueDepth = workCounts.pending;
  const locales = resolvePlpAutoBuildLocales();
  return {
    QUEUE_BACKEND: resolvePlpAutoBuildQueueBackend(),
    AUTO_LOCALES_CONFIGURED: locales.length > 0,
    localesCount: locales.length,
    mutationNotifications: state.mutationNotifications,
    collectionEnqueueAttempts: state.collectionEnqueueAttempts,
    workAccepted: state.workAccepted,
    workDeduped: state.workDeduped,
    workSkippedUsable: state.workSkippedUsable,
    queueDepth: state.queueDepth,
    processorRegistered: state.processorRegistered,
    processorRunning: state.processorRunning,
    dequeued: state.dequeued,
    buildStarted: state.buildStarted,
    buildSucceeded: state.buildSucceeded,
    buildFailed: state.buildFailed,
    providerCalls: state.providerCalls,
    plpPublishes: state.plpPublishes,
    lastEnqueueAt: state.lastEnqueueAt,
    lastDequeueAt: state.lastDequeueAt,
    lastSuccessAt: state.lastSuccessAt,
    lastFailureAt: state.lastFailureAt,
    lastFailureReason: state.lastFailureReason,
    startupStatus: state.startupStatus,
    workCounts,
  };
}
