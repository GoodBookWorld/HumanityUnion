import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { parseCivicSearchQuery, searchPublicCivicRecords } from "./global-search.service.js";

const globalSearchRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

globalSearchRouter.get("/search", async (req, res: Response) => {
  try {
    const query = parseCivicSearchQuery(req.query as Record<string, string | string[] | undefined>);
    const results = await searchPublicCivicRecords(query);

    res.json(createSuccessResponse(results, "Public civic search results loaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Public civic search failed.";
    res.status(400).json(createFailureResponse(message));
  }
});

export default globalSearchRouter;
