import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { getImpactById } from "../initiative-public-impact/initiative-public-impact.store.js";
import { parseCivicArchiveIndexQuery } from "./civic-archive-index-query.js";
import {
  computeCivicArchiveLifecycleMetricsForRecords,
  getCivicArchiveLifecycleRecord,
  listCivicArchiveLifecycleRecords,
  resolveCivicArchiveLifecycleRecord,
} from "./public-civic-archive-lifecycle.projection.js";
import {
  computePublicCivicArchiveMetrics,
  getLatestPublishedPublicCivicArchiveForInitiative,
  getPublishedPublicCivicArchiveForImpact,
  listPublicCivicArchiveForInitiative,
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

const publicCivicArchivePublicRouter = Router();

publicCivicArchivePublicRouter.get("/", async (req, res) => {
  const indexQuery = parseCivicArchiveIndexQuery(req.query as Record<string, unknown>);
  const records = listCivicArchiveLifecycleRecords(indexQuery);
  const metrics = computeCivicArchiveLifecycleMetricsForRecords(records);

  res.setHeader("Cache-Control", "no-store");
  res.json(
    createSuccessResponse(records, "Public civic archive index loaded.", {
      metrics,
      total: records.length,
    }),
  );
});

publicCivicArchivePublicRouter.get("/:archiveRecordId", async (req, res) => {
  const id = Array.isArray(req.params.archiveRecordId)
    ? (req.params.archiveRecordId[0] ?? "")
    : (req.params.archiveRecordId ?? "");
  const lifecycle = resolveCivicArchiveLifecycleRecord(id);

  if (!lifecycle) {
    res.status(404).json(createFailureResponse("Public civic archive record is not available."));
    return;
  }

  res.json(createSuccessResponse(lifecycle, "Public civic archive lifecycle record loaded."));
});

export const publicCivicArchiveByInitiativeRouter = Router();

publicCivicArchiveByInitiativeRouter.get("/:initiativeId/civic-archive", async (req, res) => {
  const initiativeId = Array.isArray(req.params.initiativeId)
    ? (req.params.initiativeId[0] ?? "")
    : (req.params.initiativeId ?? "");
  const initiative = getInitiativeById(initiativeId);

  if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  const lifecycle = getCivicArchiveLifecycleRecord(initiativeId);
  const records = listPublicCivicArchiveForInitiative(initiativeId);
  const latest = await getLatestPublishedPublicCivicArchiveForInitiative(initiativeId);
  const metrics = computePublicCivicArchiveMetrics();

  res.json(
    createSuccessResponse(records, "Initiative civic archive records loaded.", {
      metrics,
      latestArchiveRecordId: latest?.archiveRecordId ?? null,
      lifecycle,
    }),
  );
});

export const publicCivicArchiveByImpactRouter = Router();

publicCivicArchiveByImpactRouter.get("/:impactId/civic-archive", async (req, res) => {
  const impactId = Array.isArray(req.params.impactId)
    ? (req.params.impactId[0] ?? "")
    : (req.params.impactId ?? "");
  const impact = getImpactById(impactId);

  if (!impact || impact.status === "draft") {
    res.status(404).json(createFailureResponse("Public impact record not found."));
    return;
  }

  const projection = await getPublishedPublicCivicArchiveForImpact(impactId);
  const lifecycle = getCivicArchiveLifecycleRecord(impact.initiativeId);

  if (!projection && !lifecycle) {
    res.status(404).json(createFailureResponse("Public civic archive record is not available."));
    return;
  }

  res.json(
    createSuccessResponse(lifecycle ?? projection, "Public civic archive record loaded.", {
      projection,
    }),
  );
});

export default publicCivicArchivePublicRouter;
