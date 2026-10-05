/**
 * RESET 05E.3 — durable thin_gemini provider cooldown state.
 *
 * Survives process restart (Mongo when configured). Memory fallback for tests.
 * Never stores secrets, content, URLs, or project identity.
 */

import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { activationProviderCooldownSeconds } from "../activation-provider-transient-recovery.js";
import {
  PLP_PROVIDER_QUOTA_CLASS,
  type PlpProviderQuotaClass,
  resolveQuotaCooldownSeconds,
} from "./gemini-quota-forensics.js";

export const THIN_GEMINI_PROVIDER_STATE_ID = "thin_gemini" as const;

export type ThinGeminiProviderCooldownReason =
  | "RESOURCE_EXHAUSTED"
  | "HTTP_429"
  | "PROVIDER_COOLDOWN"
  | "UNKNOWN_QUOTA";

/** Shared localization pressure category. Not a second cooldown store. */
export type LocalizationProviderPressureCategory =
  | "rate_limited"
  | "unavailable"
  | "timeout"
  | "network_failure";

export type ThinGeminiProviderStateRecord = {
  readonly providerId: typeof THIN_GEMINI_PROVIDER_STATE_ID;
  readonly cooldownUntil: string | null;
  readonly cooldownReason: ThinGeminiProviderCooldownReason | null;
  readonly quotaClass: PlpProviderQuotaClass | null;
  readonly quotaMetric: string | null;
  readonly quotaLimitId: string | null;
  readonly quotaRetryDelaySeconds: number | null;
  readonly updatedAt: string;
  /** Gate E — which transient class last armed the shared cooldown. */
  readonly pressureCategory?: LocalizationProviderPressureCategory | null;
  readonly pressureStreak?: number;
  /**
   * F.3.12 — global minimum gap between localization provider request starts.
   * Shared by every owner and locale. Not a provider payload.
   */
  readonly lastProviderRequestAt?: string | null;
  readonly nextProviderRequestAt?: string | null;
  readonly pacingIntervalMs?: number | null;
};

export type ThinGeminiCooldownSnapshot = {
  readonly active: boolean;
  readonly cooldownUntil: string | null;
  readonly cooldownReason: ThinGeminiProviderCooldownReason | null;
  readonly quotaClass: PlpProviderQuotaClass | null;
  readonly quotaMetric: string | null;
  readonly quotaLimitId: string | null;
  readonly quotaRetryDelaySeconds: number | null;
  readonly remainingSeconds: number;
  /** Present on the same durable record. Null when no category was stored. */
  readonly pressureCategory: LocalizationProviderPressureCategory | null;
};

type ThinGeminiProviderStateDocument = ThinGeminiProviderStateRecord;

let forceMemoryForTests = false;
let memoryState: ThinGeminiProviderStateRecord | null = null;

export function setThinGeminiProviderStateForceMemoryForTests(
  enabled: boolean,
): void {
  forceMemoryForTests = enabled;
}

export function resetThinGeminiProviderStateForTests(): void {
  memoryState = null;
}

