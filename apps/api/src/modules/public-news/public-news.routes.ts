import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  getPublicNewsArticleById,
  listPublicNewsArticles,
  parsePublicNewsQuery,
} from "./public-news.service.js";
import { toPublicNewsArticleItem } from "./public-news.normalize.js";

const publicNewsRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicNewsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const listing = await listPublicNewsArticles(parsePublicNewsQuery(req.query));
    res.json(createSuccessResponse(listing, "Public news articles loaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Public news request failed.";
    res.status(400).json(createFailureResponse(message));
  }
});

publicNewsRouter.get("/:id", async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id) {
    res.status(400).json(createFailureResponse("News article id is required."));
    return;
  }

  const record = await getPublicNewsArticleById(id);

  if (!record) {
    res.status(404).json(createFailureResponse("News article not found."));
    return;
  }

  res.json(createSuccessResponse(toPublicNewsArticleItem(record), "Public news article loaded."));
});

export default publicNewsRouter;
