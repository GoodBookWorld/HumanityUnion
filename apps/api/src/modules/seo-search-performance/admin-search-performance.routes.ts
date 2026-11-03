import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { getAdminSearchPerformance } from "./search-performance.service.js";

const adminSearchPerformanceRouter = Router();

function fail(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, data: null, meta: {}, links: {}, message });
}

adminSearchPerformanceRouter.get("/", requireJwtAuthenticationMiddleware, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const result = await getAdminSearchPerformance({
      actorUserId: req.auth!.id,
      period: req.query.period,
    });
    res.json(createSuccessResponse(result, "Search performance loaded."));
  } catch (error) {
    if (error instanceof AdministrationUnauthorizedError) {
      fail(res, 401, "Authentication required.");
    } else if (error instanceof AdministrationForbiddenError) {
      fail(res, 403, "Administrator access is required.");
    } else if (error instanceof AdministrationValidationError) {
      fail(res, 400, error.message);
    } else {
      fail(res, 503, "Search performance data is temporarily unavailable.");
    }
  }
});

export { adminSearchPerformanceRouter };
