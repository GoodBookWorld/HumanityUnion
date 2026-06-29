import { Router } from "express";
import { createSuccessResponse } from "../../shared/http-response.js";
import { sampleMember } from "./member.sample.js";

const memberRouter = Router();

memberRouter.get("/me", (_req, res) => {
  res.json(createSuccessResponse(sampleMember, "Member profile loaded."));
});

export default memberRouter;
