import { Router, type Request } from "express";
import cookieParser from "cookie-parser";

import { createSuccessResponse } from "../../shared/http-response.js";
import { optionalAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { getPetition } from "./petition.store.js";
import {
  countPetitionVisitorSignals,
  recordPetitionVisitorSignal,
} from "./petition-visitor-signal.service.js";
import { canReadPetition, isPetitionPubliclyReadable } from "./petition-public-access.js";
import { listPublicInitiativePetitions } from "./public-petition-list.js";
import { toPublicPetitionProjection } from "./public-petition.projection.js";

const publicPetitionRouter = Router();

publicPetitionRouter.use(cookieParser());
// Initiative Lifecycle — Part F, Section 7/8. Decodes `req.auth` from a
// real JWT when a signed-in viewer sends one, but never blocks an
// anonymous visitor from reading this public route, and — unlike
// `authenticationMiddleware` — never substitutes the dev bootstrap
// identity for an anonymous request, which would otherwise make
// `viewerHasSigned` wrongly reflect the bootstrap member instead of "no
// one is signed in".
publicPetitionRouter.use(optionalAuthenticationMiddleware);

const VISITOR_COOKIE = "hu_petition_visitor";

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

/**
 * Initiative Lifecycle — Part F, Section 7/8 (Representative Signatures).
 * Mirrors `initiative-support.routes.ts`'s `resolveVisitorKey` exactly — a
 * long-lived, httpOnly cookie so the same unregistered visitor is never
 * double-counted, without collecting any identifying information.
 */
function resolveVisitorKey(req: Request): string {
  const existing = req.cookies?.[VISITOR_COOKIE];

  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }

  const generated = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  req.res?.cookie(VISITOR_COOKIE, generated, {
    httpOnly: true,
    sameSite: "lax",
    // Pack 26A — Secure on production HTTPS; omit for local HTTP development.
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 365,
    path: "/",
  });

  return generated;
}

publicPetitionRouter.post("/:petitionId/visitor-signal", async (req, res) => {
  const petitionId = Array.isArray(req.params.petitionId)
    ? req.params.petitionId[0]
    : req.params.petitionId;

  if (!petitionId?.trim()) {
    res.status(400).json(createFailureResponse("Petition identifier is required."));
    return;
  }

  const petition = await getPetition(petitionId);

  // Only a public Petition of an ordinary-public Initiative counts visitor
  // interest (HU-LC-05C.4C.6B).
  if (!petition || !isPetitionPubliclyReadable(petition)) {
    res.status(404).json(createFailureResponse("Petition not found."));
    return;
  }

  const visitorKey = resolveVisitorKey(req);
  await recordPetitionVisitorSignal({ petitionId, visitorKey });
  const visitorSignals = await countPetitionVisitorSignals(petitionId);

  res.json(createSuccessResponse({ visitorSignals }, "Petition visitor interest recorded."));
});

/**
 * HU-LC-05C.4C.3C — read-only list of an Initiative's active Petitions for
 * the public Initiative page. Anonymous access, gated by the same
 * ordinary-public Initiative check as the Initiative experience: unknown,
 * private, unprojected or administratively blocked Initiatives are 404.
 */
publicPetitionRouter.get("/by-initiative/:initiativeId", async (req, res) => {
  const initiativeId = (
    Array.isArray(req.params.initiativeId) ? req.params.initiativeId[0] : req.params.initiativeId
  )?.trim();

  if (!initiativeId) {
    res.status(400).json(createFailureResponse("Initiative identifier is required."));
    return;
  }

  const initiative = getInitiativeById(initiativeId);

  if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  res.json(
    createSuccessResponse(
      await listPublicInitiativePetitions(initiativeId),
      "Public Initiative petitions loaded.",
    ),
  );
});

publicPetitionRouter.get("/:petitionId", async (req, res) => {
  const petitionId = Array.isArray(req.params.petitionId)
    ? req.params.petitionId[0]
    : req.params.petitionId;
  const petition = await getPetition(petitionId ?? "");

  // HU-LC-05C.4C.6B — missing, private, unprojected or blocked Initiatives never
  // expose their Petitions; the Initiative's verified steward may still preview.
  if (!petition || !(await canReadPetition(req, petition))) {
    res.status(404).json(createFailureResponse("Public Petition not found."));
    return;
  }

  const projection = await toPublicPetitionProjection(petition, req.auth?.memberId ?? null);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public Petition not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public petition loaded."));
});

export default publicPetitionRouter;
