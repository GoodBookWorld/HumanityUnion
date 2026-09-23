/**
 * EMAIL SECURITY 02B — durable Mongo-backed Blog subscription abuse counters.
 *
 * Atomic claim patterns (no count→if→insert TOCTOU):
 * - IP budget: findOneAndUpdate $inc with count < max + upsert, E11000 retry
 * - Email cooldown: unique insert of TTL document (duplicate = cooldown active)
 * - Email daily: findOneAndUpdate $inc with count < max + upsert, E11000 retry
 */
import {
  BLOG_SUBSCRIPTION_EMAIL_COOLDOWN_MS,
  BLOG_SUBSCRIPTION_EMAIL_DAILY_MAX,
  BLOG_SUBSCRIPTION_EMAIL_DAILY_WINDOW_MS,
  BLOG_SUBSCRIPTION_IP_MAX_ATTEMPTS,
  BLOG_SUBSCRIPTION_IP_WINDOW_MS,
} from "../blog-subscription-abuse-policy.js";
import {
  blogSubscriptionDailyBucket,
  blogSubscriptionIpWindowBucket,
} from "../blog-subscription-privacy-hash.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { isDeployedPlatformRequiringRealEmail } from "../../email/email-safety-guards.js";
import { BlogPersistenceUnavailableError } from "../blog.errors.js";

export type BlogSubscriptionAbuseCounterKind = "ip" | "email_cooldown" | "email_daily";

export interface BlogSubscriptionAbuseCounterDocument {
  _id: string;
  kind: BlogSubscriptionAbuseCounterKind;
  count?: number;
  authorizedAt?: string;
  createdAt: string;
  expiresAt: Date;
}

export class BlogSubscriptionAbuseUnavailableError extends Error {
  readonly code = "blog_subscription_abuse_unavailable" as const;

  constructor(message = "Blog subscription abuse control is unavailable.") {
    super(message);
    this.name = "BlogSubscriptionAbuseUnavailableError";
  }
}

export function isBlogSubscriptionAbuseUnavailableError(error: unknown): boolean {
  return (
    error instanceof BlogSubscriptionAbuseUnavailableError ||
    (error instanceof Error && error.name === "BlogSubscriptionAbuseUnavailableError")
  );
}

/** Shared memory store — simulates durable shared state across "instances" in unit tests. */
const memoryCounters = new Map<string, BlogSubscriptionAbuseCounterDocument>();

/** Serialize memory-store mutations so concurrent awaits cannot double-claim. */
let memoryMutex: Promise<void> = Promise.resolve();

function withMemoryMutex<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = memoryMutex.then(fn, fn);
  memoryMutex = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

let nowMsOverride: number | null = null;
let forceUnavailableForTests = false;

export function setBlogSubscriptionAbuseNowMsForTests(value: number | null): void {
  nowMsOverride = value;
}

export function setBlogSubscriptionAbuseForceUnavailableForTests(value: boolean): void {
  if (process.env.NODE_TEST_ENV !== "true" && process.env.NODE_ENV !== "test") {
    throw new Error("setBlogSubscriptionAbuseForceUnavailableForTests is test-only.");
  }
  forceUnavailableForTests = value;
}

export function resetBlogSubscriptionAbuseForTests(): void {
  memoryCounters.clear();
  nowMsOverride = null;
  forceUnavailableForTests = false;
}

function nowMs(): number {
  return nowMsOverride ?? Date.now();
}

function useMemoryAbuseStore(): boolean {
  if (process.env.BLOG_SUBSCRIBER_FORCE_MEMORY === "true") {
    return true;
  }
  if (isMongoConfigured()) {
    return false;
  }
  // Deployed platforms must have Mongo — refuse silent memory fallback.
  if (isDeployedPlatformRequiringRealEmail()) {
    return false;
  }
  return true;
}

async function ensureReady(): Promise<void> {
  if (forceUnavailableForTests) {
    throw new BlogSubscriptionAbuseUnavailableError("Forced unavailable for tests.");
  }
  if (useMemoryAbuseStore()) {
    return;
  }
  if (!isMongoConfigured()) {
    throw new BlogSubscriptionAbuseUnavailableError();
  }
  try {
    await connectMongoClient();
  } catch (error) {
    throw new BlogSubscriptionAbuseUnavailableError(
      error instanceof Error ? error.message : "Mongo connection failed for abuse control.",
    );
  }
}

