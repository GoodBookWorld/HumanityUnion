import { randomUUID } from "node:crypto";

import type { Request, Response } from "express";

import { getCountryLabel } from "@hu/geography";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import { AdministrationForbiddenError } from "../administration/administration.errors.js";
import { resolveApproximateIpGeography } from "../ip-geography/resolve-approximate-ip-geography.js";
import {
  createOpaqueTrafficId,
  readTrafficSessionId,
  readTrafficVisitorId,
  setTrafficIdentityCookies,
} from "./traffic-analytics.cookies.js";
import { TRAFFIC_SESSION_INACTIVITY_MS } from "./traffic-analytics.constants.js";
import {
  findTrafficSessionById,
  insertTrafficEvent,
  upsertTrafficSession,
} from "./traffic-analytics.repository.js";
import { recordAcceptedTrafficAggregates } from "./traffic-aggregate.repository.js";
import { isObviousBotUserAgent, normalizeTrafficPathname } from "./traffic-path.js";
import { classifyTrafficReferrer } from "./traffic-referrer.js";
import { logger } from "../../shared/observability/logger.js";

export class TrafficAnalyticsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrafficAnalyticsValidationError";
  }
}

function readNavigationId(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 64) {
    return undefined;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

/**
 * Best-effort pageview ingest. Returns accepted=false when silently ignored
 * (excluded path, bot, duplicate). Throws on validation errors for bad payloads.
 */
export async function ingestTrafficPageview(input: {
  req: Request;
  res: Response;
  body: unknown;
  now?: Date;
}): Promise<{ accepted: boolean; duplicate: boolean }> {
  const now = input.now ?? new Date();
  const userAgent =
    typeof input.req.headers["user-agent"] === "string"
      ? input.req.headers["user-agent"]
      : undefined;

  if (isObviousBotUserAgent(userAgent)) {
    return { accepted: false, duplicate: false };
  }

  if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) {
    throw new TrafficAnalyticsValidationError("Invalid analytics payload.");
  }

  const body = input.body as Record<string, unknown>;

  // Reject client-supplied privileged metadata.
  if (
    "visitorId" in body ||
    "sessionId" in body ||
    "countryCode" in body ||
    "ip" in body ||
    "userId" in body
  ) {
    throw new TrafficAnalyticsValidationError("Invalid analytics payload.");
  }

  const pathname = normalizeTrafficPathname(body.pathname);

  if (!pathname) {
    // Excluded / invalid paths are soft-ignored (not a client error).
    return { accepted: false, duplicate: false };
  }

  const referrer =
    typeof body.referrer === "string" && body.referrer.length <= 2048
      ? body.referrer
      : undefined;
  const classified = classifyTrafficReferrer(referrer);
  const navigationId = readNavigationId(body.navigationId);

  let visitorId = readTrafficVisitorId(input.req);
  if (!visitorId) {
    visitorId = createOpaqueTrafficId("tv");
  }

  let sessionId = readTrafficSessionId(input.req);
  let isNewSession = false;

  if (sessionId) {
    const existing = await findTrafficSessionById(sessionId);
    if (
      !existing ||
      existing.visitorId !== visitorId ||
      now.getTime() - existing.lastSeenAt.getTime() > TRAFFIC_SESSION_INACTIVITY_MS
    ) {
      sessionId = createOpaqueTrafficId("ts");
      isNewSession = true;
    }
  } else {
    sessionId = createOpaqueTrafficId("ts");
    isNewSession = true;
  }

  const geo = resolveApproximateIpGeography(input.req);
  const countryCode = geo.countryCode;
  const regionCode = geo.regionCode;
  // City only when hosting header supplied it (no IP reverse geolocation stored).
  const cityName = geo.cityName?.trim() ? geo.cityName.trim().slice(0, 120) : undefined;

  const eventId = randomUUID();
  const insertResult = await insertTrafficEvent({
    eventId,
    visitorId,
    sessionId,
    pathname,
    occurredAt: now,
    referrerType: classified.referrerType,
    ...(classified.referrerHost ? { referrerHost: classified.referrerHost } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(regionCode ? { regionCode } : {}),
    ...(cityName ? { cityName } : {}),
    ...(navigationId ? { navigationId } : {}),
  });

  if (insertResult === "duplicate") {
    setTrafficIdentityCookies(input.req, input.res, { visitorId, sessionId });
    return { accepted: false, duplicate: true };
  }

  await upsertTrafficSession({
    sessionId,
    visitorId,
    occurredAt: now,
    pathname,
    countryCode,
    isNew: isNewSession,
  });

  try {
    await recordAcceptedTrafficAggregates({
      visitorId,
      occurredAt: now,
      isNewSession,
      countryCode,
      referrerType: classified.referrerType,
      referrerHost: classified.referrerHost,
      pathname,
    });
  } catch (error) {
    logger.warn("traffic_analytics.aggregate_update_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  setTrafficIdentityCookies(input.req, input.res, { visitorId, sessionId });
  return { accepted: true, duplicate: false };
}

export async function assertTrafficAnalyticsAdmin(userId: string): Promise<void> {
  const user = await findAuthUserById(userId);

  if (!user || user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access required.");
  }
}

export { getCountryLabel };
