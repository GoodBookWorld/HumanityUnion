import { Router } from "express";

import { civicMediaCenterRouter } from "../civic-media-center/index.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import {
  getKnowledgeArticleBySlug,
  getKnowledgeDiagramSvg,
  listKnowledgeCategories,
} from "./knowledge-center.service.js";

const knowledgeCenterRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

knowledgeCenterRouter.get("/", (_req, res) => {
  res.json(createSuccessResponse(listKnowledgeCategories(), "Knowledge Center listing loaded."));
});

knowledgeCenterRouter.get("/categories", (_req, res) => {
  const listing = listKnowledgeCategories();
  res.json(
    createSuccessResponse({ categories: listing.categories }, "Knowledge categories loaded."),
  );
});

knowledgeCenterRouter.use("/media", civicMediaCenterRouter);

knowledgeCenterRouter.get("/diagrams/:diagramId", (req, res) => {
  const diagram = getKnowledgeDiagramSvg(req.params.diagramId);

  res.json(
    createSuccessResponse(
      {
        diagramId: req.params.diagramId,
        svg: diagram,
      },
      "Knowledge diagram loaded.",
    ),
  );
});

knowledgeCenterRouter.get("/:slug", (req, res) => {
  const article = getKnowledgeArticleBySlug(req.params.slug);

  if (!article) {
    res.status(404).json(createFailureResponse("Knowledge article not found."));
    return;
  }

  res.json(createSuccessResponse(article, "Knowledge article loaded."));
});

export default knowledgeCenterRouter;
