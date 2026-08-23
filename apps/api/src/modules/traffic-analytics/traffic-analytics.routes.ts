import { Router } from "express";
import cookieParser from "cookie-parser";

import { createSuccessResponse } from "../../shared/http-response.js";
import { logger } from "../../shared/observability/logger.js";
import { AdministrationForbiddenError } from "../administration/administration.errors.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import { getTrafficAdminReport } from "./traffic-analytics.admin.service.js";
import { getTrafficInsightsReport } from "./traffic-insights.admin.service.js";
import { trafficAnalyticsRateLimiter } from "./traffic-analytics-rate-limit.js";
import {
  ingestTrafficPageview,
  TrafficAnalyticsValidationError,
} from "./traffic-analytics.ingest.js";
import { parseTrafficPeriod } from "./traffic-period.js";
import { parseTrafficInsightsPeriod } from "./traffic-insights-period.js";

function failure(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

/** Public anonymous pageview collector. */
export const publicTrafficAnalyticsRouter = Router();
publicTrafficAnalyticsRouter.use(cookieParser());

publicTrafficAnalyticsRouter.post(
  "/pageview",
  trafficAnalyticsRateLimiter,
  async (req, res) => {
    try {
      const result = await ingestTrafficPageview({
        req,
        res,
        body: req.body,
      });

      res.status(204).end();
      if (result.accepted) {
        return;
      }
      // Soft-ignore still returns 204 so navigation never surfaces analytics errors.
    } catch (error) {
      if (error instanceof TrafficAnalyticsValidationError) {
        res.status(400).json(failure(error.message));
        return;
      }

      logger.warn("traffic_analytics.ingest_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      // Resilience: do not fail the client hard on persistence errors.
      res.status(204).end();
    }
  },
);

/** Admin-only aggregates for Views → Traffic. */
export const adminTrafficAnalyticsRouter = Router();

adminTrafficAnalyticsRouter.get(
  "/traffic",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    const period = parseTrafficPeriod(req.query.period) ?? "7d";

    try {
      const report = await getTrafficAdminReport({
        actorUserId: req.auth!.id,
        period,
      });
      res.json(createSuccessResponse(report, "Traffic analytics loaded."));
    } catch (error) {
      if (error instanceof AdministrationForbiddenError) {
        res.status(403).json(failure(error.message));
        return;
      }

      logger.error("traffic_analytics.admin_read_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      res.status(503).json(failure("Analytics unavailable"));
    }
  },
);

adminTrafficAnalyticsRouter.get(
  "/insights",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    const period = parseTrafficInsightsPeriod(req.query.period) ?? "30d";

    try {
      const report = await getTrafficInsightsReport({
        actorUserId: req.auth!.id,
        period,
      });
      res.json(createSuccessResponse(report, "Traffic insights loaded."));
    } catch (error) {
      if (error instanceof AdministrationForbiddenError) {
        res.status(403).json(failure(error.message));
        return;
      }

      logger.error("traffic_analytics.insights_read_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      res.status(503).json(failure("Analytics unavailable"));
    }
  },
);
