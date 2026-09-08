/**
 * RESET 05E.3 — durable thin_gemini provider cooldown state.
 *
 * Survives process restart (Mongo when configured). Memory fallback for tests.
 * Never stores secrets, content, URLs, or project identity.
 */

import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
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

export type ThinGeminiProviderStateRecord = {
  readonly providerId: typeof THIN_GEMINI_PROVIDER_STATE_ID;
  readonly cooldownUntil: string | null;
  readonly cooldownReason: ThinGeminiProviderCooldownReason | null;
  readonly quotaClass: PlpProviderQuotaClass | null;
  readonly quotaMetric: string | null;
  readonly quotaLimitId: string | null;
  readonly quotaRetryDelaySeconds: number | null;
  readonly updatedAt: string;
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
  return forceMemoryForTests || !isMongoConfigured();
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
