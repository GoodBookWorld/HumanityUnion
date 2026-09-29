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
  | "provider_cooldown"
  /**
   * Delayed retry after a parseable provider payload broke protected structure.
   * Not provider pressure. Parent job stays running.
   */
  | "structure_retry"
  /**
   * Same batch and same provider-shape version failed reconstructed structure
   * until the bound. Provider calls stop. Not a provider outage.
   */
  | "structure_blocked";

export type WebUiActivationBatchPhase = "primary" | "quality";

export type WebUiActivationBatchStatus = "ok" | "failed" | "pending";

export type WebUiActivationTransientFailure =
  | "rate_limited"
  | "unavailable"
  | "timeout";

/**
 * Safe structure/shape class. Codes are stable machine names.
 * They must not carry provider text, secrets, or translated output.
 */
export const WEB_UI_STRUCTURE_FAILURE_CLASSES = [
  "provider_payload_type_mismatch",
  "provider_span_count_mismatch",
  "deterministic_reconstruction_mismatch",
  "placeholder_mismatch",
  "icu_braces_mismatch",
  "tag_mismatch",
  "protected_slot_mismatch",
  "validation_failure_after_reconstruction",
] as const;

export type WebUiStructureFailureClass = (typeof WEB_UI_STRUCTURE_FAILURE_CLASSES)[number];

export type WebUiStructureFailureDiagnostic = {
  readonly failureClass: WebUiStructureFailureClass;
  readonly code: string;
  /**
   * First catalog path rejected in request order.
   * Set for a span-count mismatch. Not provider text.
   */
  readonly catalogKey?: string | null;
  /** Span-array length required for catalogKey. */
  readonly expectedSpanCount?: number | null;
  /** Span-array length returned for catalogKey. */
  readonly actualSpanCount?: number | null;
};

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
  /**
   * Consecutive retryable provider-output structure failures.
   * Separate from transientFailureCount so this wait is not provider pressure.
   */
  readonly structureRetryCount?: number;
  /**
   * Provider payload shape last attempted for this checkpoint.
   * Absent means the historical sentinel representation.
   */
  readonly providerShapeVersion?: number | null;
  /** Provider-shape and reconstructed-structure failures under providerShapeVersion. */
  readonly providerShapeFailureCount?: number | null;
  /** Why this checkpoint last entered a structure retry or block. Not provider text. */
  readonly structureFailure?: WebUiStructureFailureDiagnostic | null;
  /**
   * Absent on checkpoints created before partial leaf reuse.
   * Those checkpoints keep full-batch provider semantics.
   */
  readonly preparationContract?: WebUiPreparationContract | null;
};

/** New checkpoints reuse valid leaves. Older checkpoints omit this field. */
export type WebUiPreparationContract = "partial_reuse_v1";

export type WebUiBatchPreparationProvenance =
  | "REUSED_EXISTING_VALID"
  | "PROVIDER_GENERATED"
  | "MIXED";

/** Preparation seed only. Not a runtime authority. */
export type WebUiLeafReuseSource = "MONGO_PUBLISHED" | "PACKAGED" | "BUNDLED";

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
  /** Present when the last structure/shape failure discarded provider output. */
  readonly structureFailure?: WebUiStructureFailureDiagnostic | null;
  /** How this batch's values were obtained. Absent on older rows. */
  readonly preparationProvenance?: WebUiBatchPreparationProvenance | null;
  /** Seed catalog for reused leaves. Absent when the batch is provider-only or mixed-source. */
  readonly reuseSource?: WebUiLeafReuseSource | null;
  readonly reusedKeyCount?: number | null;
  readonly providerKeyCount?: number | null;
};
