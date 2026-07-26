import { Router, type Response } from "express";

import { getCountryByCode, normalizeCountryInput } from "@hu/geography";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  listCountryInitiativeCardProjections,
  listCountryTrustedMediaResources,
} from "./country-public.service.js";
import { getCountryStatisticsPayload } from "./country-statistics.service.js";

const countryStatisticsRouter = Router();

function resolveCountryCode(input: string): string | null {
  return normalizeCountryInput(input) ?? null;
}

countryStatisticsRouter.get("/countries/:countryCode/statistics", async (req, res: Response) => {
  try {
    const payload = await getCountryStatisticsPayload(req.params.countryCode);

    if (!payload) {
      res.status(404).json({
        success: false,
        data: null,
        meta: {},
        links: {},
        message: "Country not found.",
      });
      return;
    }

    res.json(
      createSuccessResponse(payload.data, "Country statistics loaded.", {
        countryCode: payload.countryCode,
        countryName: payload.countryName,
        generatedAt: payload.meta.generatedAt,
        transparencyNote: payload.meta.transparencyNote,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Country statistics are temporarily unavailable.";

    res.status(500).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message,
    });
  }
});

countryStatisticsRouter.get("/countries/:countryCode/initiatives", async (req, res: Response) => {
  const countryCode = resolveCountryCode(req.params.countryCode);

  if (!countryCode || !getCountryByCode(countryCode)) {
    res.status(404).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message: "Country not found.",
    });
    return;
  }

  const initiatives = listCountryInitiativeCardProjections(countryCode);

  res.json(
    createSuccessResponse(initiatives, "Country initiatives loaded.", {
      countryCode,
      count: initiatives.length,
      generatedAt: new Date().toISOString(),
    }),
  );
});

countryStatisticsRouter.get("/countries/:countryCode/media", async (req, res: Response) => {
  const countryCode = resolveCountryCode(req.params.countryCode);

  if (!countryCode || !getCountryByCode(countryCode)) {
    res.status(404).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message: "Country not found.",
    });
    return;
  }

  const media = listCountryTrustedMediaResources(countryCode);

  res.json(
    createSuccessResponse(media, "Country civic media loaded.", {
      countryCode,
      count: media.length,
      generatedAt: new Date().toISOString(),
    }),
  );
});

export default countryStatisticsRouter;
