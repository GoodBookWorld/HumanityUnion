import type { ClientSession } from "mongodb";

/**
 * LOAD.03 — process-local outbox wake. Transactional inserts wake only after commit.
 * The dispatcher registers the consumer. A missing consumer is a no-op.
 */

type Wake = () => void;

let wake: Wake | null = null;
const sessionsAwaitingWake = new WeakSet<ClientSession>();

export function registerOutboxDispatcherWake(fn: Wake): void {
  wake = fn;
}

export function requestOutboxDispatcherWake(session?: ClientSession): void {
  if (session) {
    sessionsAwaitingWake.add(session);
    return;
  }
  wake?.();
}

export function flushOutboxDispatcherWakeAfterCommit(session: ClientSession): void {
  if (!sessionsAwaitingWake.has(session)) {
    return;
  }
  sessionsAwaitingWake.delete(session);
  wake?.();
}

export function discardOutboxDispatcherWake(session: ClientSession): void {
  sessionsAwaitingWake.delete(session);
}
