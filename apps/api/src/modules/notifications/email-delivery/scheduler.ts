/**
 * HU-NOTIF-02C.2 — in-process worker scheduler (API lifecycle).
 * No new paid infrastructure. Errors never crash the API process.
 */

import {
  isMemberNotificationEmailDeliveryWorkerPermitted,
} from "./feature-flag.js";
import { MEMBER_NOTIFICATION_EMAIL_DELIVERY_POLL_INTERVAL_MS } from "./member-notification-email-delivery.constants.js";
import { runMemberNotificationEmailDeliveryWorkerTick } from "./worker.js";

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
    await runMemberNotificationEmailDeliveryWorkerTick();
  } catch {
    // Keep process alive; next tick retries.
  } finally {
    tickInFlight = false;
  }
}

export function startMemberNotificationEmailDeliveryScheduler(): void {
  if (schedulerStarted) {
    return;
  }
  schedulerStarted = true;

  timer = setInterval(() => {
    void runTick();
  }, MEMBER_NOTIFICATION_EMAIL_DELIVERY_POLL_INTERVAL_MS);
  timer.unref?.();

  void runTick();
}

export function stopMemberNotificationEmailDeliveryScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  schedulerStarted = false;
  tickInFlight = false;
}

export function isMemberNotificationEmailDeliverySchedulerStartedForTests(): boolean {
  return schedulerStarted;
}
