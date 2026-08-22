import { Router, type Response } from "express";

import { getCountryByCode, normalizeCountryInput } from "@hu/geography";
import type { CountryAffiliationEntryType } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import { listPublicByCountry } from "../country-affiliation/country-affiliation.service.js";
import {
  listCountryInitiativeCardProjections,
  listCountryTrustedMediaResources,
} from "./country-public.service.js";
import { getCountryStatisticsPayload } from "./country-statistics.service.js";

const countryStatisticsRouter = Router();

function resolveCountryCode(input: string): string | null {
  return normalizeCountryInput(input) ?? null;
}

function parseAffiliationEntryType(
  value: unknown,
): CountryAffiliationEntryType | undefined {
  if (value === "TEAM_MEMBER" || value === "PARTNER") {
    return value;
  }
  return undefined;
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

  const regionCode =
    typeof req.query.region === "string"
      ? req.query.region
      : typeof req.query.regionCode === "string"
        ? req.query.regionCode
        : undefined;
  const communityCode =
    typeof req.query.community === "string"
      ? req.query.community
      : typeof req.query.communityCode === "string"
        ? req.query.communityCode
        : undefined;
  const lifecycleProfileRaw =
    typeof req.query.lifecycleProfile === "string" ? req.query.lifecycleProfile.trim() : "";
  const lifecycleProfile =
    lifecycleProfileRaw === "STANDARD" || lifecycleProfileRaw === "PUBLIC_CHOICE"
      ? lifecycleProfileRaw
      : undefined;

  const initiatives = await listCountryInitiativeCardProjections(countryCode, {
    regionCode,
    communityCode,
    lifecycleProfile,
  });

  res.json(
    createSuccessResponse(initiatives, "Country initiatives loaded.", {
      countryCode,
      regionCode: regionCode || null,
      communityCode: communityCode || null,
      lifecycleProfile: lifecycleProfile || null,
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

  const media = await listCountryTrustedMediaResources(countryCode);

  res.json(
    createSuccessResponse(media, "Country civic media loaded.", {
      countryCode,
      count: media.length,
      generatedAt: new Date().toISOString(),
    }),
  );
});

countryStatisticsRouter.get(
  "/countries/:countryCode/affiliations",
  async (req, res: Response) => {
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

    const entryType = parseAffiliationEntryType(req.query.entryType);
    if (
      typeof req.query.entryType === "string" &&
      req.query.entryType.trim() &&
      !entryType
    ) {
      res.status(400).json({
        success: false,
        data: null,
        meta: {},
        links: {},
        message: "entryType must be TEAM_MEMBER or PARTNER.",
      });
      return;
    }

    try {
      const affiliations = await listPublicByCountry(countryCode, entryType);
      res.json(
        createSuccessResponse(affiliations, "Country affiliations loaded.", {
          countryCode,
          count: affiliations.length,
          generatedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Country affiliations are temporarily unavailable.";
      res.status(500).json({
        success: false,
        data: null,
        meta: {},
        links: {},
        message,
      });
    }
  },
);

export default countryStatisticsRouter;
