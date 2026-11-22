import { runAccountDeletionFinalizationTick } from "./account-deletion.service.js";

let schedulerStarted = false;
let timer: ReturnType<typeof setInterval> | null = null;

const INTERVAL_MS = 15 * 60 * 1000;

async function runTick(): Promise<void> {
  await runAccountDeletionFinalizationTick();
}

/** In-process scheduler. No external queue. A failed tick is retried on the next interval and on boot. */
export function startAccountDeletionFinalizationScheduler(): void {
  if (schedulerStarted) {
    return;
  }
  schedulerStarted = true;
  timer = setInterval(() => {
    void runTick().catch(() => {
      // Keep the process alive. The next tick retries due rows.
    });
  }, INTERVAL_MS);
  void runTick().catch(() => undefined);
}

export function stopAccountDeletionFinalizationScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  schedulerStarted = false;
}
