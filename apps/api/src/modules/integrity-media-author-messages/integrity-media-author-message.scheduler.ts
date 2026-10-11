import { INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_INTERVAL_MS } from "./integrity-media-author-message.constants.js";
import { reconcilePendingIntegrityMediaAuthorMessages } from "./integrity-media-author-message.reconciliation.js";

let schedulerStarted = false;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Same lifecycle as pending Blog-author activation: one pass on boot, then a
 * bounded interval. Pending rows live in Mongo, so a restart finds them.
 */
export function startIntegrityMediaAuthorMessageScheduler(): void {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  const tick = (): void => {
    void reconcilePendingIntegrityMediaAuthorMessages().catch(() => {
      // The pending row remains. The next tick is the next attempt.
    });
  };

  timer = setInterval(tick, INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_INTERVAL_MS);
  timer.unref?.();
  tick();
}

export function stopIntegrityMediaAuthorMessageScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  schedulerStarted = false;
}
