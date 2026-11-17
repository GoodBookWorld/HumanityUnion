/**
 * HU-NOTIF-02C.4 — in-process digest projector scheduler (API lifecycle).
 * No new paid infrastructure. Errors never crash the API process.
 */

import {
  isMemberNotificationEmailDeliveryWorkerPermitted,
} from "./feature-flag.js";
import { MEMBER_NOTIFICATION_EMAIL_DIGEST_POLL_INTERVAL_MS } from "./member-notification-email-delivery.constants.js";
import { runMemberNotificationEmailDigestWorkerTick } from "./digest-worker.js";

let schedulerStarted = false;
let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

async function runTick(): Promise<void> {
  if (tickInFlight) {
    return;
  }
  if (!isMemberNotificationEmailDeliveryWorkerPermitted()) {
    return;
  }
  tickInFlight = true;
  try {
    await runMemberNotificationEmailDigestWorkerTick();
  } catch {
    // Keep process alive; next tick retries.
  } finally {
    tickInFlight = false;
  }
}

export function startMemberNotificationEmailDigestScheduler(): void {
  if (schedulerStarted) {
    return;
  }
  schedulerStarted = true;

  timer = setInterval(() => {
    void runTick();
  }, MEMBER_NOTIFICATION_EMAIL_DIGEST_POLL_INTERVAL_MS);
  timer.unref?.();

  void runTick();
}

export function stopMemberNotificationEmailDigestScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  schedulerStarted = false;
  tickInFlight = false;
}

export function isMemberNotificationEmailDigestSchedulerStartedForTests(): boolean {
  return schedulerStarted;
}
