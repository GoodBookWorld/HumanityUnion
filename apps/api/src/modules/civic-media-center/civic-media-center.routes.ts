import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getCivicMediaCenter, listCivicMediaCategories } from "./civic-media-center.service.js";

const civicMediaCenterRouter = Router();

civicMediaCenterRouter.get("/", (_req, res) => {
  res.json(createSuccessResponse(getCivicMediaCenter(), "Civic Media Center loaded."));
});

civicMediaCenterRouter.get("/categories", (_req, res) => {
  res.json(createSuccessResponse(listCivicMediaCategories(), "Civic Media categories loaded."));
});

export default civicMediaCenterRouter;
