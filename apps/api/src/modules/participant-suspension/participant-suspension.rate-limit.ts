/**
 * Pack 24B — in-process IP rate limit for public suspension-review submit.
 */
const ipHits = new Map<string, number[]>();

let nowMsOverride: number | null = null;

export function setParticipantSuspensionRateLimitNowMsForTests(value: number | null): void {
  nowMsOverride = value;
}

export function resetParticipantSuspensionRateLimitsForTests(): void {
  ipHits.clear();
  nowMsOverride = null;
}

function nowMs(): number {
  return nowMsOverride ?? Date.now();
}

function resolveWindowMs(): number {
  const minutes = Number.parseInt(
    process.env.PARTICIPANT_SUSPENSION_REVIEW_RATE_WINDOW_MINUTES ?? "60",
    10,
  );
  const safe = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
  return safe * 60_000;
}

function resolveIpMax(): number {
  const max = Number.parseInt(
    process.env.PARTICIPANT_SUSPENSION_REVIEW_MAX_PER_IP_PER_WINDOW ?? "10",
    10,
  );
  return Number.isFinite(max) && max > 0 ? max : 10;
}

function pruneAndCount(map: Map<string, number[]>, key: string, windowMs: number): number {
  const cutoff = nowMs() - windowMs;
  const next = (map.get(key) ?? []).filter((ts) => ts > cutoff);
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

export function assertParticipantSuspensionReviewSubmitAllowed(input: {
  clientKey: string;
}): void {
  const windowMs = resolveWindowMs();
  const key = input.clientKey.trim() || "unknown";
  const ipCount = pruneAndCount(ipHits, key, windowMs);

  if (ipCount >= resolveIpMax()) {
    const error = new Error("Too many review requests. Please try again later.");
    error.name = "ParticipantSuspensionRateLimitError";
    throw error;
  }

  recordHit(ipHits, key);
}

export function isParticipantSuspensionRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.name === "ParticipantSuspensionRateLimitError";
}
