import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getMembershipStatisticsPayload } from "./membership-statistics.service.js";

const membershipStatisticsRouter = Router();

membershipStatisticsRouter.get("/membership", async (_req, res: Response) => {
  try {
    const payload = await getMembershipStatisticsPayload();
    res.json(createSuccessResponse(payload, "Membership statistics loaded."));
  } catch {
    res.status(503).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message: "Membership statistics are temporarily unavailable.",
    });
  }
});

export { membershipStatisticsRouter };
