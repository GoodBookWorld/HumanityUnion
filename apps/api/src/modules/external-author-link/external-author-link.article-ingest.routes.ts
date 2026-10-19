import { Router, type Request } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { INTEGRITY_MEDIA_ARTICLE_SIGNATURE_HEADER, INTEGRITY_MEDIA_ARTICLE_TIMESTAMP_HEADER } from "./external-author-link.constants.js";
import {
  ArticleIngestError,
  ingestIntegrityMediaArticle,
} from "./external-author-link.article-ingest.service.js";

const articleIngestRouter = Router();

articleIngestRouter.post("/articles", async (req, res) => {
  try {
    const result = await ingestIntegrityMediaArticle({
      body: req.body,
      timestamp: headerValue(req, INTEGRITY_MEDIA_ARTICLE_TIMESTAMP_HEADER),
      signature: headerValue(req, INTEGRITY_MEDIA_ARTICLE_SIGNATURE_HEADER),
    });
    res.status(200).json(createSuccessResponse(result, "Integrity Media article accepted."));
  } catch (error) {
    if (error instanceof ArticleIngestError) {
      res.status(error.statusCode).json({
        success: false,
        data: error.delivery,
        meta: { code: error.code },
        links: {},
        message: error.message,
      });
      return;
    }
    res.status(503).json({
      success: false,
      data: null,
      meta: { code: "unavailable" },
      links: {},
      message: "Integrity Media article ingestion is unavailable.",
    });
  }
});

function headerValue(req: Request, name: string): string {
  const value = req.header(name);
  return typeof value === "string" ? value.trim() : "";
}

export default articleIngestRouter;
