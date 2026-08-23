import { releaseDueScheduledBlogPublications } from "./blog.service.js";

let schedulerStarted = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** Pack 13C — poll frequently enough for calendar-day noon UTC releases without browser visits. */
const INTERVAL_MS = 60 * 1000;

async function runScheduledPublishTick(): Promise<void> {
  await releaseDueScheduledBlogPublications({ limit: 100 });
}

export function startBlogScheduledPublishScheduler(): void {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  timer = setInterval(() => {
    void runScheduledPublishTick().catch(() => {
      // Keep process alive; next tick retries.
    });
  }, INTERVAL_MS);

  void runScheduledPublishTick().catch(() => undefined);
}

export function stopBlogScheduledPublishScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  schedulerStarted = false;
}
