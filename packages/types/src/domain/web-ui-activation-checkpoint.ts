/**
 * Durable WEB_UI activation checkpoint (child of LanguageActivationJob).
 * Holds progress metadata only on the parent job; batch values live here.
 */

export type WebUiActivationCheckpointPhase =
  | "primary"
  | "quality"
  | "validating"
  | "publishing"
  | "ready"
  | "failed"
  /** Transient Gemini rate-limit wait; parent job stays running. */
  | "provider_cooldown";

export type WebUiActivationBatchPhase = "primary" | "quality";

export type WebUiActivationBatchStatus = "ok" | "failed" | "pending";

export type WebUiActivationTransientFailure =
  | "rate_limited"
  | "unavailable"
  | "timeout";

export type WebUiActivationCheckpointRecord = {
  readonly checkpointId: string;
  readonly jobId: string;
  readonly locale: string;
  readonly generation: number;
  readonly sourceHash: string;
  readonly terminologyMode: "live";
  readonly phase: WebUiActivationCheckpointPhase;
  readonly leafCount: number;
  readonly batchCount: number;
  readonly completedBatchCount: number;
  readonly failedBatchCount: number;
  readonly qualityBatchCount: number;
  readonly qualityCompletedBatchCount: number;
  readonly suspiciousPathCount: number;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: "ltr" | "rtl";
  readonly detail: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Absolute ISO time when provider work may resume after cooldown. */
  readonly nextAttemptAt?: string | null;
  /** Consecutive transient rate-limit streak (resets on successful batch). */
  readonly transientFailureCount?: number;
  readonly lastTransientFailure?: WebUiActivationTransientFailure | null;
};

export type WebUiActivationBatchRecord = {
  readonly checkpointId: string;
  readonly batchId: string;
  readonly phase: WebUiActivationBatchPhase;
  readonly namespace: string;
  readonly keys: readonly string[];
  readonly values: Readonly<Record<string, string>>;
  readonly status: WebUiActivationBatchStatus;
  readonly attempts: number;
  readonly reason: string | null;
  readonly updatedAt: string;
};