export function useThinGeminiProviderStateMemory(): boolean {
  // Tests share one process. Keep pressure in memory so a simulated 429 cannot
  // write the developer database, and so a later test can clear it synchronously.
  // node:test sets NODE_TEST_CONTEXT even when NODE_TEST_ENV is unset.
  return (
    forceMemoryForTests ||
    process.env.NODE_TEST_ENV === "true" ||
    typeof process.env.NODE_TEST_CONTEXT === "string" ||
    !isMongoConfigured()
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyState(updatedAt = nowIso()): ThinGeminiProviderStateRecord {
  return {
    providerId: THIN_GEMINI_PROVIDER_STATE_ID,
    cooldownUntil: null,
    cooldownReason: null,
    quotaClass: null,
    quotaMetric: null,
    quotaLimitId: null,
    quotaRetryDelaySeconds: null,
    pressureCategory: null,
    pressureStreak: 0,
    lastProviderRequestAt: null,
    nextProviderRequestAt: null,
    pacingIntervalMs: null,
    updatedAt,
  };
}

function pacingFieldsFrom(
  existing: ThinGeminiProviderStateRecord | null | undefined,
): Pick<
  ThinGeminiProviderStateRecord,
  "lastProviderRequestAt" | "nextProviderRequestAt" | "pacingIntervalMs"
> {
  return {
    lastProviderRequestAt: existing?.lastProviderRequestAt ?? null,
    nextProviderRequestAt: existing?.nextProviderRequestAt ?? null,
    pacingIntervalMs: existing?.pacingIntervalMs ?? null,
  };
}

function collection() {
  return getMongoCollection<ThinGeminiProviderStateDocument>(
    MONGO_COLLECTIONS.plpThinGeminiProviderState,
  );
}

function toSnapshot(
  state: ThinGeminiProviderStateRecord | null,
  nowMs: number = Date.now(),
): ThinGeminiCooldownSnapshot {
  const pressureCategory = state?.pressureCategory ?? null;
  if (!state?.cooldownUntil) {
    return {
      active: false,
      cooldownUntil: null,
      cooldownReason: null,
      quotaClass: state?.quotaClass ?? null,
      quotaMetric: state?.quotaMetric ?? null,
      quotaLimitId: state?.quotaLimitId ?? null,
      quotaRetryDelaySeconds: state?.quotaRetryDelaySeconds ?? null,
      remainingSeconds: 0,
      pressureCategory,
    };
  }
  const untilMs = Date.parse(state.cooldownUntil);
  if (!Number.isFinite(untilMs) || untilMs <= nowMs) {
    return {
      active: false,
      cooldownUntil: state.cooldownUntil,
      cooldownReason: state.cooldownReason,
      quotaClass: state.quotaClass,
      quotaMetric: state.quotaMetric,
      quotaLimitId: state.quotaLimitId,
      quotaRetryDelaySeconds: state.quotaRetryDelaySeconds,
      remainingSeconds: 0,
      pressureCategory,
    };
  }
  return {
    active: true,
    cooldownUntil: state.cooldownUntil,
    cooldownReason: state.cooldownReason,
    quotaClass: state.quotaClass,
    quotaMetric: state.quotaMetric,
    quotaLimitId: state.quotaLimitId,
    quotaRetryDelaySeconds: state.quotaRetryDelaySeconds,
    remainingSeconds: Math.ceil((untilMs - nowMs) / 1000),
    pressureCategory,
  };
}

export async function readThinGeminiProviderState(): Promise<ThinGeminiProviderStateRecord | null> {
  if (useThinGeminiProviderStateMemory()) {
    return memoryState;
  }
  const doc = await collection().findOne({
    providerId: THIN_GEMINI_PROVIDER_STATE_ID,
  });
  return doc ?? null;
}

export function peekThinGeminiCooldownSnapshot(
  nowMs: number = Date.now(),
): ThinGeminiCooldownSnapshot | null {
  if (!useThinGeminiProviderStateMemory()) {
    return null;
  }
  return toSnapshot(memoryState, nowMs);
}

export async function getThinGeminiCooldownSnapshot(
  nowMs: number = Date.now(),
): Promise<ThinGeminiCooldownSnapshot> {
  const state = await readThinGeminiProviderState();
  return toSnapshot(state, nowMs);
}

/**
 * Activate / extend durable cooldown from a 429 / RESOURCE_EXHAUSTED event.
 * Extends (never shortens) an existing active cooldown.
 */
export async function activateThinGeminiProviderCooldown(input: {
  readonly quotaClass?: PlpProviderQuotaClass | null;
  readonly quotaMetric?: string | null;
  readonly quotaLimitId?: string | null;
  readonly quotaRetryDelaySeconds?: number | null;
  readonly reason?: ThinGeminiProviderCooldownReason;
  readonly nowMs?: number;
}): Promise<ThinGeminiProviderStateRecord> {
  const nowMs = input.nowMs ?? Date.now();
  const quotaClass =
    input.quotaClass ?? PLP_PROVIDER_QUOTA_CLASS.UNKNOWN_QUOTA;
  const cooldownSeconds = resolveQuotaCooldownSeconds({
    quotaClass,
    quotaRetryDelaySeconds: input.quotaRetryDelaySeconds ?? null,
  });
  const proposedUntil = new Date(nowMs + cooldownSeconds * 1000).toISOString();
  const existing = await readThinGeminiProviderState();
  const existingUntilMs = existing?.cooldownUntil
    ? Date.parse(existing.cooldownUntil)
    : 0;
  const proposedUntilMs = Date.parse(proposedUntil);
  const cooldownUntil =
    Number.isFinite(existingUntilMs) && existingUntilMs > proposedUntilMs
      ? existing!.cooldownUntil!
      : proposedUntil;

  const next: ThinGeminiProviderStateRecord = {
    providerId: THIN_GEMINI_PROVIDER_STATE_ID,
    cooldownUntil,
    cooldownReason: input.reason ?? "RESOURCE_EXHAUSTED",
    quotaClass,
    quotaMetric: input.quotaMetric ?? null,
    quotaLimitId: input.quotaLimitId ?? null,
    quotaRetryDelaySeconds: input.quotaRetryDelaySeconds ?? cooldownSeconds,
    pressureCategory: "rate_limited",
    pressureStreak: (existing?.pressureStreak ?? 0) + 1,
    ...pacingFieldsFrom(existing),
    updatedAt: nowIso(),
  };

  if (useThinGeminiProviderStateMemory()) {
    memoryState = next;
    return next;
  }

  await collection().updateOne(
    { providerId: THIN_GEMINI_PROVIDER_STATE_ID },
    { $set: next },
    { upsert: true },
  );
  return next;
}

/**
 * Gate E — arm the one shared localization cooldown.
 * Extends an active window. Does not store provider payloads or secrets.
 * A later success does not clear the window before `cooldownUntil`.
 */
export async function activateLocalizationProviderPressure(input: {
  readonly category: LocalizationProviderPressureCategory;
  readonly nowMs?: number;
  readonly retryAfterSeconds?: number | null;
}): Promise<ThinGeminiProviderStateRecord> {
  const nowMs = input.nowMs ?? Date.now();
  const existing = await readThinGeminiProviderState();
  const existingUntilMs = existing?.cooldownUntil ? Date.parse(existing.cooldownUntil) : 0;
  const stillActive = Number.isFinite(existingUntilMs) && existingUntilMs > nowMs;
  const streak = stillActive ? (existing?.pressureStreak ?? 1) + 1 : 1;
  const bounded = activationProviderCooldownSeconds(streak);
  const hinted =
    input.retryAfterSeconds != null && input.retryAfterSeconds > 0
      ? Math.min(Math.trunc(input.retryAfterSeconds), 900)
      : 0;
  const waitSec = Math.max(bounded, hinted);
  const proposedUntilMs = nowMs + waitSec * 1000;
  const cooldownUntil = new Date(
    stillActive && existingUntilMs > proposedUntilMs ? existingUntilMs : proposedUntilMs,
  ).toISOString();
  const next: ThinGeminiProviderStateRecord = {
    providerId: THIN_GEMINI_PROVIDER_STATE_ID,
    cooldownUntil,
    cooldownReason: input.category === "rate_limited" ? "HTTP_429" : "PROVIDER_COOLDOWN",
    quotaClass: existing?.quotaClass ?? null,
    quotaMetric: existing?.quotaMetric ?? null,
    quotaLimitId: existing?.quotaLimitId ?? null,
    quotaRetryDelaySeconds: waitSec,
    pressureCategory: input.category,
    pressureStreak: streak,
    ...pacingFieldsFrom(existing),
    updatedAt: new Date(nowMs).toISOString(),
  };
  if (useThinGeminiProviderStateMemory()) {
    memoryState = next;
    return next;
  }
  await collection().updateOne(
    { providerId: THIN_GEMINI_PROVIDER_STATE_ID },
    { $set: next },
    { upsert: true },
  );
  return next;
}

/** Clear cooldown (tests / operator). */
export async function clearThinGeminiProviderCooldown(): Promise<void> {
  const existing = await readThinGeminiProviderState();
  const cleared: ThinGeminiProviderStateRecord = {
    ...emptyState(),
    ...pacingFieldsFrom(existing),
  };
  if (useThinGeminiProviderStateMemory()) {
    memoryState = cleared;
    return;
  }
  await collection().updateOne(
    { providerId: THIN_GEMINI_PROVIDER_STATE_ID },
    { $set: cleared },
    { upsert: true },
  );
}

/** True when a new provider request may start at `nowMs`. */
export function localizationProviderPacingWindowOpen(
  nextProviderRequestAt: string | null | undefined,
  nowMs: number,
): boolean {
  if (!nextProviderRequestAt) {
    return true;
  }
  const untilMs = Date.parse(nextProviderRequestAt);
  return !Number.isFinite(untilMs) || untilMs <= nowMs;
}

export type LocalizationProviderPacingPermit = {
  readonly acquired: boolean;
  readonly nextAllowedAt: string | null;
  readonly intervalMs: number;
};

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/**
 * Atomically claim the next global provider-start window.
 * Memory compare-and-set is synchronous. Mongo uses a conditional update on
 * the singleton `providerId` document so two processes cannot both win.
 * Interval <= 0 does not write (tests only). Production never passes 0.
 */
export async function tryAcquireLocalizationProviderPacingPermit(input: {
  readonly nowMs: number;
  readonly intervalMs: number;
}): Promise<LocalizationProviderPacingPermit> {
  const intervalMs = input.intervalMs;
  if (intervalMs <= 0) {
    return { acquired: true, nextAllowedAt: null, intervalMs: 0 };
  }
  const nowIsoStamp = new Date(input.nowMs).toISOString();
  const nextAllowedAt = new Date(input.nowMs + intervalMs).toISOString();
  if (useThinGeminiProviderStateMemory()) {
    const existing = memoryState;
    if (!localizationProviderPacingWindowOpen(existing?.nextProviderRequestAt, input.nowMs)) {
      return {
        acquired: false,
        nextAllowedAt: existing?.nextProviderRequestAt ?? nextAllowedAt,
        intervalMs: existing?.pacingIntervalMs ?? intervalMs,
      };
    }
    memoryState = {
      ...(existing ?? emptyState(nowIsoStamp)),
      lastProviderRequestAt: nowIsoStamp,
      nextProviderRequestAt: nextAllowedAt,
      pacingIntervalMs: intervalMs,
      updatedAt: nowIsoStamp,
    };
    return { acquired: true, nextAllowedAt, intervalMs };
  }

  try {
    await collection().updateOne(
      { providerId: THIN_GEMINI_PROVIDER_STATE_ID },
      { $setOnInsert: emptyState(nowIsoStamp) },
      { upsert: true },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }

  const updated = await collection().findOneAndUpdate(
    {
      providerId: THIN_GEMINI_PROVIDER_STATE_ID,
      $or: [
        { nextProviderRequestAt: null },
        { nextProviderRequestAt: { $exists: false } },
        { nextProviderRequestAt: { $lte: nowIsoStamp } },
      ],
    },
    {
      $set: {
        lastProviderRequestAt: nowIsoStamp,
        nextProviderRequestAt: nextAllowedAt,
        pacingIntervalMs: intervalMs,
        updatedAt: nowIsoStamp,
      },
    },
    { returnDocument: "after" },
  );
  if (updated) {
    return { acquired: true, nextAllowedAt, intervalMs };
  }
  const current = await readThinGeminiProviderState();
  return {
    acquired: false,
    nextAllowedAt: current?.nextProviderRequestAt ?? nextAllowedAt,
    intervalMs: current?.pacingIntervalMs ?? intervalMs,
  };
}
