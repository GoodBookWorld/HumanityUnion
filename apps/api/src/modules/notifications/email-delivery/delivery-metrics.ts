/**
 * HU-NOTIF-02C.5 — safe in-process operational counters.
 * Never stores emails, bodies, or tokens.
 */

export type MemberNotificationEmailMetric =
  | "attempted"
  | "accepted"
  | "retried"
  | "failed"
  | "cancelled"
  | "skipped"
  | "rate_limited"
  | "dry_run_ok"
  | "live_blocked";

const counters = new Map<MemberNotificationEmailMetric, number>();

export function recordMemberNotificationEmailMetric(
  metric: MemberNotificationEmailMetric,
  amount = 1,
): void {
  counters.set(metric, (counters.get(metric) ?? 0) + amount);
}

export function getMemberNotificationEmailMetricsForTests(): Record<
  MemberNotificationEmailMetric,
  number
> {
  return {
    attempted: counters.get("attempted") ?? 0,
    accepted: counters.get("accepted") ?? 0,
    retried: counters.get("retried") ?? 0,
    failed: counters.get("failed") ?? 0,
    cancelled: counters.get("cancelled") ?? 0,
    skipped: counters.get("skipped") ?? 0,
    rate_limited: counters.get("rate_limited") ?? 0,
    dry_run_ok: counters.get("dry_run_ok") ?? 0,
    live_blocked: counters.get("live_blocked") ?? 0,
  };
}

export function resetMemberNotificationEmailMetricsForTests(): void {
  counters.clear();
}

/** Safe structured log — no PII. */
export function logMemberNotificationEmailDeliveryEvent(input: {
  channel: "immediate" | "digest_daily" | "digest_weekly";
  outcome: string;
  errorCode?: string | null;
}): void {
  const errorPart = input.errorCode ? ` error=${input.errorCode}` : "";
  console.info(
    `[notif-email] channel=${input.channel} outcome=${input.outcome}${errorPart}`,
  );
}
