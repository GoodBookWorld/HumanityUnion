/**
 * HU-NOTIF-02C.4 — UTC digest period helpers and stable bucket identity.
 * Does not use the legacy MemberPreferences.digestFrequency field.
 */

import type { MemberNotificationEmailDeliveryChannel } from "@hu/types";

export type DigestFrequencyChannel = Extract<
  MemberNotificationEmailDeliveryChannel,
  "digest_daily" | "digest_weekly"
>;

export interface ParsedDigestBucketKey {
  recipientUserId: string;
  frequency: "daily" | "weekly";
  channel: DigestFrequencyChannel;
  periodKey: string;
}

/** Monday (UTC) ISO date YYYY-MM-DD for the week containing `isoTimestamp`. */
export function resolveUtcWeekMondayKey(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const utcDay = date.getUTCDay();
  const mondayOffset = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + mondayOffset),
  );
  return monday.toISOString().slice(0, 10);
}

export function resolveMemberNotificationDigestBucketKey(input: {
  recipientUserId: string;
  channel: MemberNotificationEmailDeliveryChannel;
  createdAt: string;
}): string | null {
  if (input.channel === "digest_daily") {
    const day = input.createdAt.slice(0, 10);
    return `${input.recipientUserId}:daily:${day}`;
  }
  if (input.channel === "digest_weekly") {
    const weekKey = resolveUtcWeekMondayKey(input.createdAt);
    return `${input.recipientUserId}:weekly:${weekKey}`;
  }
  return null;
}

export function parseMemberNotificationDigestBucketKey(
  digestBucketKey: string,
): ParsedDigestBucketKey | null {
  const parts = digestBucketKey.split(":");
  if (parts.length < 3) {
    return null;
  }
  const frequency = parts[parts.length - 2];
  const periodKey = parts[parts.length - 1];
  const recipientUserId = parts.slice(0, -2).join(":");
  if (!recipientUserId || !periodKey || !/^\d{4}-\d{2}-\d{2}$/u.test(periodKey)) {
    return null;
  }
  if (frequency === "daily") {
    return {
      recipientUserId,
      frequency: "daily",
      channel: "digest_daily",
      periodKey,
    };
  }
  if (frequency === "weekly") {
    return {
      recipientUserId,
      frequency: "weekly",
      channel: "digest_weekly",
      periodKey,
    };
  }
  return null;
}

/** Exclusive end of the digest period in UTC (first instant after the period). */
export function resolveDigestPeriodExclusiveEndIso(parsed: ParsedDigestBucketKey): string {
  if (parsed.frequency === "daily") {
    const [year, month, day] = parsed.periodKey.split("-").map(Number);
    const next = new Date(Date.UTC(year!, month! - 1, day! + 1));
    return next.toISOString();
  }
  const [year, month, day] = parsed.periodKey.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + 7));
  return next.toISOString();
}

/** True when the UTC period has fully closed (safe to project a digest). */
export function isDigestPeriodClosed(
  digestBucketKey: string,
  now: Date = new Date(),
): boolean {
  const parsed = parseMemberNotificationDigestBucketKey(digestBucketKey);
  if (!parsed) {
    return false;
  }
  return now.toISOString() >= resolveDigestPeriodExclusiveEndIso(parsed);
}

/** Exclusive period end for a channel + createdAt, or null for non-digest channels. */
export function resolveMemberNotificationDigestPeriodEndsAt(input: {
  channel: MemberNotificationEmailDeliveryChannel;
  createdAt: string;
  recipientUserId: string;
}): string | null {
  const bucket = resolveMemberNotificationDigestBucketKey(input);
  if (!bucket) {
    return null;
  }
  const parsed = parseMemberNotificationDigestBucketKey(bucket);
  if (!parsed) {
    return null;
  }
  return resolveDigestPeriodExclusiveEndIso(parsed);
}