function collection() {
  return getMongoCollection<BlogSubscriptionAbuseCounterDocument>(
    MONGO_COLLECTIONS.blogSubscriptionAbuseCounters,
  );
}

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000,
  );
}

function memoryGetFresh(id: string): BlogSubscriptionAbuseCounterDocument | null {
  const doc = memoryCounters.get(id);
  if (!doc) {
    return null;
  }
  if (doc.expiresAt.getTime() <= nowMs()) {
    memoryCounters.delete(id);
    return null;
  }
  return doc;
}

/**
 * Atomically consume one IP attempt slot for the current 60-minute window.
 * Returns true when under the limit; false when exhausted.
 */
export async function consumeBlogSubscriptionIpBudget(sourceIpHash: string): Promise<boolean> {
  await ensureReady();
  const bucket = blogSubscriptionIpWindowBucket(nowMs());
  const id = `ip:${sourceIpHash}:${bucket}`;
  const windowEnd = new Date(
    (Number.parseInt(bucket, 10) + 1) * BLOG_SUBSCRIPTION_IP_WINDOW_MS,
  );
  const createdAt = new Date(nowMs()).toISOString();

  if (useMemoryAbuseStore()) {
    return withMemoryMutex(() => {
      const existing = memoryGetFresh(id);
      if (!existing) {
        memoryCounters.set(id, {
          _id: id,
          kind: "ip",
          count: 1,
          createdAt,
          expiresAt: windowEnd,
        });
        return true;
      }
      if ((existing.count ?? 0) >= BLOG_SUBSCRIPTION_IP_MAX_ATTEMPTS) {
        return false;
      }
      existing.count = (existing.count ?? 0) + 1;
      return true;
    });
  }

  try {
    const attempt = async (allowUpsert: boolean) => {
      return collection().findOneAndUpdate(
        { _id: id, count: { $lt: BLOG_SUBSCRIPTION_IP_MAX_ATTEMPTS } },
        {
          $inc: { count: 1 },
          $setOnInsert: {
            kind: "ip" satisfies BlogSubscriptionAbuseCounterKind,
            createdAt,
            expiresAt: windowEnd,
          },
        },
        { upsert: allowUpsert, returnDocument: "after" },
      );
    };

    let result = await attempt(true);
    if (result) {
      return true;
    }
    // Either over limit or lost upsert race — distinguish.
    const current = await collection().findOne({ _id: id });
    if (current && (current.count ?? 0) >= BLOG_SUBSCRIPTION_IP_MAX_ATTEMPTS) {
      return false;
    }
    result = await attempt(false);
    return Boolean(result);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      try {
        const result = await collection().findOneAndUpdate(
          { _id: id, count: { $lt: BLOG_SUBSCRIPTION_IP_MAX_ATTEMPTS } },
          { $inc: { count: 1 } },
          { returnDocument: "after" },
        );
        return Boolean(result);
      } catch (retryError) {
        throw new BlogSubscriptionAbuseUnavailableError(
          retryError instanceof Error ? retryError.message : "IP budget claim failed.",
        );
      }
    }
    throw new BlogSubscriptionAbuseUnavailableError(
      error instanceof Error ? error.message : "IP budget claim failed.",
    );
  }
}

export type BlogEmailSendAuthorizationResult =
  | { allowed: true }
  | { allowed: false; reason: "email_cooldown" | "email_daily_cap" };

/**
 * Atomically authorize one confirmation email send (cooldown + daily cap).
 * Concurrent callers: at most one succeeds when a single slot remains.
 */
