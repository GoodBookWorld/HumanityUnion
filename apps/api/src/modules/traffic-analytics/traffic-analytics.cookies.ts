import { randomBytes } from "node:crypto";

import type { Request, Response } from "express";

import {
  TRAFFIC_SESSION_COOKIE,
  TRAFFIC_SESSION_COOKIE_MAX_AGE_MS,
  TRAFFIC_VISITOR_COOKIE,
  TRAFFIC_VISITOR_COOKIE_MAX_AGE_MS,
} from "./traffic-analytics.constants.js";

function isSecureRequest(req: Request): boolean {
  if (req.secure) {
    return true;
  }

  const forwarded = req.headers["x-forwarded-proto"];
  return typeof forwarded === "string" && forwarded.split(",")[0]?.trim() === "https";
}

function cookieOptions(req: Request, maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureRequest(req),
    maxAge,
    path: "/",
  };
}

export function createOpaqueTrafficId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

export function readTrafficVisitorId(req: Request): string | null {
  const value = req.cookies?.[TRAFFIC_VISITOR_COOKIE];
  return typeof value === "string" && /^tv_[a-f0-9]{32}$/.test(value) ? value : null;
}

export function readTrafficSessionId(req: Request): string | null {
  const value = req.cookies?.[TRAFFIC_SESSION_COOKIE];
  return typeof value === "string" && /^ts_[a-f0-9]{32}$/.test(value) ? value : null;
}

export function setTrafficIdentityCookies(
  req: Request,
  res: Response,
  input: { visitorId: string; sessionId: string },
): void {
  res.cookie(TRAFFIC_VISITOR_COOKIE, input.visitorId, cookieOptions(req, TRAFFIC_VISITOR_COOKIE_MAX_AGE_MS));
  res.cookie(TRAFFIC_SESSION_COOKIE, input.sessionId, cookieOptions(req, TRAFFIC_SESSION_COOKIE_MAX_AGE_MS));
}
