import { cleanupExpiredPublicChoiceResults } from "./public-choice-results-retention.service.js";
import { closeOverduePublicChoiceElections } from "../initiative-collective-decision/initiative-collective-decision.service.js";

let schedulerStarted = false;
let timer: ReturnType<typeof setInterval> | null = null;

const INTERVAL_MS = 15 * 60 * 1000;

async function runPublicChoiceElectionMaintenanceTick(): Promise<void> {
  // Pack 04A — scheduled End of Voting auto-close before retention purge.
  await closeOverduePublicChoiceElections();
  await cleanupExpiredPublicChoiceResults();
}

export function startPublicChoiceResultsRetentionScheduler(): void {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  timer = setInterval(() => {
    void runPublicChoiceElectionMaintenanceTick().catch(() => {
      // Keep process alive; next tick retries.
    });
  }, INTERVAL_MS);

  // Run once shortly after boot so overdue closes + expiry are not page-visit dependent.
  void runPublicChoiceElectionMaintenanceTick().catch(() => undefined);
}

export function stopPublicChoiceResultsRetentionScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  schedulerStarted = false;
}
