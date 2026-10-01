import { DirectConversationCallRateLimitError } from "./direct-conversation-call.errors.js";
import {
  DIRECT_CONVERSATION_CALL_CREATE_MAX_ATTEMPTS,
  DIRECT_CONVERSATION_CALL_CREATE_WINDOW_MS,
} from "./direct-conversation-call.config.js";

/**
 * Same in-memory bucket style as auth rate limiting, keyed by the
 * authenticated Participant rather than by IP. One API instance is the
 * current deployment; the bucket resets when that process restarts.
 */

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

let maxAttempts = DIRECT_CONVERSATION_CALL_CREATE_MAX_ATTEMPTS;
let windowMs = DIRECT_CONVERSATION_CALL_CREATE_WINDOW_MS;

export function clearDirectConversationCallCreateRateLimitForTests(): void {
  buckets.clear();
  maxAttempts = DIRECT_CONVERSATION_CALL_CREATE_MAX_ATTEMPTS;
  windowMs = DIRECT_CONVERSATION_CALL_CREATE_WINDOW_MS;
}

export function setDirectConversationCallCreateRateLimitForTests(input: {
  maxAttempts: number;
  windowMs: number;
}): void {
  maxAttempts = input.maxAttempts;
  windowMs = input.windowMs;
  buckets.clear();
}

export function assertDirectConversationCallCreateRateLimit(participantId: string): void {
  const now = Date.now();
  const existing = buckets.get(participantId);

  if (!existing || existing.resetAt <= now) {
    buckets.set(participantId, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= maxAttempts) {
    throw new DirectConversationCallRateLimitError();
  }

  existing.count += 1;
}
