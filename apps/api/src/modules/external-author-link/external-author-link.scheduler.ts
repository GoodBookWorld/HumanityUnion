import { INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_INTERVAL_MS } from "./external-author-link.constants.js";
import { reconcilePendingIntegrityMediaAuthorActivations } from "./external-author-link.reconciliation.js";

let schedulerStarted = false;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Same lifecycle shape as scheduled Blog publishing: one pass on boot, then a
 * bounded interval. Pending rows live in the link store, so a restart finds them.
 */
export function startIntegrityMediaAuthorActivationScheduler(): void {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  const tick = (): void => {
    void reconcilePendingIntegrityMediaAuthorActivations().catch(() => {
      // The pending row remains. The next tick is the next attempt.
    });
  };

  timer = setInterval(tick, INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_INTERVAL_MS);
  timer.unref?.();
  tick();
}

export function stopIntegrityMediaAuthorActivationScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  schedulerStarted = false;
}
