import { Router, type Request } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";

import {
  getPublicCivicNominationProjection,
  listPublicCivicNominationProjections,
} from "./civic-nomination.service.js";
import { getPublicCivicNominationVotingProjection } from "../civic-nomination-vote/civic-nomination-vote.service.js";

const publicCivicNominationRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function getNominationId(req: Request): string {
  const nominationId = req.params.nominationId;
  return Array.isArray(nominationId) ? (nominationId[0] ?? "") : (nominationId ?? "");
}

function getInstitutionRole(req: Request): string {
  const institutionRole = req.params.institutionRole;
  return Array.isArray(institutionRole) ? (institutionRole[0] ?? "") : (institutionRole ?? "");
}

publicCivicNominationRouter.get("/", async (req, res) => {
  try {
    const institutionRole =
      typeof req.query.institutionRole === "string" ? req.query.institutionRole : undefined;
    const countrySlug =
      typeof req.query.countrySlug === "string" ? req.query.countrySlug : undefined;

    const nominations = await listPublicCivicNominationProjections({
      institutionRole,
      countrySlug,
    });

    res.json(createSuccessResponse(nominations, "Published civic nominations loaded."));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Public civic nominations unavailable.";
    res.status(400).json(createFailureResponse(message));
  }
});

publicCivicNominationRouter.get("/:nominationId/voting", async (req, res) => {
  try {
    const projection = getPublicCivicNominationVotingProjection(getNominationId(req));

    if (!projection) {
      res.status(404).json(createFailureResponse("Civic nomination voting not found."));
      return;
    }

    res.json(createSuccessResponse(projection, "Public civic nomination voting loaded."));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Public civic nomination voting unavailable.";
    res.status(400).json(createFailureResponse(message));
  }
});

publicCivicNominationRouter.get("/:nominationId", async (req, res) => {
  try {
    const projection = await getPublicCivicNominationProjection(getNominationId(req));

    if (!projection) {
      res.status(404).json(createFailureResponse("Civic nomination not found."));
      return;
    }

    res.json(createSuccessResponse(projection, "Public civic nomination loaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Public civic nomination unavailable.";
    res.status(400).json(createFailureResponse(message));
  }
});

export { publicCivicNominationRouter };

export const publicInstitutionCivicNominationsRouter = Router();

publicInstitutionCivicNominationsRouter.get("/:institutionRole/nominations", async (req, res) => {
  try {
    const countrySlug =
      typeof req.query.countrySlug === "string" ? req.query.countrySlug : undefined;

    const nominations = await listPublicCivicNominationProjections({
      institutionRole: getInstitutionRole(req),
      countrySlug,
    });

    res.json(createSuccessResponse(nominations, "Institution civic nominations loaded."));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Institution civic nominations unavailable.";
    res.status(400).json(createFailureResponse(message));
  }
});
