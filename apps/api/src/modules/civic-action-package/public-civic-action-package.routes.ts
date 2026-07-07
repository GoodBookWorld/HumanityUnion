import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import {
  computeCivicActionPackageMetrics,
  getPublicCivicActionPackage,
  getPublicCivicActionPackageForDecision,
  listPublicCivicActionPackagesForInitiative,
} from "./civic-action-package.projection.js";

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

const publicCivicActionPackageRouter = Router();

publicCivicActionPackageRouter.get("/:capId", (req, res) => {
  const capId = Array.isArray(req.params.capId)
    ? (req.params.capId[0] ?? "")
    : (req.params.capId ?? "");
  const projection = getPublicCivicActionPackage(capId);

  if (!projection) {
    res.status(404).json(createFailureResponse("Civic Action Package is not available."));
    return;
  }

  const metrics = computeCivicActionPackageMetrics();

  res.json(createSuccessResponse(projection, "Civic Action Package loaded.", { metrics }));
});

export const publicCivicActionPackagesByInitiativeRouter = Router();

publicCivicActionPackagesByInitiativeRouter.get(
  "/:initiativeId/civic-action-packages",
  (req, res) => {
    const initiativeId = Array.isArray(req.params.initiativeId)
      ? (req.params.initiativeId[0] ?? "")
      : (req.params.initiativeId ?? "");
    const initiative = getInitiativeById(initiativeId);

    if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    const packages = listPublicCivicActionPackagesForInitiative(initiativeId);
    const metrics = computeCivicActionPackageMetrics();

    res.json(
      createSuccessResponse(packages, "Initiative Civic Action Packages loaded.", { metrics }),
    );
  },
);

export const publicCivicActionPackageByDecisionRouter = Router();

publicCivicActionPackageByDecisionRouter.get("/:decisionId/civic-action-package", (req, res) => {
  const decisionId = Array.isArray(req.params.decisionId)
    ? (req.params.decisionId[0] ?? "")
    : (req.params.decisionId ?? "");
  const decision = getDecisionById(decisionId);

  if (!decision || decision.status !== "closed") {
    res.status(404).json(createFailureResponse("Collective decision not found."));
    return;
  }

  const projection = getPublicCivicActionPackageForDecision(decisionId);

  if (!projection) {
    res.status(404).json(createFailureResponse("Civic Action Package is not available."));
    return;
  }

  const metrics = computeCivicActionPackageMetrics();

  res.json(createSuccessResponse(projection, "Civic Action Package loaded.", { metrics }));
});

export default publicCivicActionPackageRouter;
