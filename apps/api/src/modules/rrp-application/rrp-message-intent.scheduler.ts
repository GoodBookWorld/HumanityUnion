import { RRP_MESSAGE_INTENT_RECONCILE_INTERVAL_MS } from "./rrp-message-intent.constants.js";
import { reconcilePendingRrpMessageIntents } from "./rrp-message-intent.reconciliation.js";

let schedulerStarted = false;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * HU-RRP-03E — in-process bounded retry for pending RRP message intents.
 * Same lifecycle as Integrity Media author-message reconcile.
 */
export function startRrpMessageIntentScheduler(): void {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  const tick = (): void => {
    void reconcilePendingRrpMessageIntents().catch(() => {
      // Pending rows remain durable; the next tick retries.
    });
  };

  timer = setInterval(tick, RRP_MESSAGE_INTENT_RECONCILE_INTERVAL_MS);
  timer.unref?.();
  tick();
}

export function stopRrpMessageIntentScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  schedulerStarted = false;
}
