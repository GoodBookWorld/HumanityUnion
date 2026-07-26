import { resolvePublicNewsConfig } from "./public-news.config.js";
import { cleanupExpiredPublicNews, refreshPublicNews } from "./public-news.service.js";

let schedulerStarted = false;
let refreshTimer: NodeJS.Timeout | null = null;

export function startPublicNewsScheduler(): void {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  const config = resolvePublicNewsConfig();
  const intervalMs = config.refreshIntervalHours * 60 * 60 * 1000;

  void refreshPublicNews().catch((error) => {
    console.error(
      "[public-news] Startup refresh failed:",
      error instanceof Error ? error.message : error,
    );
  });

  refreshTimer = setInterval(() => {
    void refreshPublicNews().catch((error) => {
      console.error(
        "[public-news] Scheduled refresh failed:",
        error instanceof Error ? error.message : error,
      );
    });
  }, intervalMs);

  refreshTimer.unref?.();
}

export function stopPublicNewsScheduler(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  schedulerStarted = false;
}

export async function runPublicNewsMaintenance(): Promise<void> {
  await cleanupExpiredPublicNews();
  await refreshPublicNews();
}
