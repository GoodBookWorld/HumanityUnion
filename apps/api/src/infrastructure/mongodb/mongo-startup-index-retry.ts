/**
 * Pack 26A.1 — bounded retry for transient Mongo replica-set write errors
 * during startup index DDL (createIndex / dropIndex).
 *
 * Do not use for general runtime mutations.
 */

export const MONGO_STARTUP_INDEX_RETRY_MAX_ATTEMPTS = 5;
export const MONGO_STARTUP_INDEX_RETRY_BASE_DELAY_MS = 250;

const TRANSIENT_REPLICA_SET_CODES = new Set([
  10107, // NotWritablePrimary
  189, // PrimarySteppedDown
  11602, // InterruptedDueToReplStateChange
  13435, // NotPrimaryNoSecondaryOk
  13436, // NotPrimaryOrSecondary
  91, // ShutdownInProgress (brief Atlas transition)
  216, // ElectionInProgress
]);

const TRANSIENT_REPLICA_SET_CODE_NAMES = new Set([
  "NotWritablePrimary",
  "PrimarySteppedDown",
  "InterruptedDueToReplStateChange",
  "NotPrimaryNoSecondaryOk",
  "NotPrimaryOrSecondary",
  "ShutdownInProgress",
  "ElectionInProgress",
  // Legacy / alternate naming still seen in some driver surfaces
  "NotMaster",
  "NotPrimary",
]);

const RETRYABLE_ERROR_LABELS = new Set([
  "RetryableWriteError",
  "TransientTransactionError",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pushCode(codes: number[], value: unknown): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    codes.push(value);
  }
}

function pushCodeName(names: string[], value: unknown): void {
  if (typeof value === "string" && value.trim()) {
    names.push(value.trim());
  }
}

function collectMongoErrorSignals(error: unknown): {
  codes: number[];
  codeNames: string[];
  labels: string[];
  message: string;
} {
  const codes: number[] = [];
  const codeNames: string[] = [];
  const labels: string[] = [];
  let message = "";

  const root = asRecord(error);
  if (!root) {
    return { codes, codeNames, labels, message };
  }

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof root.message === "string") {
    message = root.message;
  }

  pushCode(codes, root.code);
  pushCodeName(codeNames, root.codeName);

  const writeConcernError = asRecord(root.writeConcernError);
  if (writeConcernError) {
    pushCode(codes, writeConcernError.code);
    pushCodeName(codeNames, writeConcernError.codeName);
    if (typeof writeConcernError.errmsg === "string" && writeConcernError.errmsg) {
      message = message ? `${message}; ${writeConcernError.errmsg}` : writeConcernError.errmsg;
    }
  }

  const cause = root.cause;
  if (cause && cause !== error) {
    const nested = collectMongoErrorSignals(cause);
    codes.push(...nested.codes);
    codeNames.push(...nested.codeNames);
    labels.push(...nested.labels);
    if (nested.message) {
      message = message ? `${message}; ${nested.message}` : nested.message;
    }
  }

  if (typeof root.hasErrorLabel === "function") {
    for (const label of RETRYABLE_ERROR_LABELS) {
      try {
        if ((root.hasErrorLabel as (label: string) => boolean)(label)) {
          labels.push(label);
        }
      } catch {
        // ignore label probe failures
      }
    }
  }

  const errorLabels = root.errorLabels;
  if (Array.isArray(errorLabels)) {
    for (const label of errorLabels) {
      if (typeof label === "string") {
        labels.push(label);
      }
    }
  }

  const errorLabelSet = root.errorLabelSet;
  if (errorLabelSet instanceof Set) {
    for (const label of errorLabelSet) {
      if (typeof label === "string") {
        labels.push(label);
      }
    }
  }

  return { codes, codeNames, labels, message };
}

/**
 * True for transient replica-set primary stepdown / not-writable-primary
 * conditions that are safe to retry for idempotent startup index DDL.
 */
export function isTransientMongoReplicaSetWriteError(error: unknown): boolean {
  const signals = collectMongoErrorSignals(error);

  for (const label of signals.labels) {
    if (RETRYABLE_ERROR_LABELS.has(label)) {
      return true;
    }
  }

  for (const code of signals.codes) {
    if (TRANSIENT_REPLICA_SET_CODES.has(code)) {
      return true;
    }
  }

  for (const codeName of signals.codeNames) {
    if (TRANSIENT_REPLICA_SET_CODE_NAMES.has(codeName)) {
      return true;
    }
  }

  // Message fallback for oddly wrapped Atlas / write-concern surfaces.
  const lower = signals.message.toLowerCase();
  if (
    lower.includes("notwritableprimary") ||
    lower.includes("primarysteppeddown") ||
    lower.includes("not master") ||
    lower.includes("not primary")
  ) {
    return true;
  }

  return false;
}

function describeTransientError(error: unknown): string {
  const signals = collectMongoErrorSignals(error);
  const code = signals.codes[0];
  const codeName = signals.codeNames[0];
  const label = signals.labels[0];
  const parts: string[] = [];
  if (codeName) {
    parts.push(codeName);
  }
  if (typeof code === "number") {
    parts.push(`code=${code}`);
  }
  if (label) {
    parts.push(`label=${label}`);
  }
  return parts.length > 0 ? parts.join(" ") : "transient replica-set write error";
}

export interface MongoStartupIndexRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  /** Injected for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for tests; defaults to console.warn. Never logs secrets/URIs. */
  log?: (message: string) => void;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Bounded retry wrapper for startup index DDL operations only.
 */
export async function withMongoStartupIndexRetry<T>(
  operationName: string,
  operation: () => Promise<T>,
  options: MongoStartupIndexRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? MONGO_STARTUP_INDEX_RETRY_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? MONGO_STARTUP_INDEX_RETRY_BASE_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;
  const log = options.log ?? ((message: string) => console.warn(message));

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = isTransientMongoReplicaSetWriteError(error);
      if (!retryable || attempt >= maxAttempts) {
        throw error;
      }

      const delayMs = baseDelayMs * attempt;
      log(
        `[mongo-startup-indexes] transient error on "${operationName}" ` +
          `(attempt ${attempt}/${maxAttempts}, ${describeTransientError(error)}); ` +
          `retrying in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Mongo startup index operation failed after retries.");
}
