import type { ClientSession } from "mongodb";

export type OutboxStatus = "pending" | "published" | "failed";

export interface OutboxRecord {
  outboxId: string;
  eventId: string;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  envelope: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  correlationId: string;
  causationId: string | null;
  createdAt: string;
  publishedAt: string | null;
  /**
   * F.3.19.2 — pending rows stay invisible to the dispatcher until this instant.
   * Used for provider pacing defer. Not a failure and not a second scheduler.
   */
  availableAt?: string | null;
  /**
   * Set only when a row first transitions to failed. Historical rows omit it.
   * This is not enqueue createdAt.
   */
  failedAt?: string | null;
}

export interface EnqueueOutboxOptions {
  session?: ClientSession;
}

export interface OutboxDispatchStats {
  pending: number;
  published: number;
  failed: number;
  oldestPendingCreatedAt: string | null;
}

export interface OutboxHealthStatus {
  enabled: boolean;
  configured: boolean;
  running: boolean;
  dispatchIntervalMs: number;
  stats: OutboxDispatchStats | null;
  lastDispatchAt: string | null;
  lastError: string | null;
  /** Oldest due pending enqueue time. Null when nothing is due. */
  oldestDuePendingCreatedAt: string | null;
  /** Newest forward-only failedAt. Null when no row has been failed since tracking began. */
  newestFailedAt: string | null;
  /** In-process time of the latest dispatcher catch. Not stored on historical rows. */
  lastDispatchErrorAt: string | null;
}
