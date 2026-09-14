/**
 * Production Completion Pack 02C Task 02 — request-scoped runtime locale.
 *
 * Narrow reusable layer: resolve from Express request using the canonical
 * `resolveRuntimeLocale` contract (no duplicated precedence).
 */

import type { ResolvedRuntimeLocale } from "@hu/types";
import type { NextFunction, Request, Response } from "express";

import { isBootstrapAuthIdentity, optionalAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { getMemberPreferencesForAuthUser } from "../preferences/preferences.service.js";
import { readHuLangCookie } from "./hu-lang-cookie.js";
import { resolveRuntimeLocale } from "./resolve-runtime-locale.js";

/* eslint-disable @typescript-eslint/no-namespace -- Express Request augmentation. */
declare global {
  namespace Express {
    interface Request {
      /** Pack 02C — request-scoped interface locale resolution result. */
      runtimeLocale?: ResolvedRuntimeLocale;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

type PreferenceInterfaceLanguageLoader = (input: {
  readonly memberId: string;
  readonly userId?: string;
}) => Promise<string | null>;

let preferenceInterfaceLanguageLoaderForTests: PreferenceInterfaceLanguageLoader | null = null;

/** Test-only seam — avoid Mongo when exercising request wiring in isolation. */
export function setRuntimeLocalePreferenceLoaderForTests(
  loader: PreferenceInterfaceLanguageLoader | null,
): void {
  preferenceInterfaceLanguageLoaderForTests = loader;
}

function readAcceptLanguageHeader(req: Request): string | null {
  const header = req.headers["accept-language"];
  if (typeof header === "string" && header.trim()) {
    return header;
  }
  if (Array.isArray(header) && typeof header[0] === "string" && header[0].trim()) {
    return header[0];
  }
  return null;
}

async function loadParticipantInterfaceLanguage(input: {
  readonly memberId: string;
  readonly userId?: string;
}): Promise<string | null> {
  if (preferenceInterfaceLanguageLoaderForTests) {
    return preferenceInterfaceLanguageLoaderForTests(input);
  }

  try {
    const preferences = await getMemberPreferencesForAuthUser(input);
    return preferences.experiencePreferences.interfaceLanguage ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve runtime locale for the current request.
 * Uses Participant interfaceLanguage when JWT auth is present (non-bootstrap).
 */
export async function resolveRuntimeLocaleForRequest(
  req: Request,
): Promise<ResolvedRuntimeLocale> {
  const authenticated =
    Boolean(req.auth?.memberId) && !isBootstrapAuthIdentity(req.auth);

  let participantInterfaceLanguage: string | null = null;
  if (authenticated && req.auth?.memberId) {
    participantInterfaceLanguage = await loadParticipantInterfaceLanguage({
      memberId: req.auth.memberId,
      userId: req.auth.id,
    });
  }

  return resolveRuntimeLocale({
    authenticated,
    participantInterfaceLanguage,
    huLangCookie: readHuLangCookie(req),
    acceptLanguageHeader: readAcceptLanguageHeader(req),
  });
}

/**
 * Attach `req.runtimeLocale` (idempotent if already set).
 */
export async function attachRuntimeLocale(req: Request): Promise<ResolvedRuntimeLocale> {
  if (req.runtimeLocale) {
    return req.runtimeLocale;
  }
  const resolved = await resolveRuntimeLocaleForRequest(req);
  req.runtimeLocale = resolved;
  return resolved;
}

/**
 * Middleware: optional JWT auth, then attach request-scoped runtime locale.
 */
export function runtimeLocaleMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  optionalAuthenticationMiddleware(req, res, (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }
    void attachRuntimeLocale(req)
      .then(() => next())
      .catch(next);
  });
}
