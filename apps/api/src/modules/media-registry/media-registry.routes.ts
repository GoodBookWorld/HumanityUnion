import { Router, type Request, type Response } from "express";

import type { MediaRegistryFilter } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getMediaRegistryFilterOptions, listMediaRegistry } from "./media-registry.service.js";

const mediaRegistryRouter = Router();

function parseRegistryFilter(query: Request["query"]): MediaRegistryFilter {
  const read = (key: string) => {
    const value = query[key];
    return typeof value === "string" ? value : undefined;
  };

  return {
    provider: read("provider"),
    country: read("country"),
    language: read("language"),
    category: read("category"),
    region: read("region"),
  };
}

mediaRegistryRouter.get("/", (_req: Request, res: Response) => {
  const listing = listMediaRegistry();
  res.json(createSuccessResponse(listing, "Trusted global media registry loaded."));
});

mediaRegistryRouter.get("/filters", (_req: Request, res: Response) => {
  res.json(createSuccessResponse(getMediaRegistryFilterOptions(), "Media registry filters loaded."));
});

mediaRegistryRouter.get("/search", (req: Request, res: Response) => {
  const listing = listMediaRegistry(parseRegistryFilter(req.query));
  res.json(createSuccessResponse(listing, "Filtered media registry loaded."));
});

export default mediaRegistryRouter;