export async function authorizeBlogSubscriptionConfirmationSend(
  recipientHash: string,
): Promise<BlogEmailSendAuthorizationResult> {
  await ensureReady();
  const ts = nowMs();
  const cooldownId = `email_cd:${recipientHash}`;
  const dayBucket = blogSubscriptionDailyBucket(ts);
  const dailyId = `email_day:${recipientHash}:${dayBucket}`;
  const cooldownExpires = new Date(ts + BLOG_SUBSCRIPTION_EMAIL_COOLDOWN_MS);
  const dailyExpires = new Date(ts + BLOG_SUBSCRIPTION_EMAIL_DAILY_WINDOW_MS);
  const createdAt = new Date(ts).toISOString();

  if (useMemoryAbuseStore()) {
    return withMemoryMutex(() => {
      if (memoryGetFresh(cooldownId)) {
        return { allowed: false, reason: "email_cooldown" } as const;
      }
      const daily = memoryGetFresh(dailyId);
      if (daily && (daily.count ?? 0) >= BLOG_SUBSCRIPTION_EMAIL_DAILY_MAX) {
        return { allowed: false, reason: "email_daily_cap" } as const;
      }
      memoryCounters.set(cooldownId, {
        _id: cooldownId,
        kind: "email_cooldown",
        authorizedAt: createdAt,
        createdAt,
        expiresAt: cooldownExpires,
      });
      if (!daily) {
        memoryCounters.set(dailyId, {
          _id: dailyId,
          kind: "email_daily",
          count: 1,
          createdAt,
          expiresAt: dailyExpires,
        });
        return { allowed: true } as const;
      }
      daily.count = (daily.count ?? 0) + 1;
      return { allowed: true } as const;
    });
  }

  try {
    // 1) Cooldown: unique insert — duplicate means cooldown active.
    try {
      await collection().insertOne({
        _id: cooldownId,
        kind: "email_cooldown",
        authorizedAt: createdAt,
        createdAt,
        expiresAt: cooldownExpires,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return { allowed: false, reason: "email_cooldown" };
      }
      throw error;
    }

    // 2) Daily cap: atomic $inc under max.
    const claimDaily = async (allowUpsert: boolean) => {
      return collection().findOneAndUpdate(
        { _id: dailyId, count: { $lt: BLOG_SUBSCRIPTION_EMAIL_DAILY_MAX } },
        {
          $inc: { count: 1 },
          $setOnInsert: {
            kind: "email_daily" satisfies BlogSubscriptionAbuseCounterKind,
            createdAt,
            expiresAt: dailyExpires,
          },
        },
        { upsert: allowUpsert, returnDocument: "after" },
      );
    };

    try {
      let dailyResult = await claimDaily(true);
      if (!dailyResult) {
        const current = await collection().findOne({ _id: dailyId });
        if (current && (current.count ?? 0) >= BLOG_SUBSCRIPTION_EMAIL_DAILY_MAX) {
          await collection().deleteOne({ _id: cooldownId });
          return { allowed: false, reason: "email_daily_cap" };
        }
        dailyResult = await claimDaily(false);
      }
      if (!dailyResult) {
        await collection().deleteOne({ _id: cooldownId });
        return { allowed: false, reason: "email_daily_cap" };
      }
      return { allowed: true };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const dailyResult = await claimDaily(false);
        if (!dailyResult) {
          await collection().deleteOne({ _id: cooldownId });
          return { allowed: false, reason: "email_daily_cap" };
        }
        return { allowed: true };
      }
      await collection().deleteOne({ _id: cooldownId }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    throw new BlogSubscriptionAbuseUnavailableError(
      error instanceof Error ? error.message : "Email send authorization failed.",
    );
  }
}

/** Peek whether email confirmation cooldown is active (no mutation). */
export async function isBlogSubscriptionEmailCooldownActive(
  recipientHash: string,
): Promise<boolean> {
  await ensureReady();
  const cooldownId = `email_cd:${recipientHash}`;

  if (useMemoryAbuseStore()) {
    return memoryGetFresh(cooldownId) !== null;
  }

  try {
    const doc = await collection().findOne({
      _id: cooldownId,
      expiresAt: { $gt: new Date(nowMs()) },
    });
    return Boolean(doc);
  } catch (error) {
    throw new BlogSubscriptionAbuseUnavailableError(
      error instanceof Error ? error.message : "Cooldown peek failed.",
    );
  }
}

export function assertBlogSubscriptionAbuseStoreUsesMemoryForTests(): void {
  if (!useMemoryAbuseStore()) {
    throw new BlogPersistenceUnavailableError(
      "Expected Blog abuse limiter memory store in this test.",
    );
  }
}
