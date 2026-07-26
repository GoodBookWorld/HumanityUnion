import { Router } from "express";

import type { ApproximateIpGeography } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveApproximateIpGeography } from "./resolve-approximate-ip-geography.js";

const ipGeographyRouter = Router();

ipGeographyRouter.get("/approximate", (req, res) => {
  const geography: ApproximateIpGeography = resolveApproximateIpGeography(req);

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "X-Forwarded-For, CF-IPCountry, X-Vercel-IP-Country");

  res.status(200).json(createSuccessResponse(geography));
});

export default ipGeographyRouter;
