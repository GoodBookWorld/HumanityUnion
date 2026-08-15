import { Router, type Request } from "express";
import cookieParser from "cookie-parser";

import { createSuccessResponse } from "../../shared/http-response.js";
import { optionalAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { getPetition } from "./petition.store.js";
import { countPetitionVisitorSignals, recordPetitionVisitorSignal } from "./petition-visitor-signal.service.js";
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

  // A Petition only becomes a public civic document once it leaves
  // Draft/Ready — mirrors `isPubliclyVisible` in `public-petition.projection.ts`.
  if (!petition || petition.status === "Draft" || petition.status === "Ready") {
    res.status(404).json(createFailureResponse("Petition not found."));
    return;
  }

  const visitorKey = resolveVisitorKey(req);
  await recordPetitionVisitorSignal({ petitionId, visitorKey });
  const visitorSignals = await countPetitionVisitorSignals(petitionId);

  res.json(createSuccessResponse({ visitorSignals }, "Petition visitor interest recorded."));
});

publicPetitionRouter.get("/:petitionId", async (req, res) => {
  const petitionId = Array.isArray(req.params.petitionId)
    ? req.params.petitionId[0]
    : req.params.petitionId;
  const petition = await getPetition(petitionId ?? "");

  if (!petition) {
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
