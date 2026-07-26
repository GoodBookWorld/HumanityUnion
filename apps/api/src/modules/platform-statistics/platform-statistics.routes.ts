import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getPlatformStatisticsPayload } from "./platform-statistics.service.js";

const platformStatisticsRouter = Router();

platformStatisticsRouter.get("/platform-statistics", async (_req, res: Response) => {
  try {
    const payload = await getPlatformStatisticsPayload();

    res.json(
      createSuccessResponse(payload.data, "Platform statistics loaded.", {
        activeMemberWindowDays: payload.meta.activeMemberWindowDays,
        generatedAt: payload.meta.generatedAt,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Platform statistics are temporarily unavailable.";

    res.status(500).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message,
    });
  }
});

export default platformStatisticsRouter;
