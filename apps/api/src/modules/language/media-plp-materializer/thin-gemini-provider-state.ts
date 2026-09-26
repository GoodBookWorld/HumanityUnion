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
  return forceMemoryForTests || process.env.NODE_TEST_ENV === "true" || !isMongoConfigured();
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
    updatedAt,
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
  const cleared = emptyState();
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
