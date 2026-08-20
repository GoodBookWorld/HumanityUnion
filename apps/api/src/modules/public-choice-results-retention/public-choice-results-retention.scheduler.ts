import { cleanupExpiredPublicChoiceResults } from "./public-choice-results-retention.service.js";

let schedulerStarted = false;
let timer: ReturnType<typeof setInterval> | null = null;

const INTERVAL_MS = 15 * 60 * 1000;

export function startPublicChoiceResultsRetentionScheduler(): void {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  timer = setInterval(() => {
    void cleanupExpiredPublicChoiceResults().catch(() => {
      // Keep process alive; next tick retries.
    });
  }, INTERVAL_MS);

  // Run once shortly after boot so expiry is not page-visit dependent.
  void cleanupExpiredPublicChoiceResults().catch(() => undefined);
}

export function stopPublicChoiceResultsRetentionScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  schedulerStarted = false;
}
