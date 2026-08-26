/**
 * Pack 21A — in-process rate limits for public Blog subscribe (email + IP).
 * Generic responses; no email logged.
 */
const emailHits = new Map<string, number[]>();
const ipHits = new Map<string, number[]>();

let nowMsOverride: number | null = null;

export function setBlogSubscriptionRateLimitNowMsForTests(value: number | null): void {
  nowMsOverride = value;
}

export function resetBlogSubscriptionRateLimitsForTests(): void {
  emailHits.clear();
  ipHits.clear();
  nowMsOverride = null;
}

function nowMs(): number {
  return nowMsOverride ?? Date.now();
}

function resolveWindowMs(): number {
  const minutes = Number.parseInt(
    process.env.BLOG_SUBSCRIPTION_RATE_WINDOW_MINUTES ?? "60",
    10,
  );
  const safe = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
  return safe * 60_000;
}

function resolveEmailMax(): number {
  const max = Number.parseInt(process.env.BLOG_SUBSCRIPTION_MAX_PER_EMAIL_PER_WINDOW ?? "5", 10);
  return Number.isFinite(max) && max > 0 ? max : 5;
}

function resolveIpMax(): number {
  const max = Number.parseInt(process.env.BLOG_SUBSCRIPTION_MAX_PER_IP_PER_WINDOW ?? "20", 10);
  return Number.isFinite(max) && max > 0 ? max : 20;
}

function pruneAndCount(map: Map<string, number[]>, key: string, windowMs: number): number {
  const cutoff = nowMs() - windowMs;
  const next = (map.get(key) ?? []).filter((ts) => ts > cutoff);
  // Pack 21F — drop empty keys so long-running processes do not retain every email/IP forever.
  if (next.length === 0) {
    map.delete(key);
  } else {
    map.set(key, next);
  }
  return next.length;
}

function recordHit(map: Map<string, number[]>, key: string): void {
  const list = map.get(key) ?? [];
  list.push(nowMs());
  map.set(key, list);
}

export function assertBlogSubscriptionSubscribeAllowed(input: {
  emailNormalized: string;
  ipKey: string;
}): void {
  const windowMs = resolveWindowMs();
  const emailCount = pruneAndCount(emailHits, input.emailNormalized, windowMs);
  const ipCount = pruneAndCount(ipHits, input.ipKey || "unknown", windowMs);

  if (emailCount >= resolveEmailMax() || ipCount >= resolveIpMax()) {
    const error = new Error("Too many subscription requests. Please try again later.");
    error.name = "BlogSubscriptionRateLimitError";
    throw error;
  }

  recordHit(emailHits, input.emailNormalized);
  recordHit(ipHits, input.ipKey || "unknown");
}

export function isBlogSubscriptionRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.name === "BlogSubscriptionRateLimitError";
}
