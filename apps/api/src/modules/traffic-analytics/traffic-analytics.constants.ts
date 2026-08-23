/** Pack 11C — traffic analytics constants. */

/** Inactivity boundary for analytics sessions (milliseconds). */
export const TRAFFIC_SESSION_INACTIVITY_MS = 30 * 60 * 1000;

/** Raw traffic_events retention. */
export const TRAFFIC_EVENT_RETENTION_DAYS = 90;

export const TRAFFIC_VISITOR_COOKIE = "hu_traffic_vid";
export const TRAFFIC_SESSION_COOKIE = "hu_traffic_sid";

export const TRAFFIC_VISITOR_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365;
export const TRAFFIC_SESSION_COOKIE_MAX_AGE_MS = TRAFFIC_SESSION_INACTIVITY_MS;

export function trafficEventExpireAt(occurredAt: Date): Date {
  return new Date(occurredAt.getTime() + TRAFFIC_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
