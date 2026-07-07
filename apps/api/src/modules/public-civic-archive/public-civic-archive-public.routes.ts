import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { getImpactById } from "../initiative-public-impact/initiative-public-impact.store.js";
import {
  computePublicCivicArchiveMetrics,
  getLatestPublishedPublicCivicArchiveForInitiative,
  getPublicCivicArchive,
  getPublishedPublicCivicArchiveForImpact,
  listPublicCivicArchiveForInitiative,
  listPublicCivicArchiveIndex,
} from "./public-civic-archive.projection.js";

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function parseImplementationYear(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? undefined : parsed;
}

const publicCivicArchivePublicRouter = Router();

publicCivicArchivePublicRouter.get("/", (req, res) => {
  const records = listPublicCivicArchiveIndex({
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    country: typeof req.query.country === "string" ? req.query.country : undefined,
    region: typeof req.query.region === "string" ? req.query.region : undefined,
    community: typeof req.query.community === "string" ? req.query.community : undefined,
    activityArea: typeof req.query.activityArea === "string" ? req.query.activityArea : undefined,
    implementationYear: parseImplementationYear(req.query.implementationYear),
  });
  const metrics = computePublicCivicArchiveMetrics();

  res.json(createSuccessResponse(records, "Public civic archive index loaded.", { metrics }));
});

publicCivicArchivePublicRouter.get("/:archiveRecordId", (req, res) => {
  const archiveRecordId = Array.isArray(req.params.archiveRecordId)
    ? (req.params.archiveRecordId[0] ?? "")
    : (req.params.archiveRecordId ?? "");
  const projection = getPublicCivicArchive(archiveRecordId);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public civic archive record is not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public civic archive record loaded."));
});

export const publicCivicArchiveByInitiativeRouter = Router();

publicCivicArchiveByInitiativeRouter.get("/:initiativeId/civic-archive", (req, res) => {
  const initiativeId = Array.isArray(req.params.initiativeId)
    ? (req.params.initiativeId[0] ?? "")
    : (req.params.initiativeId ?? "");
  const initiative = getInitiativeById(initiativeId);

  if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  const records = listPublicCivicArchiveForInitiative(initiativeId);
  const latest = getLatestPublishedPublicCivicArchiveForInitiative(initiativeId);
  const metrics = computePublicCivicArchiveMetrics();

  res.json(
    createSuccessResponse(records, "Initiative civic archive records loaded.", {
      metrics,
      latestArchiveRecordId: latest?.archiveRecordId ?? null,
    }),
  );
});

export const publicCivicArchiveByImpactRouter = Router();

publicCivicArchiveByImpactRouter.get("/:impactId/civic-archive", (req, res) => {
  const impactId = Array.isArray(req.params.impactId)
    ? (req.params.impactId[0] ?? "")
    : (req.params.impactId ?? "");
  const impact = getImpactById(impactId);

  if (!impact || impact.status === "draft") {
    res.status(404).json(createFailureResponse("Public impact record not found."));
    return;
  }

  const projection = getPublishedPublicCivicArchiveForImpact(impactId);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public civic archive record is not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public civic archive record loaded."));
});

export default publicCivicArchivePublicRouter;
